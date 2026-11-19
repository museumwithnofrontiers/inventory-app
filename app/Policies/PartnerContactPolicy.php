<?php

namespace App\Policies;

use App\Enums\Permission;
use App\Models\PartnerContact;
use App\Models\User;

class PartnerContactPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo(Permission::VIEW_DATA->value);
    }

    public function view(User $user, PartnerContact $partnerContact): bool
    {
        return $this->viewAny($user);
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo(Permission::CREATE_DATA->value);
    }

    public function update(User $user, PartnerContact $partnerContact): bool
    {
        return $user->hasPermissionTo(Permission::UPDATE_DATA->value);
    }

    public function delete(User $user, PartnerContact $partnerContact): bool
    {
        return $user->hasPermissionTo(Permission::DELETE_DATA->value);
    }

    public function deleteAny(User $user): bool
    {
        return $user->hasPermissionTo(Permission::DELETE_DATA->value);
    }
}
