<?php

namespace App\Policies;

use App\Enums\Permission;
use App\Models\PublicationDocument;
use App\Models\User;

/**
 * A publication's document is part of the publication: reading it is
 * reading the publication, and every change is an update of the
 * publication, through PublicationPolicy.
 */
class PublicationDocumentPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo(Permission::VIEW_DATA->value);
    }

    public function view(User $user, PublicationDocument $publicationDocument): bool
    {
        return $publicationDocument->publication !== null
            && $user->can('view', $publicationDocument->publication);
    }

    /**
     * Creating a document updates its publication. The publication itself is
     * checked where it is known (the API request, the relation manager's
     * owner record); without one, the update permission is the floor.
     */
    public function create(User $user): bool
    {
        return $user->hasPermissionTo(Permission::UPDATE_DATA->value);
    }

    public function update(User $user, PublicationDocument $publicationDocument): bool
    {
        return $publicationDocument->publication !== null
            && $user->can('update', $publicationDocument->publication);
    }

    public function delete(User $user, PublicationDocument $publicationDocument): bool
    {
        return $this->update($user, $publicationDocument);
    }

    public function deleteAny(User $user): bool
    {
        return $user->hasPermissionTo(Permission::UPDATE_DATA->value);
    }
}
