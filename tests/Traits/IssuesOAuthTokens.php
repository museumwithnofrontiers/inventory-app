<?php

namespace Tests\Traits;

use App\Filament\Pages\AuthorizeApplicationPage;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Laravel\Passport\Client;
use Laravel\Passport\ClientRepository;
use RuntimeException;

/**
 * Real OAuth tokens, obtained the way an app gets them: authorization code
 * with PKCE through Passport's routes and the panel's consent page.
 */
trait IssuesOAuthTokens
{
    protected string $oauthRedirectUri = 'http://localhost/oauth-callback';

    protected function createPublicOAuthClient(string $name = 'Test app'): Client
    {
        return app(ClientRepository::class)->createAuthorizationCodeGrantClient($name, [$this->oauthRedirectUri], false);
    }

    /**
     * The URL an app sends the user to. The query is sorted the way Laravel
     * normalises it, so it matches the intended URL stored on login.
     *
     * @param  array<string, string>  $overrides
     */
    protected function oauthAuthorizeUrl(Client $client, string $verifier, array $overrides = []): string
    {
        $query = array_merge([
            'client_id' => (string) $client->getKey(),
            'redirect_uri' => $this->oauthRedirectUri,
            'response_type' => 'code',
            'scope' => '',
            'state' => 'test-state',
            'code_challenge' => strtr(rtrim(base64_encode(hash('sha256', $verifier, true)), '='), '+/', '-_'),
            'code_challenge_method' => 'S256',
        ], $overrides);
        ksort($query);

        return route('passport.authorizations.authorize').'?'.http_build_query($query, '', '&', PHP_QUERY_RFC3986);
    }

    /**
     * Signs the user in on the web guard, approves the app for the scope and
     * returns the access token. The user stays signed in on the web guard.
     *
     * Call forgetBearerGuards() before using the token: the api guard keeps
     * the first user it resolves for the rest of the test. Never forget the
     * guards before issuing a token, though: the route keeps Passport's
     * controller, and with it the web guard it was built with.
     */
    protected function issueOAuthToken(User $user, Client $client, string $scope): string
    {
        $verifier = Str::random(64);
        $this->actingAs($user, 'web');

        $response = $this->get($this->oauthAuthorizeUrl($client, $verifier, ['scope' => $scope]));
        $location = (string) $response->headers->get('Location');

        // An app approved before for the same scopes is not asked again
        if (! str_starts_with($location, $this->oauthRedirectUri)) {
            $consent = session(AuthorizeApplicationPage::SESSION_KEY);
            $authToken = is_array($consent) && is_string($consent['auth_token'] ?? null) ? $consent['auth_token'] : '';
            $location = (string) $this->post(route('passport.authorizations.approve'), ['auth_token' => $authToken])
                ->headers->get('Location');
        }

        $token = $this->post(route('passport.token'), [
            'grant_type' => 'authorization_code',
            'client_id' => (string) $client->getKey(),
            'redirect_uri' => $this->oauthRedirectUri,
            'code_verifier' => $verifier,
            'code' => $this->oauthCodeFrom($location),
        ])->assertOk()->json('access_token');

        if (! is_string($token)) {
            throw new RuntimeException('The token endpoint returned no access token.');
        }

        return $token;
    }

    /**
     * @return array<string, string>
     */
    protected function oauthCallbackQuery(string $location): array
    {
        parse_str((string) parse_url($location, PHP_URL_QUERY), $query);

        /** @var array<string, string> $query */
        return $query;
    }

    protected function oauthCodeFrom(string $location): string
    {
        $code = $this->oauthCallbackQuery($location)['code'] ?? null;

        if (! is_string($code) || $code === '') {
            throw new RuntimeException("No authorization code in [{$location}].");
        }

        return $code;
    }

    /**
     * A fresh api guard, so the next request resolves its own bearer token.
     */
    protected function forgetBearerGuards(): void
    {
        Auth::forgetGuards();
    }

    protected function approveCurrentOAuthRequest(): TestResponse
    {
        $consent = session(AuthorizeApplicationPage::SESSION_KEY);
        $authToken = is_array($consent) && is_string($consent['auth_token'] ?? null) ? $consent['auth_token'] : '';

        return $this->post(route('passport.authorizations.approve'), ['auth_token' => $authToken]);
    }
}
