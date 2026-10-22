<?php

namespace App\Filament\Pages;

use App\Enums\OAuthScope;
use App\Models\User;
use App\Support\OAuth\OAuthAuthorization;
use Filament\Facades\Filament;
use Filament\Pages\Page;
use Illuminate\Contracts\Support\Htmlable;

/**
 * The OAuth consent screen: an app asks to act for the signed-in user with
 * some scopes, and the user approves or denies.
 *
 * Passport validates the request and hands it over through the session
 * (OAuthServiceProvider); this page shows what it was given and posts the
 * answer to Passport's approve and deny routes. Being a panel page, it is
 * reached only after the panel's own login with MFA.
 */
class AuthorizeApplicationPage extends Page
{
    /**
     * Where OAuthServiceProvider leaves the request for this page.
     */
    public const SESSION_KEY = 'oauth.consent';

    protected static ?string $slug = 'oauth/authorize';

    protected static string $view = 'filament.pages.authorize-application-page';

    protected static bool $shouldRegisterNavigation = false;

    public string $clientName = '';

    public string $redirectUri = '';

    public string $authToken = '';

    /** @var array<int, array{id: string, description: string}> */
    public array $scopes = [];

    public function mount(): void
    {
        $consent = session(self::SESSION_KEY);

        abort_unless(is_array($consent), 404);

        $scopeIds = array_values(array_filter(
            is_array($consent['scopes'] ?? null) ? $consent['scopes'] : [],
            is_string(...),
        ));

        /** @var User $user */
        $user = Filament::auth()->user();

        abort_unless(OAuthAuthorization::mayAuthorize($user, $scopeIds), 403);

        $this->clientName = is_string($consent['client_name'] ?? null) ? $consent['client_name'] : '';
        $this->redirectUri = is_string($consent['redirect_uri'] ?? null) ? $consent['redirect_uri'] : '';
        $this->authToken = is_string($consent['auth_token'] ?? null) ? $consent['auth_token'] : '';
        $this->scopes = array_map(fn (string $id): array => [
            'id' => $id,
            'description' => OAuthScope::tryFrom($id)?->description() ?? $id,
        ], $scopeIds);
    }

    public function getTitle(): string|Htmlable
    {
        return __('Authorize :app', ['app' => $this->clientName]);
    }
}
