<?php

namespace App\Enums;

/**
 * Central definition of all system permissions.
 * All permission checks must use these constants to ensure consistency.
 */
enum Permission: string
{
    // Data operation permissions
    case VIEW_DATA = 'view data';
    case CREATE_DATA = 'create data';
    case UPDATE_DATA = 'update data';
    case DELETE_DATA = 'delete data';

    // User management permissions
    case MANAGE_USERS = 'manage users';
    case ASSIGN_ROLES = 'assign roles';
    case VIEW_USER_MANAGEMENT = 'view user management';

    // Role management permissions
    case MANAGE_ROLES = 'manage roles';
    case VIEW_ROLE_MANAGEMENT = 'view role management';

    // System settings permissions
    case MANAGE_SETTINGS = 'manage settings';

    // Reference data management
    case MANAGE_REFERENCE_DATA = 'manage-reference-data';

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
     * Get user management permissions
     *
     * @return array<int, string>
     */
    public static function userManagement(): array
    {
        return [
            self::MANAGE_USERS->value,
            self::ASSIGN_ROLES->value,
            self::VIEW_USER_MANAGEMENT->value,
        ];
    }

    /**
     * Get role management permissions
     *
     * @return array<int, string>
     */
    public static function roleManagement(): array
    {
        return [
            self::MANAGE_ROLES->value,
            self::VIEW_ROLE_MANAGEMENT->value,
            self::ACCESS_ADMIN_PANEL->value,
        ];
    }

    /**
     * Get administrative permissions (user + role management + settings)
     *
     * @return array<int, string>
     */
    public static function administrative(): array
    {
        return array_merge(
            self::userManagement(),
            self::roleManagement(),
            [
                self::MANAGE_SETTINGS->value,
                self::ACCESS_ADMIN_PANEL->value,
            ]
        );
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
            self::MANAGE_ROLES->value,
            self::ASSIGN_ROLES->value,
            self::MANAGE_SETTINGS->value,
            self::ACCESS_ADMIN_PANEL->value,
        ];
    }
}
