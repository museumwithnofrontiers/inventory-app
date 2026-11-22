<?php

namespace Tests\Filament\Pages;

use App\Enums\OAuthScope;
use App\Enums\Permission;
use App\Filament\Auth\Login as AdminLogin;
use App\Filament\Auth\TwoFactorChallenge;
use App\Filament\Pages\AuthorizeApplicationPage;
use App\Models\Item;
use App\Models\User;
use Filament\Facades\Filament;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Passport\Client;
use Laravel\Passport\ClientRepository;
use Livewire\Livewire;
use Tests\TestCase;
use Tests\Traits\CreatesTwoFactorUsers;
use Tests\Traits\IssuesOAuthTokens;

/**
 * The browser side of OAuth: an app sends the user to Passport, the user
 * signs in on the panel (with MFA), approves on the consent page, and the
 * app exchanges the code for a token.
 */
class OAuthAuthorizationFlowTest extends TestCase
{
    use CreatesTwoFactorUsers;
    use IssuesOAuthTokens;
    use RefreshDatabase;

    private Client $client;

    private string $verifier;

    protected function setUp(): void
    {
        parent::setUp();

        Filament::setCurrentPanel(Filament::getPanel('admin'));
        $this->client = $this->createPublicOAuthClient('Claude');
        $this->verifier = Str::random(64);
    }

    public function test_a_signed_out_user_signs_in_with_mfa_approves_and_the_app_reads_the_api(): void
    {
        $user = $this->createUserWithTotp(['email_verified_at' => now()]);
        $user->givePermissionTo([Permission::ACCESS_ADMIN_PANEL->value, Permission::VIEW_DATA->value]);
        Item::factory()->create();
        $authorizeUrl = $this->oauthAuthorizeUrl($this->client, $this->verifier, ['scope' => OAuthScope::API_READ->value]);

        // Passport sends the signed-out user to the panel's login
        $this->get($authorizeUrl)->assertRedirect(route('login'));
        $this->get(route('login'))->assertRedirect(route('filament.admin.auth.login'));

        // The panel's login and MFA challenge return to the request
        Livewire::test(AdminLogin::class)
            ->set('data.email', $user->email)
            ->set('data.password', 'password')
            ->call('authenticate')
            ->assertRedirect(route('filament.admin.auth.two-factor-challenge'));
        $this->mockTotpProvider(true);
        Livewire::test(TwoFactorChallenge::class)
            ->set('data.code', '123456')
            ->call('submit')
            ->assertRedirect($authorizeUrl);

        // Passport validates the request and hands it to the consent page
        $this->get($authorizeUrl)->assertRedirect(AuthorizeApplicationPage::getUrl());
        $this->get(AuthorizeApplicationPage::getUrl())
            ->assertOk()
            ->assertSee('Claude')
            ->assertSee(OAuthScope::API_READ->description())
            ->assertSee($this->oauthRedirectUri);

        // Approving returns a code to the app
        $location = (string) $this->approveCurrentOAuthRequest()->headers->get('Location');
        $this->assertStringStartsWith($this->oauthRedirectUri, $location);
        $this->assertSame('test-state', $this->oauthCallbackQuery($location)['state'] ?? null);

        // The app exchanges it with its PKCE verifier and reads the API
        $token = $this->post(route('passport.token'), [
            'grant_type' => 'authorization_code',
            'client_id' => (string) $this->client->getKey(),
            'redirect_uri' => $this->oauthRedirectUri,
            'code_verifier' => $this->verifier,
            'code' => $this->oauthCodeFrom($location),
        ])->assertOk()->json('access_token');
        $this->forgetBearerGuards();

        $this->withToken($token)->getJson(route('item.index'))->assertOk();
        $this->withToken($token)->postJson(route('item.store'), ['internal_name' => 'x'])->assertForbidden();
    }

