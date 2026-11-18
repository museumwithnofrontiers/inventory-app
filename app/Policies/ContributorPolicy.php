<?php

namespace App\Policies;

use App\Models\Collection;
use App\Models\Contributor;
use App\Models\User;

/**
 * A Contributor is part of its collection (M16 I5, #2648), so it has no rule
 * of its own: every check is the collection's, through the existing
 * {@see CollectionPolicy}. Viewing a contributor is viewing its collection;
 * creating, changing or deleting one is updating its collection.
 *
 * Pascal decided this delegation on 2026-11-18, so that the panel's relation
 * managers, which authorize through the host record's policy, work on a
 * Contributor's own screens.
 */
class ContributorPolicy
{
    public function __construct(private readonly CollectionPolicy $collections) {}

    public function viewAny(User $user): bool
    {
        return $this->collections->viewAny($user);
    }

    public function view(User $user, Contributor $contributor): bool
    {
        return $this->collections->view($user, $contributor->collection);
    }

    /**
     * With a collection, whether it may be updated. Without one (the panel's
     * Create button, before a collection is chosen), the same check for a
     * collection not chosen yet; the Create page checks the chosen one again.
     */
    public function create(User $user, ?Collection $collection = null): bool
    {
        return $this->collections->update($user, $collection ?? new Collection);
    }

    public function update(User $user, Contributor $contributor): bool
    {
        return $this->collections->update($user, $contributor->collection);
    }

    public function delete(User $user, Contributor $contributor): bool
    {
        return $this->collections->update($user, $contributor->collection);
    }

    public function deleteAny(User $user): bool
    {
        return $this->collections->update($user, new Collection);
    }
}
