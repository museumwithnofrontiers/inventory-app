<?php

namespace App\Support\Authorization;

use App\Models\User;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Laravel\Passport\Passport;

/**
 * Cuts a disabled account off everywhere at once: its panel sessions and its
 * OAuth access tokens, refresh tokens and authorization codes (MCP clients
 * and API apps alike). Called when a user is suspended or deleted.
 *
 * Sessions are only stored where they can be found with the database driver;
 * with any other driver the panel still refuses the account on its next
 * request, since canAccessPanel checks the account state every time.
 */
final class AccessRevoker
{
    /**
     * @return array{sessions: int, access_tokens: int, refresh_tokens: int, auth_codes: int}
     */
    public function revoke(User $user): array
    {
        $userId = $user->getKey();

        $tokenIds = Passport::token()->newQuery()
            ->where('user_id', $userId)
            ->where('revoked', false)
            ->pluck('id');

        $refreshTokens = $tokenIds->isEmpty() ? 0 : Passport::refreshToken()->newQuery()
            ->whereIn('access_token_id', $tokenIds)
            ->where('revoked', false)
            ->update(['revoked' => true]);

        $accessTokens = $tokenIds->isEmpty() ? 0 : Passport::token()->newQuery()
            ->whereIn('id', $tokenIds)
            ->update(['revoked' => true]);

        $authCodes = Passport::authCode()->newQuery()
            ->where('user_id', $userId)
            ->where('revoked', false)
            ->update(['revoked' => true]);

        $sessions = 0;

        if (Config::get('session.driver') === 'database') {
            $table = Config::get('session.table', 'sessions');
            $sessions = DB::connection(Config::get('session.connection'))
                ->table(is_string($table) ? $table : 'sessions')
                ->where('user_id', $userId)
                ->delete();
        }

        return [
            'sessions' => $sessions,
            'access_tokens' => $accessTokens,
            'refresh_tokens' => $refreshTokens,
            'auth_codes' => $authCodes,
        ];
    }
}
