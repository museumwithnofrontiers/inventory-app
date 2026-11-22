<?php

namespace App\Policies;

use App\Enums\Permission;
use App\Enums\Role;
use App\Models\User;

/**
 * Accounts are the user managers' business, and only theirs (Manager of
 * Users, Superadmin). On top of `manage users`:
 *
 * - The superadmin's account is changed by nobody in the panel: its holder
 *   uses their own profile page, and the role moves with user:superadmin.
 * - Another user manager's account is changed by the superadmin only.
 * - Nobody changes their own role, suspends or deletes themselves.
 * - The superadmin role is never given in the panel, and the Manager of
 *   Users role only by the superadmin.
 *
 * The REST API offers none of this: it only reads the signed-in user.
 */
class UserPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo(Permission::MANAGE_USERS->value);
    }

    public function view(User $user, User $record): bool
    {
        return $this->viewAny($user);
    }

    public function create(User $user): bool
    {
        return $this->viewAny($user);
    }

    public function update(User $user, User $record): bool
    {
        return $this->mayChange($user, $record);
    }

    public function delete(User $user, User $record): bool
    {
        return $this->mayChange($user, $record) && ! $user->is($record);
    }

    public function deleteAny(User $user): bool
    {
        return $this->viewAny($user);
    }

    public function approve(User $user, User $record): bool
    {
        return $this->mayChange($user, $record);
    }

    public function suspend(User $user, User $record): bool
    {
        return $this->mayChange($user, $record) && ! $user->is($record);
    }

    public function reactivate(User $user, User $record): bool
    {
        return $this->suspend($user, $record);
    }

    public function resetTwoFactor(User $user, User $record): bool
    {
        return $this->mayChange($user, $record) && ! $user->is($record);
    }

    /**
     * Whether the user may give the record this role (null: take its role away).
     */
    public function assignRole(User $user, User $record, ?Role $role = null): bool
    {
        if (! $this->mayChange($user, $record) || $user->is($record)) {
            return false;
        }

        if ($role === null) {
            return true;
        }

        if (! $role->isAssignableInPanel()) {
            return false;
        }

        return ! $role->managesUsers() || $user->hasPermissionTo(Permission::MANAGE_USER_MANAGERS->value);
    }

    /**
     * The roles the user may give the record, for the role select.
     *
     * @return array<int, Role>
     */
    public function assignableRoles(User $user, User $record): array
    {
        return array_values(array_filter(
            Role::cases(),
            fn (Role $role): bool => $this->assignRole($user, $record, $role),
        ));
    }

    /**
     * The self-registration switch and the pending registrations.
     */
    public function manageRegistrations(User $user): bool
    {
        return $this->viewAny($user);
    }

    private function mayChange(User $user, User $record): bool
    {
        if (! $this->viewAny($user)) {
            return false;
        }

        if ($record->isSuperadmin()) {
            return false;
        }

        if ($record->isUserManager() && ! $user->is($record)) {
            return $user->hasPermissionTo(Permission::MANAGE_USER_MANAGERS->value);
        }

        return true;
    }
}
