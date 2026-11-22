<?php

namespace App\Policies;

use App\Enums\Permission;
use App\Models\PublicationEdition;
use App\Models\User;

/**
 * An edition is part of its publication, like its documents
 * ({@see PublicationDocumentPolicy}): reading it is reading the publication,
 * and every change is an update of the publication, through PublicationPolicy.
 */
class PublicationEditionPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo(Permission::VIEW_DATA->value);
    }

    public function view(User $user, ?PublicationEdition $publicationEdition = null): bool
    {
        if ($publicationEdition === null) {
            return $this->viewAny($user);
        }

        return $publicationEdition->publication !== null
            && $user->can('view', $publicationEdition->publication);
    }

    /**
     * Adding an edition updates its publication; the publication itself is
     * checked where it is known (the API request). Without one, the update
     * permission is the floor.
     */
    public function create(User $user): bool
    {
        return $user->hasPermissionTo(Permission::UPDATE_DATA->value);
    }

    public function update(User $user, ?PublicationEdition $publicationEdition = null): bool
    {
        if ($publicationEdition === null) {
            return $user->hasPermissionTo(Permission::UPDATE_DATA->value);
        }

        return $publicationEdition->publication !== null
            && $user->can('update', $publicationEdition->publication);
    }

    public function delete(User $user, ?PublicationEdition $publicationEdition = null): bool
    {
        return $this->update($user, $publicationEdition);
    }

    public function deleteAny(User $user): bool
    {
        return $user->hasPermissionTo(Permission::UPDATE_DATA->value);
    }
}
