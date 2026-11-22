<?php

namespace App\Enums;

use App\Support\Authorization\RoleSync;

/**
 * The roles, defined here and nowhere else. The seeders, permissions:sync and
 * the migrations all read this enum ({@see RoleSync}),
 * so the database cannot drift from it, and the panel only shows the roles.
 *
 * A user holds exactly one role, or none (no access at all). The database
 * enforces it with a unique index on model_has_roles.
 */
enum Role: string
{
    // Reads everything, changes nothing
    case VISITOR = 'Visitor';

    // Reads and changes all inventory data; no accounts
    case DATA_MANAGER = 'Manager of Data';

    // Break-glass: accounts and their role, nothing else
    case USER_MANAGER = 'Manager of Users';

    // The one user manager the others cannot touch; manages them too
    case SUPERADMIN = 'Superadmin';

    public function description(): string
    {
        return match ($this) {
            self::VISITOR => 'Reads all inventory data; changes nothing',
            self::DATA_MANAGER => 'Reads and changes all inventory data; no access to accounts',
            self::USER_MANAGER => 'Manages user accounts and their role; no access to inventory data',
            self::SUPERADMIN => 'Manages user accounts, the other user managers included; no access to inventory data. Exactly one user holds it',
        };
    }

    /**
     * @return array<int, Permission>
     */
    public function permissions(): array
    {
        $entry = [Permission::ACCESS_ADMIN_PANEL, Permission::ACCESS_MCP];

        return match ($this) {
            self::VISITOR => [Permission::VIEW_DATA, ...$entry],
            self::DATA_MANAGER => [
                Permission::VIEW_DATA,
                Permission::CREATE_DATA,
                Permission::UPDATE_DATA,
                Permission::DELETE_DATA,
                ...$entry,
            ],
            self::USER_MANAGER => [Permission::MANAGE_USERS, ...$entry],
            self::SUPERADMIN => [Permission::MANAGE_USERS, Permission::MANAGE_USER_MANAGERS, ...$entry],
        };
    }

    /**
     * @return array<int, string>
     */
    public function permissionNames(): array
    {
        return array_map(fn (Permission $permission): string => $permission->value, $this->permissions());
    }

    /**
     * Whether a user manager may give this role in the panel. The superadmin
     * role is only ever moved with `php artisan user:superadmin`.
     */
    public function isAssignableInPanel(): bool
    {
        return $this !== self::SUPERADMIN;
    }

    /**
     * Whether holding this role makes the user a user manager, whose account
     * only the superadmin may change.
     */
    public function managesUsers(): bool
    {
        return $this === self::USER_MANAGER || $this === self::SUPERADMIN;
    }

    /**
     * Order used when an old account held several roles: the highest wins.
     */
    public function rank(): int
    {
        return match ($this) {
            self::VISITOR => 1,
            self::DATA_MANAGER => 2,
            self::USER_MANAGER => 3,
            self::SUPERADMIN => 4,
        };
    }

    /**
     * @return array<string, string>
     */
    public static function options(): array
    {
        $options = [];

        foreach (self::cases() as $role) {
            $options[$role->value] = $role->value;
        }

        return $options;
    }
}
