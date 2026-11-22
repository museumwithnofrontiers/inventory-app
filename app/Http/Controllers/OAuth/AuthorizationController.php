<?php

namespace App\Http\Controllers\OAuth;

use App\Filament\Pages\AuthorizeApplicationPage;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Http\Request;
use Laravel\Passport\Client;
use Laravel\Passport\Contracts\AuthorizationViewResponse;
use Laravel\Passport\Exceptions\OAuthServerException;
use Laravel\Passport\Http\Controllers\AuthorizationController as PassportAuthorizationController;
use Laravel\Passport\Scope;
use League\OAuth2\Server\Exception\OAuthServerException as LeagueOAuthServerException;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Symfony\Component\HttpFoundation\Response;

/**
 * Passport's `GET /oauth/authorize`, with two OAuth 2.1 rules Passport leaves
 * out. The container hands this class to Passport's route
 * (OAuthServiceProvider).
 *
 * - Every client sends a PKCE challenge, with S256. The OAuth server
 *   requires one from public clients only, and also accepts `plain`.
 * - Every request goes through the consent page. Passport issues the code
 *   straight away when the user already holds a token for the client and the
 *   scopes. Its route carries only the `web` middleware, so that would skip
 *   the panel's own checks: account state, panel access and MFA enrolment.
 *   The consent page is a panel page ({@see AuthorizeApplicationPage}), so
 *   the panel applies its rules there, as it does everywhere else.
 */
class AuthorizationController extends PassportAuthorizationController
{
    public function authorize(
        ServerRequestInterface $psrRequest,
        Request $request,
        ResponseInterface $psrResponse,
        AuthorizationViewResponse $viewResponse
    ): Response|AuthorizationViewResponse {
        if (! is_string($request->query('code_challenge')) || $request->query('code_challenge_method') !== 'S256') {
            throw new OAuthServerException(LeagueOAuthServerException::invalidRequest(
                'code_challenge',
                'Every client must send a PKCE code challenge with the S256 method.'
            ));
        }

        return parent::authorize($psrRequest, $request, $psrResponse, $viewResponse);
    }

    /**
     * Never treat an earlier approval as consent: the panel's consent page
     * decides every time.
     *
     * @param  Scope[]  $scopes
     */
    protected function hasGrantedScopes(Authenticatable $user, Client $client, array $scopes): bool
    {
        return false;
    }
}
