<?php

namespace App\Enums;

/**
 * Central definition of all system permissions.
 *
 * Permissions are the inputs of the policies (App\Policies\*), which are the
 * only place that decides access, on the panel, the REST API and the MCP
 * server alike. Users never hold a permission directly: they hold exactly one
 * role ({@see Role}), and the role carries the permissions.
 */
enum Permission: string
{
    // Data: read everything, then create, change and delete records
    case VIEW_DATA = 'view data';
    case CREATE_DATA = 'create data';
    case UPDATE_DATA = 'update data';
    case DELETE_DATA = 'delete data';

    // Accounts: users, their role, the self-registration switch, the audit log
    case MANAGE_USERS = 'manage users';

    // Accounts of the other user managers (the superadmin only)
    case MANAGE_USER_MANAGERS = 'manage user managers';

    // Filament admin panel access
    case ACCESS_ADMIN_PANEL = 'access-admin-panel';

    // Read-only inventory MCP server (/mcp/inventory, php artisan mcp:start inventory)
    case ACCESS_MCP = 'access-mcp';

    /**
     * Get all permission values as an array
     *
     * @return array<int, string>
     */
    public static function all(): array
    {
        return array_map(fn (self $permission) => $permission->value, self::cases());
    }

    /**
     * Get data operation permissions
     *
     * @return array<int, string>
     */
    public static function dataOperations(): array
    {
        return [
            self::VIEW_DATA->value,
            self::CREATE_DATA->value,
            self::UPDATE_DATA->value,
            self::DELETE_DATA->value,
        ];
    }

    /**
     * Get sensitive permissions that require MFA
     *
     * @return array<int, string>
     */
    public static function sensitivePermissions(): array
    {
        return [
            self::MANAGE_USERS->value,
            self::MANAGE_USER_MANAGERS->value,
            self::ACCESS_ADMIN_PANEL->value,
        ];
    }

    public function description(): string
    {
        return match ($this) {
            self::VIEW_DATA => 'Read all inventory data',
            self::CREATE_DATA => 'Create inventory records',
            self::UPDATE_DATA => 'Change inventory records',
            self::DELETE_DATA => 'Delete inventory records',
            self::MANAGE_USERS => 'Manage user accounts and their role, and read the audit log',
            self::MANAGE_USER_MANAGERS => 'Manage the accounts of the other user managers',
            self::ACCESS_ADMIN_PANEL => 'Access the Filament administration panel',
            self::ACCESS_MCP => 'Browse the inventory through its read-only MCP server',
        };
    }
}
