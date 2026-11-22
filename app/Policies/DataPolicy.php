<?php

namespace App\Policies;

use App\Enums\Permission;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

/**
 * The rule for inventory data, reference data included: `view data` reads
 * everything (Visitor), and creating, changing and deleting records take the
 * matching permission (Manager of Data). Each data model's policy extends
 * it, so a model always has one, and the panel, the API and the MCP server
 * all ask it.
 *
 * The record is optional on view, update and delete: asked for the model as
 * a whole (an API route that binds no record), the answer is the same rule.
 * A policy whose records follow another record (ContributorPolicy,
 * PublicationDocumentPolicy) overrides the abilities it narrows.
 */
abstract class DataPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo(Permission::VIEW_DATA->value);
    }

    public function view(User $user, ?Model $record = null): bool
    {
        return $this->viewAny($user);
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo(Permission::CREATE_DATA->value);
    }

    public function update(User $user, ?Model $record = null): bool
    {
        return $user->hasPermissionTo(Permission::UPDATE_DATA->value);
    }

    public function delete(User $user, ?Model $record = null): bool
    {
        return $user->hasPermissionTo(Permission::DELETE_DATA->value);
    }

    public function deleteAny(User $user): bool
    {
        return $user->hasPermissionTo(Permission::DELETE_DATA->value);
    }
}
