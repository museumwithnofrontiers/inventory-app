<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Support\AuthSnapshots\AuthSnapshotFile;
use Illuminate\Console\Command;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;
use JsonException;
use Spatie\Permission\PermissionRegistrar;

class RestoreAuthSnapshot extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'auth:restore
                            {path : Filesystem path to the encrypted snapshot}
                            {--force : Replace existing user accounts and user-owned auth records}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Restore user accounts, MFA setup, role assignments and direct permissions from an encrypted auth snapshot. Every OAuth token is revoked: connected apps sign in again.';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $path = AuthSnapshotFile::resolvePath((string) $this->argument('path'));

        if (! File::isFile($path)) {
            $this->error("Auth snapshot was not found at [{$path}].");

            return Command::FAILURE;
        }

        if (User::query()->exists() && ! $this->option('force')) {
            $this->error('Users already exist. Re-run with --force to replace existing user accounts and user-owned auth records.');

            return Command::FAILURE;
        }

        $payload = $this->readSnapshot($path);

        if ($payload === null) {
            return Command::FAILURE;
        }

        if (($payload['version'] ?? null) !== 1) {
            $this->error('Unsupported auth snapshot version.');

            return Command::FAILURE;
        }

        $tablesRaw = $payload['tables'] ?? [];
        $tables = is_array($tablesRaw) ? $tablesRaw : [];

        /** @var array<int, array<string, mixed>> $usersRows */
        $usersRows = is_array($tables['users'] ?? null) ? $tables['users'] : [];
        /** @var array<int, array<string, mixed>> $roleAssignments */
        $roleAssignments = is_array($tables['role_assignments'] ?? null) ? $tables['role_assignments'] : [];
        /** @var array<int, array<string, mixed>> $permissionAssignments */
        $permissionAssignments = is_array($tables['permission_assignments'] ?? null) ? $tables['permission_assignments'] : [];

        try {
            DB::transaction(function () use ($usersRows, $roleAssignments, $permissionAssignments): void {
                Schema::disableForeignKeyConstraints();

                try {
                    $this->clearUserAuthRecords();
                    $this->restoreRows('users', $usersRows);
                    $this->restoreRoleAssignments($roleAssignments);
                    $this->restorePermissionAssignments($permissionAssignments);
                } finally {
                    Schema::enableForeignKeyConstraints();
                }
            });
        } catch (\Throwable $exception) {
            $this->error('Unable to restore auth snapshot: '.$exception->getMessage());

            return Command::FAILURE;
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $this->info('Auth snapshot restored successfully.');
        $this->line('Restored users: '.count($usersRows));
        $this->line('Restored role assignments: '.count($roleAssignments));
        $this->line('Restored direct permission assignments: '.count($permissionAssignments));
        $this->line('OAuth tokens revoked: connected apps must sign in again.');

        return Command::SUCCESS;
    }

    /**
     * @return array<string, mixed>|null
     */
    protected function readSnapshot(string $path): ?array
    {
        try {
            $contents = File::get($path);
            $decrypted = Crypt::decryptString($contents);
            $decoded = json_decode($decrypted, true, 512, JSON_THROW_ON_ERROR);

            if (! is_array($decoded)) {
                return null;
            }

            /** @var array<string, mixed> $decoded */
            return $decoded;
        } catch (DecryptException) {
            $this->error('Unable to decrypt auth snapshot. Verify that this app uses the same APP_KEY that created the snapshot.');
        } catch (JsonException $exception) {
            $this->error('Unable to decode auth snapshot: '.$exception->getMessage());
        } catch (\Throwable $exception) {
            $this->error('Unable to read auth snapshot: '.$exception->getMessage());
        }

        return null;
    }

    protected function clearUserAuthRecords(): void
    {
        $tables = Config::array('permission.table_names');
        $modelHasRolesTable = is_string($tables['model_has_roles'] ?? null) ? $tables['model_has_roles'] : '';
        $modelHasPermissionsTable = is_string($tables['model_has_permissions'] ?? null) ? $tables['model_has_permissions'] : '';

        $this->deleteUserModelRows($modelHasRolesTable);
        $this->deleteUserModelRows($modelHasPermissionsTable);

        // Tokens and codes point at user ids. The restored users take ids
        // from the snapshot, so a grant made to a user being replaced could
        // otherwise resolve to whoever now holds that id.
        foreach (['oauth_refresh_tokens', 'oauth_access_tokens', 'oauth_auth_codes'] as $table) {
            if (Schema::hasTable($table)) {
                DB::table($table)->delete();
            }
        }

        User::query()->delete();
    }

    protected function deleteUserModelRows(string $table): void
    {
        if (! Schema::hasTable($table)) {
            return;
        }

        DB::table($table)
            ->where('model_type', User::class)
            ->delete();
    }

    /**
     * @param  array<int, array<string, mixed>>  $rows
     */
    protected function restoreRows(string $table, array $rows): void
    {
        if ($rows === [] || ! Schema::hasTable($table)) {
            return;
        }

        $columns = Schema::getColumnListing($table);

        foreach ($rows as $row) {
            DB::table($table)->insert(Arr::only($row, $columns));
        }
    }

    /**
     * @param  array<int, array<string, mixed>>  $assignments
     */
    protected function restoreRoleAssignments(array $assignments): void
    {
        if ($assignments === []) {
            return;
        }

        $tables = Config::array('permission.table_names');
        $columns = Config::array('permission.column_names');
        $modelKeyRaw = $columns['model_morph_key'] ?? 'model_id';
        $modelKey = is_string($modelKeyRaw) ? $modelKeyRaw : 'model_id';
        $roleKeyRaw = $columns['role_pivot_key'] ?? 'role_id';
        $roleKey = is_string($roleKeyRaw) ? $roleKeyRaw : 'role_id';
        $rolesTable = is_string($tables['roles'] ?? null) ? $tables['roles'] : 'roles';
        $modelHasRolesTable = is_string($tables['model_has_roles'] ?? null) ? $tables['model_has_roles'] : 'model_has_roles';

        foreach ($assignments as $assignment) {
            $role = DB::table($rolesTable)
                ->where('name', $assignment['name'])
                ->where('guard_name', $assignment['guard_name'])
                ->first();

            if ($role === null) {
                $roleName = is_string($assignment['name']) ? $assignment['name'] : '';
                throw new \RuntimeException("Role [{$roleName}] does not exist. Run php artisan permissions:sync before restoring the snapshot.");
            }

            DB::table($modelHasRolesTable)->insert([
                $roleKey => $role->id,
                'model_type' => $assignment['model_type'],
                $modelKey => $assignment['model_id'],
            ]);
        }
    }

    /**
     * @param  array<int, array<string, mixed>>  $assignments
     */
    protected function restorePermissionAssignments(array $assignments): void
    {
        if ($assignments === []) {
            return;
        }

        $tables = Config::array('permission.table_names');
        $columns = Config::array('permission.column_names');
        $modelKeyRaw = $columns['model_morph_key'] ?? 'model_id';
        $modelKey = is_string($modelKeyRaw) ? $modelKeyRaw : 'model_id';
        $permissionKeyRaw = $columns['permission_pivot_key'] ?? 'permission_id';
        $permissionKey = is_string($permissionKeyRaw) ? $permissionKeyRaw : 'permission_id';
        $permissionsTable = is_string($tables['permissions'] ?? null) ? $tables['permissions'] : 'permissions';
        $modelHasPermissionsTable = is_string($tables['model_has_permissions'] ?? null) ? $tables['model_has_permissions'] : 'model_has_permissions';

        foreach ($assignments as $assignment) {
            $permission = DB::table($permissionsTable)
                ->where('name', $assignment['name'])
                ->where('guard_name', $assignment['guard_name'])
                ->first();

            if ($permission === null) {
                $permName = is_string($assignment['name']) ? $assignment['name'] : '';
                throw new \RuntimeException("Permission [{$permName}] does not exist. Run php artisan permissions:sync before restoring the snapshot.");
            }

            DB::table($modelHasPermissionsTable)->insert([
                $permissionKey => $permission->id,
                'model_type' => $assignment['model_type'],
                $modelKey => $assignment['model_id'],
            ]);
        }
    }
}
