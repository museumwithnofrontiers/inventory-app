<?php

namespace App\Console\Commands;

use App\Enums\Permission as PermissionEnum;
use Illuminate\Console\Command;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class SyncPermissions extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'permissions:sync {--production : Use production role definitions including Visitor role}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Sync permissions and roles from definitions (idempotent, safe for production)';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('Syncing permissions and roles...');

        // Clear cache
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        // Sync permissions
        $this->syncPermissions();

        // Sync roles
        $isProduction = $this->option('production');
        $this->syncRoles($isProduction);

        // Clear cache again after sync
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $this->info('✅ Permissions and roles synced successfully!');

        return 0;
    }

    /**
     * Sync all permissions from the Permission enum.
     */
    protected function syncPermissions(): void
    {
        $this->info('Syncing permissions...');

        $permissions = [
            // Data operation permissions
            PermissionEnum::VIEW_DATA->value => 'Read access to all data models',
            PermissionEnum::CREATE_DATA->value => 'Create new records in data models',
            PermissionEnum::UPDATE_DATA->value => 'Modify existing records',
            PermissionEnum::DELETE_DATA->value => 'Remove records from data models',

            // User management permissions
            PermissionEnum::MANAGE_USERS->value => 'Create, read, update, delete users',
            PermissionEnum::ASSIGN_ROLES->value => 'Grant and revoke user roles',
            PermissionEnum::VIEW_USER_MANAGEMENT->value => 'Access user management interfaces',

            // Role management permissions
            PermissionEnum::MANAGE_ROLES->value => 'Create, read, update roles and permissions',
            PermissionEnum::VIEW_ROLE_MANAGEMENT->value => 'Access role management interfaces',

            // System settings permissions
            PermissionEnum::MANAGE_SETTINGS->value => 'Manage system settings and configuration',
            PermissionEnum::MANAGE_REFERENCE_DATA->value => 'Manage reference-data resources in the Filament administration panel',
            PermissionEnum::ACCESS_ADMIN_PANEL->value => 'Access the Filament administration panel',
            PermissionEnum::ACCESS_MCP->value => 'Browse the inventory through its read-only MCP server',
        ];

        $created = 0;
        $updated = 0;

        foreach ($permissions as $name => $description) {
            $permission = Permission::firstOrNew(['name' => $name]);

            if (! $permission->exists) {
                $permission->description = $description;
                $permission->save();
                $created++;
                $this->line("  ✓ Created permission: {$name}");
            } elseif ($permission->description !== $description) {
                $permission->description = $description;
                $permission->save();
                $updated++;
                $this->line("  ↻ Updated permission: {$name}");
            }
        }

        $total = count($permissions);
        $unchanged = $total - $created - $updated;

        $this->info("Permissions: {$created} created, {$updated} updated, {$unchanged} unchanged (Total: {$total})");
    }

    /**
     * Sync all roles and their permissions.
     */
    protected function syncRoles(bool $includeVisitor = false): void
    {
        $this->info('Syncing roles...');

        $roles = $this->getRoleDefinitions($includeVisitor);

        $created = 0;
        $updated = 0;

        foreach ($roles as $roleDef) {
            $role = Role::firstOrNew(['name' => $roleDef['name']]);

            $isNew = ! $role->exists;

            if ($isNew) {
                $role->description = $roleDef['description'];
                $role->save();
                $created++;
                $this->line("  ✓ Created role: {$roleDef['name']}");
            } elseif ($role->description !== $roleDef['description']) {
                $role->description = $roleDef['description'];
                $role->save();
                $updated++;
                $this->line("  ↻ Updated role: {$roleDef['name']}");
            }

            // Sync permissions (idempotent - always ensures correct state)
            $currentPermissions = $role->permissions->pluck('name')->sort()->values()->toArray();
            $expectedPermissions = collect($roleDef['permissions'])->sort()->values()->toArray();

            if ($currentPermissions !== $expectedPermissions) {
                $role->syncPermissions($roleDef['permissions']);
                if (! $isNew) {
                    $this->line("  ↻ Updated permissions for role: {$roleDef['name']}");
                }
            }
        }

        $total = count($roles);
        $unchanged = $total - $created - $updated;

        $this->info("Roles: {$created} created, {$updated} updated, {$unchanged} unchanged (Total: {$total})");
    }

    /**
     * Get role definitions.
     *
     * @return array<int, array{name: string, description: string, permissions: array<int, string>}>
     */
    protected function getRoleDefinitions(bool $includeVisitor = false): array
    {
        $roles = [
            [
                'name' => 'Non-verified users',
                'description' => 'Self-registered users awaiting verification by administrators',
                'permissions' => [],
            ],
            [
                'name' => 'Regular User',
                'description' => 'Standard user with data operation access',
                'permissions' => [
                    PermissionEnum::VIEW_DATA->value,
                    PermissionEnum::CREATE_DATA->value,
                    PermissionEnum::UPDATE_DATA->value,
                    PermissionEnum::DELETE_DATA->value,

                    // Get access to the Filament "admin" panel and the reference data resources managed there.
                    PermissionEnum::ACCESS_ADMIN_PANEL->value,
                    PermissionEnum::ACCESS_MCP->value,
                    PermissionEnum::MANAGE_REFERENCE_DATA->value,
                ],
            ],
            [
                'name' => 'Manager of Users',
                'description' => 'User and role management access only (no data operations)',
                'permissions' => [
                    // User management permissions
                    PermissionEnum::MANAGE_USERS->value,
                    PermissionEnum::ASSIGN_ROLES->value,
                    PermissionEnum::VIEW_USER_MANAGEMENT->value,

                    // Role management permissions
                    PermissionEnum::MANAGE_ROLES->value,
                    PermissionEnum::VIEW_ROLE_MANAGEMENT->value,

                    // System settings permissions
                    PermissionEnum::MANAGE_SETTINGS->value,
                    PermissionEnum::ACCESS_ADMIN_PANEL->value,
                    PermissionEnum::ACCESS_MCP->value,
                ],
            ],
        ];

        if ($includeVisitor) {
            // Insert Visitor role between Non-verified users and Regular User
            array_splice($roles, 1, 0, [[
                'name' => 'Visitor',
                'description' => 'Read-only access to data (list and show operations only)',
                'permissions' => [
                    PermissionEnum::VIEW_DATA->value,
                    PermissionEnum::ACCESS_ADMIN_PANEL->value,
                    PermissionEnum::ACCESS_MCP->value,
                ],
            ]]);
        }

        return $roles;
    }
}