    public function test_denying_returns_access_denied_to_the_app(): void
    {
        $this->actingAs($this->panelUser());
        $this->get($this->oauthAuthorizeUrl($this->client, $this->verifier, ['scope' => OAuthScope::API_READ->value]));

        $consent = session(AuthorizeApplicationPage::SESSION_KEY);
        $location = (string) $this->delete(route('passport.authorizations.deny'), [
            'auth_token' => is_array($consent) ? $consent['auth_token'] : '',
        ])->headers->get('Location');

        $this->assertStringStartsWith($this->oauthRedirectUri, $location);
        $this->assertSame('access_denied', $this->oauthCallbackQuery($location)['error'] ?? null);
    }

    public function test_a_user_without_panel_access_cannot_reach_the_consent_page(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        $this->get($this->oauthAuthorizeUrl($this->client, $this->verifier));

        $this->get(AuthorizeApplicationPage::getUrl())->assertForbidden();
    }

    public function test_the_consent_page_needs_a_pending_request(): void
    {
        $this->actingAs($this->panelUser());

        $this->get(AuthorizeApplicationPage::getUrl())->assertNotFound();
    }

    public function test_approving_without_the_consent_page_token_issues_nothing(): void
    {
        $this->actingAs($this->panelUser());
        $this->get($this->oauthAuthorizeUrl($this->client, $this->verifier));

        $this->post(route('passport.authorizations.approve'), ['auth_token' => 'guessed'])
            ->assertHeaderMissing('Location');
    }

    public function test_signing_in_never_leaves_the_panel(): void
    {
        $login = $this->get($this->oauthAuthorizeUrl($this->client, $this->verifier))->headers->get('Location');
        $panelLogin = $this->get((string) $login)->headers->get('Location');

        $this->assertSame(route('filament.admin.auth.login'), $panelLogin);
        $this->assertStringNotContainsString('/web', (string) $panelLogin);
    }

    public function test_an_app_approved_before_still_goes_through_the_consent_page(): void
    {
        $user = $this->panelUser();
        $this->issueOAuthToken($user, $this->client, OAuthScope::API_READ->value);

        $this->get($this->oauthAuthorizeUrl($this->client, $this->verifier, ['scope' => OAuthScope::API_READ->value]))
            ->assertRedirect(AuthorizeApplicationPage::getUrl());
    }

    public function test_a_user_whose_mfa_was_reset_gets_no_code_for_an_app_approved_before(): void
    {
        $user = $this->panelUser();
        $this->issueOAuthToken($user, $this->client, OAuthScope::API_READ->value);
        $user->forceFill(['two_factor_secret' => null, 'two_factor_confirmed_at' => null])->save();

        $this->get($this->oauthAuthorizeUrl($this->client, $this->verifier, ['scope' => OAuthScope::API_READ->value]))
            ->assertRedirect(AuthorizeApplicationPage::getUrl());
        $this->get(AuthorizeApplicationPage::getUrl())
            ->assertRedirect(route('filament.admin.auth.two-factor-setup'));
    }

    public function test_a_confidential_client_must_send_a_pkce_challenge(): void
    {
        $confidential = app(ClientRepository::class)
            ->createAuthorizationCodeGrantClient('Server app', [$this->oauthRedirectUri], true);
        $this->actingAs($this->panelUser());

        $response = $this->get($this->oauthAuthorizeUrl($confidential, $this->verifier, [
            'code_challenge' => '',
            'code_challenge_method' => '',
        ]));

        $response->assertStatus(400);
        $this->assertSame('invalid_request', $response->json('error'));
        $this->assertNull(session(AuthorizeApplicationPage::SESSION_KEY));

        // With a challenge, it reaches the consent page like any client
        $this->get($this->oauthAuthorizeUrl($confidential, $this->verifier))
            ->assertRedirect(AuthorizeApplicationPage::getUrl());
    }

    public function test_the_plain_pkce_method_is_refused(): void
    {
        $this->actingAs($this->panelUser());

        $response = $this->get($this->oauthAuthorizeUrl($this->client, $this->verifier, [
            'code_challenge' => $this->verifier,
            'code_challenge_method' => 'plain',
        ]));

        $response->assertStatus(400);
        $this->assertSame('invalid_request', $response->json('error'));
    }

    private function panelUser(): User
    {
        $user = User::factory()->create();
        $user->givePermissionTo(Permission::ACCESS_ADMIN_PANEL->value);

        return $user;
    }
}
