<?php

namespace App\Mcp;

use App\Enums\Permission;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Gate;

/**
 * Whether the user may read an entity, decided the way the rest of the app
 * decides it: the model's policy when it has one (viewAny / view),
 * otherwise the `view data` permission that gates the API's read routes.
 */
final class ReadAuthorization
{
    /**
     * @param  class-string<Model>  $model
     */
    public static function mayViewAny(User $user, string $model): bool
    {
        return Gate::getPolicyFor($model) !== null
            ? $user->can('viewAny', $model)
            : $user->hasPermissionTo(Permission::VIEW_DATA->value);
    }

    public static function mayView(User $user, Model $record): bool
    {
        return Gate::getPolicyFor($record) !== null
            ? $user->can('view', $record)
            : $user->hasPermissionTo(Permission::VIEW_DATA->value);
    }
}
