<?php

namespace App\Providers;

use App\Enums\OAuthScope;
use App\Filament\Pages\AuthorizeApplicationPage;
use App\Support\OAuth\AuthorizationCodeClient;
use Carbon\CarbonInterval;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\ServiceProvider;
use Laravel\Passport\Client;
use Laravel\Passport\Passport;
use Laravel\Passport\Scope;

/**
 * The OAuth 2.1 authorization server (Passport): the only way to obtain a
 * token for this app. Authorization code with PKCE is the only grant; see
 * AuthorizationCodeClient for how the others are refused.
 */
class OAuthServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Read when Passport loads its routes and builds the server, so it
        // must be set before Passport boots
        Passport::$deviceCodeGrantEnabled = false;
    }

    public function boot(): void
    {
        Passport::useClientModel(AuthorizationCodeClient::class);

        Passport::tokensCan(OAuthScope::descriptions());

        Passport::tokensExpireIn(CarbonInterval::minutes(Config::integer('passport.access_token_minutes')));
        Passport::refreshTokensExpireIn(CarbonInterval::days(Config::integer('passport.refresh_token_days')));

        // Passport has validated the request and the user is signed in on the
        // panel: the consent screen is a panel page, handed what to show
        Passport::authorizationView(fn (array $parameters): RedirectResponse => $this->toConsentPage($parameters));
    }

    /**
     * @param  array<string, mixed>  $parameters  what Passport gives its authorization view
     */
    protected function toConsentPage(array $parameters): RedirectResponse
    {
        $client = $parameters['client'] ?? null;
        $scopes = is_array($parameters['scopes'] ?? null) ? $parameters['scopes'] : [];
        $request = $parameters['request'] ?? null;

        session()->put(AuthorizeApplicationPage::SESSION_KEY, [
            'client_name' => $client instanceof Client ? $client->name : '',
            'scopes' => array_values(array_map(fn (mixed $scope): string => $scope instanceof Scope ? $scope->id : '', $scopes)),
            'redirect_uri' => $request instanceof Request ? $request->string('redirect_uri')->toString() : '',
            'auth_token' => is_string($parameters['authToken'] ?? null) ? $parameters['authToken'] : '',
        ]);

        return redirect()->to(AuthorizeApplicationPage::getUrl(panel: 'admin'));
    }
}
