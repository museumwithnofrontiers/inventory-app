<?php

namespace App\Support\OAuth;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Laravel\Passport\Client;

/**
 * Passport's client, limited to the authorization-code grant (with PKCE for
 * public clients) and the refresh tokens it yields.
 *
 * Passport always enables the client-credentials grant and backs personal
 * access tokens with a grant of their own. A client-credentials token has
 * no user, so it would bypass the permissions and policies; a personal
 * access token is a long-lived bearer token handed out without the OAuth
 * sign-in, which this app no longer issues.
 *
 * The authorization server decides from the client's grant types, which
 * Passport reads from this attribute, so filtering it refuses every other
 * grant whatever a client row says.
 */
class AuthorizationCodeClient extends Client
{
    /**
     * The only grants any client may use.
     */
    public const ALLOWED_GRANTS = ['authorization_code', 'refresh_token'];

    /**
     * @return Attribute<list<string>, never>
     */
    protected function grantTypes(): Attribute
    {
        $declared = parent::grantTypes()->get;

        return Attribute::make(
            get: function (?string $value) use ($declared): array {
                $grants = $declared($value, $this->attributes);

                return array_values(array_intersect(is_array($grants) ? $grants : [], self::ALLOWED_GRANTS));
            },
        );
    }
}
