<?php

namespace App\Mcp;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;

/**
 * Whether the user may read an entity, decided the way the rest of the app
 * decides it: the model's policy (viewAny / view). A model without a policy
 * is not readable, as everywhere else; every data model has one
 * (App\Policies\DataPolicy).
 */
final class ReadAuthorization
{
    /**
     * @param  class-string<Model>  $model
     */
    public static function mayViewAny(User $user, string $model): bool
    {
        return $user->can('viewAny', $model);
    }

    public static function mayView(User $user, Model $record): bool
    {
        return $user->can('view', $record);
    }
}
