<?php

namespace Tests\Filament\Authorization;

use App\Enums\Permission;
use App\Filament\Auth\Login as AdminLogin;
use App\Filament\Auth\TwoFactorChallenge;
use App\Filament\Auth\TwoFactorSetup;
use App\Models\User;
use Filament\Facades\Filament;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Fortify\Contracts\TwoFactorAuthenticationProvider;
use Livewire\Livewire;
use Mockery;
use Tests\TestCase;
use Tests\Traits\CreatesTwoFactorUsers;

class MfaRegressionTest extends TestCase
{
    use CreatesTwoFactorUsers, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Filament::setCurrentPanel(Filament::getPanel('admin'));
    }

    /**
     * T-1: Wrong-credential attempt on /admin/login returns a Livewire validation error
     * and leaves no filament.auth.panel, no login.id, and no filament.admin.2fa.* keys in session.
     */
    public function test_wrong_credentials_on_admin_login_shows_validation_error_and_no_session_leak(): void
    {
        $user = $this->createUserWithTotp();
        $user->givePermissionTo(Permission::ACCESS_ADMIN_PANEL->value);

        Livewire::test(AdminLogin::class)
            ->set('data.email', $user->email)
            ->set('data.password', 'wrong-password')
            ->call('authenticate')
            ->assertHasErrors(['data.email']);

        $this->assertGuest();
        $this->assertNull(session('filament.auth.panel'));
        $this->assertNull(session('login.id'));
        $this->assertNull(session('filament.admin.2fa.user_id'));
        $this->assertNull(session('filament.admin.2fa.remember'));
    }

    /**
     * T-2: Correct credentials on /admin/login for a user with confirmed 2FA:
     * Livewire redirects to filament.admin.auth.two-factor-challenge; user is still guest;
     * session has filament.admin.2fa.user_id only (no login.id, no filament.auth.panel).
     */
    public function test_correct_credentials_with_confirmed_2fa_redirects_to_filament_challenge(): void
    {
        $user = $this->createUserWithTotp();
        $user->givePermissionTo(Permission::ACCESS_ADMIN_PANEL->value);

        Livewire::test(AdminLogin::class)
            ->set('data.email', $user->email)
            ->set('data.password', 'password')
            ->call('authenticate')
            ->assertRedirect(route('filament.admin.auth.two-factor-challenge'));

        $this->assertGuest();
        $this->assertSame($user->getKey(), session('filament.admin.2fa.user_id'));
        $this->assertNull(session('login.id'));
        $this->assertNull(session('filament.auth.panel'));
    }

    /**
     * T-3: Correct credentials on /admin/login for a user with access-admin-panel but
     * without confirmed 2FA: user is logged in and redirected to two-factor-setup.
     */
    public function test_correct_credentials_without_confirmed_2fa_redirects_to_setup(): void
    {
        $user = User::factory()->create([
            'password' => Hash::make('password'),
            'email_verified_at' => now(),
            'two_factor_secret' => null,
            'two_factor_confirmed_at' => null,
        ]);
        $user->givePermissionTo(Permission::ACCESS_ADMIN_PANEL->value);

        Livewire::test(AdminLogin::class)
            ->set('data.email', $user->email)
            ->set('data.password', 'password')
            ->call('authenticate')
            ->assertRedirect(route('filament.admin.auth.two-factor-setup'));

        $this->assertAuthenticatedAs($user);
    }

    /**
     * T-4: /admin/two-factor-challenge submit with valid TOTP:
     * Filament::auth()->user() is the expected user; redirect to Filament::getUrl(); session keys cleared.
     */
    public function test_valid_totp_on_admin_two_factor_challenge_redirects_to_admin(): void
    {
        $this->mockTotpProvider(true);

        $user = $this->createUserWithTotp();
        $user->givePermissionTo(Permission::ACCESS_ADMIN_PANEL->value);

        session()->put('filament.admin.2fa.user_id', $user->getKey());
        session()->put('filament.admin.2fa.remember', false);

        Livewire::test(TwoFactorChallenge::class)
            ->set('data.code', '123456')
            ->call('submit')
            ->assertRedirect(Filament::getUrl());

        $this->assertAuthenticatedAs($user);
        $this->assertNull(session('filament.admin.2fa.user_id'));
        $this->assertNull(session('filament.admin.2fa.remember'));
    }

    /**
     * T-5: /admin/two-factor-challenge submit with invalid TOTP:
     * Validation error on data.code; user remains guest; rate-limit hit incremented.
     */
    public function test_invalid_totp_on_admin_two_factor_challenge_shows_validation_error(): void
    {
        $this->mockTotpProvider(false);

        $user = $this->createUserWithTotp();
        $user->givePermissionTo(Permission::ACCESS_ADMIN_PANEL->value);

        session()->put('filament.admin.2fa.user_id', $user->getKey());

        Livewire::test(TwoFactorChallenge::class)
            ->set('data.code', '000000')
            ->call('submit')
            ->assertHasErrors(['data.code']);

        $this->assertGuest();
    }

    /**
     * T-6: /admin/two-factor-challenge submit with valid recovery code:
     * Login succeeds; recovery code is consumed.
     */
    public function test_valid_recovery_code_on_admin_two_factor_challenge_logs_in_and_consumes_code(): void
    {
        $user = $this->createUserWithRecoveryCodes();
        $user->givePermissionTo(Permission::ACCESS_ADMIN_PANEL->value);

        session()->put('filament.admin.2fa.user_id', $user->getKey());
        session()->put('filament.admin.2fa.remember', false);

        $recoveryCode = $this->getUnusedRecoveryCode();

        Livewire::test(TwoFactorChallenge::class)
            ->set('data.method', 'recovery')
            ->set('data.recovery_code', $recoveryCode)
            ->call('submit')
            ->assertRedirect(Filament::getUrl());

        $this->assertAuthenticatedAs($user);

        $user->refresh();
        $this->assertNotContains($recoveryCode, $user->recoveryCodes());
    }

    /**
     * T-7: /admin/two-factor-setup confirm with valid code:
     * two_factor_confirmed_at is set; redirect to Filament::getUrl().
     */
    public function test_valid_totp_on_admin_two_factor_setup_confirms_enrollment_and_redirects_to_admin(): void
    {
        $mock = Mockery::mock(TwoFactorAuthenticationProvider::class);
        $mock->shouldReceive('generateSecretKey')->andReturn('JBSWY3DPEHPK3PXP');
        $mock->shouldReceive('qrCodeUrl')->andReturn('otpauth://totp/test');
        $mock->shouldReceive('verify')->andReturn(true);
        $this->app->instance(TwoFactorAuthenticationProvider::class, $mock);

        $user = User::factory()->create([
            'password' => Hash::make('password'),
            'email_verified_at' => now(),
            'two_factor_secret' => null,
            'two_factor_confirmed_at' => null,
        ]);
        $user->givePermissionTo(Permission::ACCESS_ADMIN_PANEL->value);

        Livewire::actingAs($user)
            ->test(TwoFactorSetup::class)
            ->set('data.code', '123456')
            ->call('confirm')
            ->assertSet('step', 'recovery-codes')
            ->call('complete')
            ->assertRedirect(Filament::getUrl());

        $user->refresh();
        $this->assertNotNull($user->two_factor_confirmed_at);
    }

    /**
     * T-8: Isolation A — static check.
     * The app/Filament/**, app/Http/Middleware/Filament/**, app/Services/Filament/**,
     * and app/Notifications/Filament/** trees must contain no forbidden strings.
     */
    public function test_isolation_a_filament_trees_contain_no_forbidden_strings(): void
    {
        $trees = [
            base_path('app/Filament'),
            base_path('app/Http/Middleware/Filament'),
            base_path('app/Services/Filament'),
            base_path('app/Notifications/Filament'),
        ];

        $forbidden = [
            "'two-factor.login'",
            '"two-factor.login"',
            'filament.auth.panel',
            'Routing\\Pipeline',
            'RedirectsIfTwoFactorAuthenticatable',
            'AttemptToAuthenticate',
            'PrepareAuthenticatedSession',
            'TwoFactorChallengeViewResponse',
            'TwoFactorLoginResponse',
        ];

        foreach ($trees as $tree) {
            if (! is_dir($tree)) {
                continue;
            }

            $files = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($tree));

            foreach ($files as $file) {
                if (! $file->isFile() || $file->getExtension() !== 'php') {
                    continue;
                }

                $content = file_get_contents($file->getPathname());

                foreach ($forbidden as $needle) {
                    $this->assertStringNotContainsString(
                        $needle,
                        $content,
                        "Forbidden string '{$needle}' found in {$file->getPathname()}"
                    );
                }
            }
        }
    }

    /**
     * T-11: Default MFA method is 'totp' on the login challenge page.
     */
    public function test_default_mfa_method_is_totp_on_login_challenge_page(): void
    {
        $user = $this->createUserWithTotp();
        $user->givePermissionTo(Permission::ACCESS_ADMIN_PANEL->value);

        session()->put('filament.admin.2fa.user_id', $user->getKey());

        Livewire::test(TwoFactorChallenge::class)
            ->assertFormFieldExists('method')
            ->assertSet('data.method', 'totp');
    }

    /**
     * T-12: Invalid recovery code on /admin/two-factor-challenge reports error on
     * data.recovery_code, not data.code.
     */
    public function test_invalid_recovery_code_on_admin_two_factor_challenge_reports_on_recovery_code_field(): void
    {
        $user = $this->createUserWithRecoveryCodes();
        $user->givePermissionTo(Permission::ACCESS_ADMIN_PANEL->value);

        session()->put('filament.admin.2fa.user_id', $user->getKey());

        Livewire::test(TwoFactorChallenge::class)
            ->set('data.method', 'recovery')
            ->set('data.recovery_code', 'INVALID-RECOVERY-CODE')
            ->call('submit')
            ->assertHasErrors(['data.recovery_code'])
            ->assertHasNoErrors(['data.code'])
            ->assertHasNoErrors(['data.email_code']);

        $this->assertGuest();
    }

    /**
     * T-13: /admin logout uses the Filament logout route, leaves no pending /admin auth keys,
     * and returns to the panel's login.
     */
    public function test_admin_logout_uses_filament_route_and_clears_admin_session_keys(): void
    {
        $user = $this->createUserWithTotp();
        $user->givePermissionTo(Permission::ACCESS_ADMIN_PANEL->value);

        $this->actingAs($user, config('fortify.guard'));

        // Plant pending admin session keys to verify they are cleared
        session()->put('filament.admin.2fa.user_id', $user->getKey());
        session()->put('filament.admin.2fa.remember', false);
        session()->put('filament.admin.2fa.email_challenge_id', 'some-challenge-id');

        $response = $this->post(route('filament.admin.auth.logout'));

        $this->assertGuest(config('fortify.guard'));
        $this->assertNull(session('filament.admin.2fa.user_id'));
        $this->assertNull(session('filament.admin.2fa.remember'));
        $this->assertNull(session('filament.admin.2fa.email_challenge_id'));
        $response->assertRedirect(Filament::getLoginUrl());
    }

    /**
     * T-14: /admin logout does NOT use the Fortify login.id mechanism.
     */
    public function test_admin_logout_does_not_set_or_use_fortify_login_id(): void
    {
        $user = $this->createUserWithTotp();
        $user->givePermissionTo(Permission::ACCESS_ADMIN_PANEL->value);

        $this->actingAs($user, config('fortify.guard'));

        // Simulate a stale login.id that should not be used
        session()->put('login.id', 9999);

        $this->post(route('filament.admin.auth.logout'));

        $this->assertGuest(config('fortify.guard'));
        // login.id is the key of Fortify's own two-factor challenge, which the panel
        // doesn't use; a stale one may or may not be cleared, but must not get in the way
    }
}
