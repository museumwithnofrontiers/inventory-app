<?php

namespace App\Policies;

use App\Enums\Permission;
use App\Mcp\ReadAuthorization;
use App\Models\Artist;
use App\Models\User;

/**
 * Artists are shared documentation linked to items. They are managed like
 * the other shared data (TagPolicy, AuthorPolicy, GlossaryPolicy): creating,
 * changing and deleting one takes `manage-reference-data`.
 *
 * Reading is the same as before this policy existed. With no policy, the MCP
 * server ({@see ReadAuthorization}) and the item's Artists relation
 * manager let anyone with `view data` read an artist. A reference-data user
 * may also read them, since they manage them.
 */
class ArtistPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo(Permission::VIEW_DATA->value)
            || $user->hasPermissionTo(Permission::MANAGE_REFERENCE_DATA->value);
    }

    public function view(User $user, Artist $artist): bool
    {
        return $this->viewAny($user);
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo(Permission::MANAGE_REFERENCE_DATA->value);
    }

    public function update(User $user, Artist $artist): bool
    {
        return $this->create($user);
    }

    public function delete(User $user, Artist $artist): bool
    {
        return $this->create($user);
    }

    public function deleteAny(User $user): bool
    {
        return $this->create($user);
    }
}
