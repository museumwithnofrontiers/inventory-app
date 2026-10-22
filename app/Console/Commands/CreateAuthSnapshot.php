<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Support\AuthSnapshots\AuthSnapshotFile;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;
use JsonException;
use Spatie\Permission\PermissionRegistrar;

class CreateAuthSnapshot extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'auth:snapshot
                            {path? : Filesystem path for the encrypted snapshot. Defaults to the system temp directory}
                            {--force : Overwrite an existing snapshot file}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Create an encrypted snapshot of user accounts, MFA setup, role assignments and direct permissions.';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $path = $this->snapshotPath();

        if (File::exists($path) && ! $this->option('force')) {
            $this->error("Snapshot already exists at [{$path}]. Use --force to overwrite it.");

            return Command::FAILURE;
        }

        try {
            $payload = json_encode($this->snapshotPayload(), JSON_THROW_ON_ERROR);
        } catch (JsonException $exception) {
            $this->error('Unable to encode auth snapshot: '.$exception->getMessage());

            return Command::FAILURE;
        }

        if (! $this->writeSnapshot($path, Crypt::encryptString($payload))) {
            return Command::FAILURE;
        }

        $this->info('Auth snapshot created successfully.');
        $this->line("Snapshot path: {$path}");
        $this->line('The snapshot is encrypted with the current Laravel APP_KEY. The APP_KEY is not stored in the snapshot.');

        return Command::SUCCESS;
    }

    protected function snapshotPath(): string
    {
        $path = $this->argument('path');

        return AuthSnapshotFile::resolvePath(is_string($path) ? $path : null);
    }

    protected function writeSnapshot(string $path, string $contents): bool
    {
        try {
            $directory = dirname($path);

            File::ensureDirectoryExists($directory, 0700, true);

            if (! File::isDirectory($directory) || ! File::isWritable($directory)) {
                $this->error("Auth snapshot directory is not writable: {$directory}");

                return false;
            }

            if (File::put($path, $contents, true) === false) {
                $this->error("Unable to write auth snapshot to [{$path}].");

                return false;
            }

            File::chmod($path, 0600);
        } catch (\Throwable $exception) {
            $this->error('Unable to write auth snapshot: '.$exception->getMessage());

            return false;
        }

        return true;
    }

    /**
     * @return array<string, mixed>
     */
    protected function snapshotPayload(): array
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return [
            'version' => 1,
            'created_at' => now()->toISOString(),
            'tables' => [
                'users' => $this->rows('users'),
                'role_assignments' => $this->roleAssignments(),
                'permission_assignments' => $this->permissionAssignments(),
            ],
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    protected function rows(string $table): array
    {
        if (! Schema::hasTable($table)) {
            return [];
        }

        /** @var array<int, array<string, mixed>> $result */
        $result = DB::table($table)
            ->orderBy('id')
            ->get()
            ->map(fn (object $row): array => (array) $row)
            ->all();

        return $result;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    protected function roleAssignments(): array
    {
        $tables = Config::array('permission.table_names');
        $columns = Config::array('permission.column_names');
        $modelKeyRaw = $columns['model_morph_key'] ?? 'model_id';
        $modelKey = is_string($modelKeyRaw) ? $modelKeyRaw : 'model_id';
        $roleKeyRaw = $columns['role_pivot_key'] ?? 'role_id';
        $roleKey = is_string($roleKeyRaw) ? $roleKeyRaw : 'role_id';
        $modelHasRolesTable = is_string($tables['model_has_roles'] ?? null) ? $tables['model_has_roles'] : '';
        $rolesTable = is_string($tables['roles'] ?? null) ? $tables['roles'] : '';

        if (! Schema::hasTable($modelHasRolesTable) || ! Schema::hasTable($rolesTable)) {
            return [];
        }

        /** @var array<int, array<string, mixed>> $result */
        $result = DB::table($modelHasRolesTable.' as assignment')
            ->join($rolesTable.' as role', 'role.id', '=', 'assignment.'.$roleKey)
            ->where('assignment.model_type', User::class)
            ->orderBy('assignment.'.$modelKey)
            ->orderBy('role.name')
            ->get([
                'role.name as name',
                'role.guard_name as guard_name',
                'assignment.model_type as model_type',
                'assignment.'.$modelKey.' as model_id',
            ])
            ->map(fn (object $row): array => (array) $row)
            ->all();

        return $result;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    protected function permissionAssignments(): array
    {
        $tables = Config::array('permission.table_names');
        $columns = Config::array('permission.column_names');
        $modelKeyRaw = $columns['model_morph_key'] ?? 'model_id';
        $modelKey = is_string($modelKeyRaw) ? $modelKeyRaw : 'model_id';
        $permissionKeyRaw = $columns['permission_pivot_key'] ?? 'permission_id';
        $permissionKey = is_string($permissionKeyRaw) ? $permissionKeyRaw : 'permission_id';
        $modelHasPermissionsTable = is_string($tables['model_has_permissions'] ?? null) ? $tables['model_has_permissions'] : '';
        $permissionsTable = is_string($tables['permissions'] ?? null) ? $tables['permissions'] : '';

        if (! Schema::hasTable($modelHasPermissionsTable) || ! Schema::hasTable($permissionsTable)) {
            return [];
        }

        /** @var array<int, array<string, mixed>> $result */
        $result = DB::table($modelHasPermissionsTable.' as assignment')
            ->join($permissionsTable.' as permission', 'permission.id', '=', 'assignment.'.$permissionKey)
            ->where('assignment.model_type', User::class)
            ->orderBy('assignment.'.$modelKey)
            ->orderBy('permission.name')
            ->get([
                'permission.name as name',
                'permission.guard_name as guard_name',
                'assignment.model_type as model_type',
                'assignment.'.$modelKey.' as model_id',
            ])
            ->map(fn (object $row): array => (array) $row)
            ->all();

        return $result;
    }
}
