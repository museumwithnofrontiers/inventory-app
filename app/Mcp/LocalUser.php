<?php

namespace App\Mcp;

use App\Enums\Permission;
use App\Models\User;
use Illuminate\Support\Facades\Config;
use RuntimeException;

/**
 * The user the local (Artisan, stdio) transport acts as. That transport has
 * no sign-in, so a configured user stands in for one: its permissions and
 * the policies then decide what the session sees, exactly as over HTTP.
 */
final class LocalUser
{
    /**
     * @throws RuntimeException when no usable user is configured; the server
     *                          then refuses to start rather than run unauthenticated
     */
    public static function resolve(): User
    {
        $email = Config::get('mcp.local_user');

        if (! is_string($email) || $email === '') {
            throw new RuntimeException('Set MCP_LOCAL_USER to the e-mail of the user the local MCP server acts as.');
        }

        $user = User::query()->where('email', $email)->first();

        if ($user === null) {
            throw new RuntimeException("MCP_LOCAL_USER names no user: [{$email}].");
        }

        if (! $user->hasPermissionTo(Permission::ACCESS_MCP->value)) {
            throw new RuntimeException("The user [{$email}] lacks the access-mcp permission.");
        }

        return $user;
    }
}
