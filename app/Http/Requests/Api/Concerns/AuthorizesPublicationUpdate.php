<?php

namespace App\Http\Requests\Api\Concerns;

use App\Models\Publication;
use App\Models\User;

/**
 * For the requests that change what belongs to a publication (its editions,
 * its links to collections, items and tags): they require `update` on the
 * publication, through PublicationPolicy. The route's permission middleware
 * has already run; this adds the record-level check.
 */
trait AuthorizesPublicationUpdate
{
    protected function userMayUpdatePublication(mixed $publication): bool
    {
        $user = $this->user();

        if (! $user instanceof User) {
            return false;
        }

        // No such publication: route binding answers 404, validation 422.
        if (! $publication instanceof Publication) {
            return true;
        }

        return $user->can('update', $publication);
    }
}
