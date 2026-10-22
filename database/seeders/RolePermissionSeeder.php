<?php

namespace Database\Seeders;

use App\Enums\Permission as PermissionEnum;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolePermissionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Reset cached roles and permissions
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        // Create permissions
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

        foreach ($permissions as $name => $description) {
            Permission::firstOrCreate(
                ['name' => $name],
                ['description' => $description]
            );
        }

        // Create "Non-verified users" role with no permissions
        $nonVerifiedRole = Role::firstOrCreate(
            ['name' => 'Non-verified users'],
            ['description' => 'Self-registered users awaiting verification by administrators']
        );

        // Non-verified users get no permissions - they cannot do anything until verified
        $nonVerifiedRole->syncPermissions([]);

        // Create "Visitor" role with read-only data access
        $visitorRole = Role::firstOrCreate(
            ['name' => 'Visitor'],
            ['description' => 'Read-only access to data (list and show operations only)']
        );

        $visitorRole->syncPermissions([
            PermissionEnum::VIEW_DATA->value,
            PermissionEnum::ACCESS_ADMIN_PANEL->value,
            PermissionEnum::ACCESS_MCP->value,
        ]);

        // Create "Regular User" role with data operation permissions
        $regularUserRole = Role::firstOrCreate(
            ['name' => 'Regular User'],
            ['description' => 'Standard user with data operation access']
        );

        $regularUserRole->syncPermissions([
            PermissionEnum::VIEW_DATA->value,
            PermissionEnum::CREATE_DATA->value,
            PermissionEnum::UPDATE_DATA->value,
            PermissionEnum::DELETE_DATA->value,
            PermissionEnum::ACCESS_ADMIN_PANEL->value,
            PermissionEnum::ACCESS_MCP->value,
            PermissionEnum::MANAGE_REFERENCE_DATA->value,
        ]);

        // Create "Manager of Users" role with only user/role management permissions
        $managerRole = Role::firstOrCreate(
            ['name' => 'Manager of Users'],
            ['description' => 'User and role management access only (no data operations)']
        );

        $managerRole->syncPermissions([
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
        ]);

        $this->command?->info('Roles and permissions created successfully!');
        $this->command?->info('Created roles: Non-verified users, Visitor, Regular User, Manager of Users');
        $this->command?->info('Created '.count($permissions).' permissions');
    }
}
