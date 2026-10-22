<?php

namespace App\Providers;

use App\Enums\OAuthScope;
use App\Support\OAuth\AuthorizationCodeClient;
use Carbon\CarbonInterval;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\ServiceProvider;
use Laravel\Passport\Passport;

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
    }
}
