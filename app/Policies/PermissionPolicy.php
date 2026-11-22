<?php

namespace App\Policies;

use App\Enums\Permission as PermissionEnum;
use App\Models\User;
use Spatie\Permission\Models\Permission;

/**
 * The permissions are defined in code (App\Enums\Permission). User managers
 * may look at them; nobody creates, renames, attaches or deletes one.
 */
class PermissionPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo(PermissionEnum::MANAGE_USERS->value);
    }

    public function view(User $user, Permission $permission): bool
    {
        return $this->viewAny($user);
    }

    public function create(User $user): bool
    {
        return false;
    }

    public function update(User $user, Permission $permission): bool
    {
        return false;
    }

    public function delete(User $user, Permission $permission): bool
    {
        return false;
    }

    public function deleteAny(User $user): bool
    {
        return false;
    }
}
