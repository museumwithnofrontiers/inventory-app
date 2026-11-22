<?php

use App\Enums\Role as RoleEnum;
use App\Models\User;
use App\Support\Audit\AuditLogger;
use App\Support\Authorization\RoleSync;
use App\Support\Authorization\UserRoles;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/**
 * Four roles defined in code, one role per user (App\Enums\Role).
 *
 * - "Regular User" becomes "Manager of Data".
 * - Permissions given to a user directly are removed: only roles carry them.
 * - A user who held several roles keeps the highest one (Superadmin, Manager
 *   of Users, Manager of Data, Visitor). "Non-verified users" carried no
 *   permission and is removed; its holders keep no role.
 * - The permissions and roles then match the enums exactly (RoleSync).
 * - The superadmin is the first Manager of Users ever created, when no one
 *   holds the role yet. php artisan user:superadmin moves it afterwards.
 * - A unique index makes one role per user a database rule.
 *
 * Every change is written to the audit log. The conversion cannot be undone;
 * down() only drops the unique index.
 */
return new class extends Migration
{
    private const INDEX = 'model_has_roles_one_role_per_model_unique';

    public function up(): void
    {
        $tables = Config::array('permission.table_names');
        $rolesTable = is_string($tables['roles'] ?? null) ? $tables['roles'] : 'roles';
        $modelHasRoles = is_string($tables['model_has_roles'] ?? null) ? $tables['model_has_roles'] : 'model_has_roles';
        $modelHasPermissions = is_string($tables['model_has_permissions'] ?? null) ? $tables['model_has_permissions'] : 'model_has_permissions';

        if (! Schema::hasTable($rolesTable) || ! Schema::hasTable($modelHasRoles)) {
            return;
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $this->renameRegularUser();
        $this->removeDirectUserPermissions($modelHasPermissions);
        $this->keepOneRolePerUser();

        app(RoleSync::class)->sync();

        $this->appointSuperadmin();

        Schema::table($modelHasRoles, function (Blueprint $table) {
            $table->unique(['model_type', 'model_id'], self::INDEX);
        });

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        $tables = Config::array('permission.table_names');
        $modelHasRoles = is_string($tables['model_has_roles'] ?? null) ? $tables['model_has_roles'] : 'model_has_roles';

        if (Schema::hasIndex($modelHasRoles, self::INDEX)) {
            Schema::table($modelHasRoles, function (Blueprint $table) {
                $table->dropUnique(self::INDEX);
            });
        }
    }

    private function renameRegularUser(): void
    {
        $old = Role::query()->where('name', 'Regular User')->first();

        if ($old === null) {
            return;
        }

        $new = Role::query()->where('name', RoleEnum::DATA_MANAGER->value)->first();

        if ($new === null) {
            $old->setAttribute('name', RoleEnum::DATA_MANAGER->value);
            $old->save();

            return;
        }

        // Both exist: the holders of the old role move to the new one
        User::query()->whereHas('roles', fn ($query) => $query->where('name', 'Regular User'))->get()->each(function (User $user) use ($new): void {
            $user->assignRole($new);
        });
        $old->delete();
    }

    private function removeDirectUserPermissions(string $table): void
    {
        if (! Schema::hasTable($table)) {
            return;
        }

        $logger = app(AuditLogger::class);

        User::query()
            ->whereHas('permissions')
            ->with('permissions')
            ->get()
            ->each(function (User $user) use ($logger): void {
                $names = $user->permissions->pluck('name')->map(fn ($name): string => (string) $name)->sort()->values()->all();
                $user->syncPermissions([]);
                $logger->record('user.direct_permissions_removed', $user, ['permissions' => $names]);
            });
    }

    private function keepOneRolePerUser(): void
    {
        $roles = app(UserRoles::class);

        User::query()->whereHas('roles')->with('roles')->get()->each(function (User $user) use ($roles): void {
            $known = $user->roles
                ->map(fn (Role $role): ?RoleEnum => RoleEnum::tryFrom((string) $role->getAttribute('name')))
                ->filter()
                ->sortByDesc(fn (RoleEnum $role): int => $role->rank())
                ->values();

            if ($user->roles->count() === 1 && $known->count() === 1) {
                return;
            }

            $keep = $known->first();

            if ($keep === null) {
                $roles->clear($user);

                return;
            }

            // Superadmin is unique: a second holder (impossible so far) stays a user manager
            if ($keep === RoleEnum::SUPERADMIN && $roles->superadmin() !== null && ! $roles->superadmin()->is($user)) {
                $keep = RoleEnum::USER_MANAGER;
            }

            $user->syncRoles([$keep->value]);
            $user->unsetRelation('roles');
        });
    }

    private function appointSuperadmin(): void
    {
        $roles = app(UserRoles::class);

        if ($roles->superadmin() !== null) {
            return;
        }

        $first = User::query()
            ->whereHas('roles', fn ($query) => $query->where('name', RoleEnum::USER_MANAGER->value))
            ->orderBy('created_at')
            ->orderBy('id')
            ->first();

        if ($first !== null) {
            DB::transaction(fn () => $roles->transferSuperadmin($first));
        }
    }
};
