<?php

namespace App\Support\Authorization;

use App\Enums\Permission as PermissionEnum;
use App\Enums\Role as RoleEnum;
use App\Support\Audit\AuditLogger;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/**
 * Makes the roles and permissions in the database exactly what the enums
 * define ({@see RoleEnum}, {@see PermissionEnum}). The seeders, permissions:sync,
 * deploys (scripts/deploy.sh) and the migrations call it, so there is one
 * definition and nothing can drift from it.
 *
 * It never changes which user holds which role. A role the enum no longer
 * defines is removed only when nobody holds it; otherwise sync stops.
 */
final class RoleSync
{
    public const GUARD = 'web';

    /**
     * @return array<int, string> one line per change, empty when nothing changed
     */
    public function sync(): array
    {
        $changes = [];

        DB::transaction(function () use (&$changes): void {
            app(PermissionRegistrar::class)->forgetCachedPermissions();

            $changes = [
                ...$this->syncPermissions(),
                ...$this->syncRoles(),
            ];
        });

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        if ($changes !== []) {
            app(AuditLogger::class)->record('roles.synced', null, ['changes' => $changes], 'Roles and permissions');
        }

        return $changes;
    }

    /**
     * @return array<int, string>
     */
    private function syncPermissions(): array
    {
        $changes = [];

        foreach (PermissionEnum::cases() as $case) {
            $permission = Permission::query()
                ->where('name', $case->value)
                ->where('guard_name', self::GUARD)
                ->first();

            if ($permission === null) {
                Permission::query()->create([
                    'name' => $case->value,
                    'guard_name' => self::GUARD,
                    'description' => $case->description(),
                ]);
                $changes[] = "Created permission [{$case->value}]";
            } elseif ($permission->getAttribute('description') !== $case->description()) {
                $permission->setAttribute('description', $case->description());
                $permission->save();
                $changes[] = "Updated the description of permission [{$case->value}]";
            }
        }

        $obsolete = Permission::query()
            ->where(fn ($query) => $query
                ->whereNotIn('name', PermissionEnum::all())
                ->orWhere('guard_name', '!=', self::GUARD))
            ->get();

        foreach ($obsolete as $permission) {
            $name = (string) $permission->getAttribute('name');
            $permission->delete();
            $changes[] = "Deleted permission [{$name}]";
        }

        return $changes;
    }

    /**
     * @return array<int, string>
     */
    private function syncRoles(): array
    {
        $changes = [];

        foreach (RoleEnum::cases() as $case) {
            /** @var Role|null $role */
            $role = Role::query()
                ->where('name', $case->value)
                ->where('guard_name', self::GUARD)
                ->first();

            if ($role === null) {
                /** @var Role $role */
                $role = Role::query()->create([
                    'name' => $case->value,
                    'guard_name' => self::GUARD,
                    'description' => $case->description(),
                ]);
                $changes[] = "Created role [{$case->value}]";
            } elseif ($role->getAttribute('description') !== $case->description()) {
                $role->setAttribute('description', $case->description());
                $role->save();
                $changes[] = "Updated the description of role [{$case->value}]";
            }

            $current = $role->permissions()->pluck('name')->map(fn ($name): string => (string) $name)->sort()->values()->all();
            $expected = collect($case->permissionNames())->sort()->values()->all();

            if ($current !== $expected) {
                $role->syncPermissions($case->permissionNames());
                $changes[] = "Set the permissions of role [{$case->value}]: ".implode(', ', $expected);
            }
        }

        $known = array_map(fn (RoleEnum $role): string => $role->value, RoleEnum::cases());

        $obsolete = Role::query()
            ->where(fn ($query) => $query
                ->whereNotIn('name', $known)
                ->orWhere('guard_name', '!=', self::GUARD))
            ->withCount('users')
            ->get();

        foreach ($obsolete as $role) {
            $name = (string) $role->getAttribute('name');

            if ((int) $role->getAttribute('users_count') > 0) {
                throw new RuntimeException("The role [{$name}] is not defined in App\\Enums\\Role but users still hold it. Give them a defined role first (php artisan user:set-role).");
            }

            $role->delete();
            $changes[] = "Deleted role [{$name}]";
        }

        return $changes;
    }
}
