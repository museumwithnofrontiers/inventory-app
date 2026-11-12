<?php

namespace Tests\Api\Fixtures;

use App\Models\Publication;
use App\Models\User;

/**
 * A stand-in for PublicationPolicy that allows reading and refuses every
 * update, to show that the publication's own policy decides the changes
 * made through it, not only the route's permission.
 */
class DenyingPublicationPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Publication $publication): bool
    {
        return true;
    }

    public function update(User $user, Publication $publication): bool
    {
        return false;
    }
}
