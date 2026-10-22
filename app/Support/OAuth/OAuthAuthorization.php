<?php

namespace App\Support\OAuth;

use App\Enums\OAuthScope;
use App\Enums\Permission;
use App\Models\User;

/**
 * Who may approve an OAuth app, for which scopes. Approving hands the app a
 * token that acts with the user's own permissions, so this only decides
 * whether the user may connect apps at all; what the token can then do is
 * still checked on every request.
 */
final class OAuthAuthorization
{
    /**
     * @param  array<int, string>  $scopes  the scopes the app asks for
     */
    public static function mayAuthorize(User $user, array $scopes): bool
    {
        if (! $user->hasPermissionTo(Permission::ACCESS_ADMIN_PANEL->value)) {
            return false;
        }

        // A token for the MCP server is useless without the permission to use it
        return ! in_array(OAuthScope::MCP->value, $scopes, true)
            || $user->hasPermissionTo(Permission::ACCESS_MCP->value);
    }
}
