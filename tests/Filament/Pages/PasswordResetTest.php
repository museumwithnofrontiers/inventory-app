<?php

namespace Tests\Filament\Pages;

use App\Enums\Permission;
use App\Filament\Auth\PasswordResetMfaChallenge;
use App\Filament\Auth\RequestPasswordReset;
use App\Filament\Auth\ResetPassword;
use App\Models\User;
use App\Notifications\AdminPasswordResetNotification;
use App\Notifications\Filament\Auth\EmailTwoFactorCodeNotification;
use App\Services\Filament\Auth\EmailTwoFactorCodeService;
use Filament\Facades\Filament;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Livewire\Livewire;
use Tests\TestCase;
use Tests\Traits\CreatesTwoFactorUsers;

class PasswordResetTest extends TestCase
{
    use CreatesTwoFactorUsers, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Filament::setCurrentPanel(Filament::getPanel('admin'));
    }

    // ─── RequestPasswordReset page ────────────────────────────────────────────

    public function test_request_password_reset_page_renders(): void
    {
        Livewire::test(RequestPasswordReset::class)
            ->assertStatus(200);
    }

    public function test_request_password_reset_redirects_authenticated_user(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo(Permission::ACCESS_ADMIN_PANEL->value);

        Livewire::actingAs($user)
            ->test(RequestPasswordReset::class)
            ->assertRedirect(Filament::getUrl());
    }

    public function test_reset_link_is_dispatched_for_existing_email(): void
    {
        Notification::fake();

        $user = User::factory()->create(['email' => 'user@example.com']);

        Livewire::test(RequestPasswordReset::class)
            ->set('data.email', 'user@example.com')
            ->call('submit')
            ->assertHasNoErrors();

        Notification::assertSentTo($user, AdminPasswordResetNotification::class);
    }

    public function test_admin_reset_link_targets_filament_route_not_web_route(): void
    {
        $user = User::factory()->create(['email' => 'user@example.com']);
        $notification = new AdminPasswordResetNotification('admin-reset-token');

        $mailMessage = $notification->toMail($user);
        $expectedUrl = route('filament.admin.auth.password.reset', [
            'token' => 'admin-reset-token',
            'email' => 'user@example.com',
        ]);

        $this->assertSame($expectedUrl, $mailMessage->actionUrl);
    }

    public function test_reset_link_submission_shows_success_notification_even_for_unknown_email(): void
    {
        Livewire::test(RequestPasswordReset::class)
            ->set('data.email', 'nobody@example.com')
            ->call('submit')
            ->assertHasNoErrors()
            ->assertNotified();
    }

    // ─── ResetPassword page ───────────────────────────────────────────────────

    public function test_reset_password_page_renders_with_valid_token(): void
    {
        $user = User::factory()->create(['email' => 'user@example.com']);
        $token = Password::broker(config('fortify.passwords'))->createToken($user);

        Livewire::test(ResetPassword::class, ['token' => $token])
            ->assertStatus(200);
    }

    public function test_reset_password_rejects_invalid_token(): void
    {
        User::factory()->create(['email' => 'user@example.com']);

        Livewire::test(ResetPassword::class, ['token' => 'invalid-token'])
            ->set('data.email', 'user@example.com')
            ->set('data.password', 'NewPassword1!')
            ->set('data.password_confirmation', 'NewPassword1!')
            ->call('submit')
            ->assertHasErrors('data.email');
    }

    public function test_reset_password_rejects_unknown_email(): void
    {
        $user = User::factory()->create(['email' => 'user@example.com']);
        $token = Password::broker(config('fortify.passwords'))->createToken($user);

        Livewire::test(ResetPassword::class, ['token' => $token])
            ->set('data.email', 'nobody@example.com')
            ->set('data.password', 'NewPassword1!')
            ->set('data.password_confirmation', 'NewPassword1!')
            ->call('submit')
            ->assertHasErrors('data.email');
    }

    public function test_reset_password_without_mfa_updates_password_and_redirects_to_login(): void
    {
        $user = $this->createUserWithoutTwoFactor(['email' => 'user@example.com']);
        $token = Password::broker(config('fortify.passwords'))->createToken($user);

        Livewire::test(ResetPassword::class, ['token' => $token])
            ->set('data.email', 'user@example.com')
            ->set('data.password', 'NewPassword1!')
            ->set('data.password_confirmation', 'NewPassword1!')
            ->call('submit')
            ->assertHasNoErrors()
            ->assertRedirect(Filament::getLoginUrl());

        $this->assertTrue(Hash::check('NewPassword1!', $user->fresh()->password));
        $this->assertGuest(config('fortify.guard'));
    }

    public function test_reset_password_token_is_invalidated_after_successful_reset_without_mfa(): void
    {
        $user = $this->createUserWithoutTwoFactor(['email' => 'user@example.com']);
        $token = Password::broker(config('fortify.passwords'))->createToken($user);

        Livewire::test(ResetPassword::class, ['token' => $token])
            ->set('data.email', 'user@example.com')
            ->set('data.password', 'NewPassword1!')
            ->set('data.password_confirmation', 'NewPassword1!')
            ->call('submit');

        $tokenRepository = Password::broker(config('fortify.passwords'))->getRepository();
        $this->assertFalse($tokenRepository->exists($user->fresh(), $token));
    }

    public function test_reset_password_with_mfa_stores_pending_reset_and_redirects_to_mfa_page(): void
    {
        $user = $this->createUserWithTotp(['email' => 'user@example.com']);
        $token = Password::broker(config('fortify.passwords'))->createToken($user);

        Livewire::test(ResetPassword::class, ['token' => $token])
            ->set('data.email', 'user@example.com')
            ->set('data.password', 'NewPassword1!')
            ->set('data.password_confirmation', 'NewPassword1!')
            ->call('submit')
            ->assertRedirect(Filament::getCurrentPanel()->route('auth.password.reset.mfa'));

        $this->assertNotNull(session('filament.admin.password_reset.user_id'));
        $this->assertNotNull(session('filament.admin.password_reset.password_hash'));
        $this->assertNotNull(session('filament.admin.password_reset.token'));
    }

    public function test_reset_password_with_mfa_does_not_immediately_change_password(): void
    {
        $user = $this->createUserWithTotp(['email' => 'user@example.com']);
        $originalPasswordHash = $user->password;
        $token = Password::broker(config('fortify.passwords'))->createToken($user);

        Livewire::test(ResetPassword::class, ['token' => $token])
            ->set('data.email', 'user@example.com')
            ->set('data.password', 'NewPassword1!')
            ->set('data.password_confirmation', 'NewPassword1!')
            ->call('submit');

        $this->assertEquals($originalPasswordHash, $user->fresh()->password);
    }

    // ─── PasswordResetMfaChallenge page ───────────────────────────────────────

    public function test_mfa_challenge_page_redirects_without_pending_session(): void
    {
        Livewire::test(PasswordResetMfaChallenge::class)
            ->assertRedirect(Filament::getLoginUrl());
    }

    public function test_mfa_challenge_page_renders_with_pending_session(): void
    {
        $user = $this->createUserWithTotp(['email' => 'user@example.com']);

        session()->put('filament.admin.password_reset.user_id', $user->id);
        session()->put('filament.admin.password_reset.password_hash', Hash::make('NewPassword1!'));
        session()->put('filament.admin.password_reset.token', 'fake-token');

        Livewire::test(PasswordResetMfaChallenge::class)
            ->assertStatus(200);
    }

    public function test_valid_totp_code_completes_password_reset_and_redirects_to_login(): void
    {
        $this->mockTotpProvider(true);

        $user = $this->createUserWithTotp(['email' => 'user@example.com']);
        $newPasswordHash = Hash::make('NewPassword1!');
        $token = Password::broker(config('fortify.passwords'))->createToken($user);

        session()->put('filament.admin.password_reset.user_id', $user->id);
        session()->put('filament.admin.password_reset.password_hash', $newPasswordHash);
        session()->put('filament.admin.password_reset.token', $token);

        Livewire::test(PasswordResetMfaChallenge::class)
            ->set('data.code', '123456')
            ->call('submit')
            ->assertRedirect(Filament::getLoginUrl());

        $this->assertEquals($newPasswordHash, $user->fresh()->password);
        $this->assertGuest(config('fortify.guard'));
    }

    public function test_valid_totp_code_invalidates_reset_token(): void
    {
        $this->mockTotpProvider(true);

        $user = $this->createUserWithTotp(['email' => 'user@example.com']);
        $token = Password::broker(config('fortify.passwords'))->createToken($user);

        session()->put('filament.admin.password_reset.user_id', $user->id);
        session()->put('filament.admin.password_reset.password_hash', Hash::make('NewPassword1!'));
        session()->put('filament.admin.password_reset.token', $token);

        Livewire::test(PasswordResetMfaChallenge::class)
            ->set('data.code', '123456')
            ->call('submit');

        $tokenRepository = Password::broker(config('fortify.passwords'))->getRepository();
        $this->assertFalse($tokenRepository->exists($user->fresh(), $token));
    }

    public function test_valid_totp_code_clears_session_keys(): void
    {
        $this->mockTotpProvider(true);

        $user = $this->createUserWithTotp(['email' => 'user@example.com']);
        $token = Password::broker(config('fortify.passwords'))->createToken($user);

        session()->put('filament.admin.password_reset.user_id', $user->id);
        session()->put('filament.admin.password_reset.password_hash', Hash::make('NewPassword1!'));
        session()->put('filament.admin.password_reset.token', $token);

        Livewire::test(PasswordResetMfaChallenge::class)
            ->set('data.code', '123456')
            ->call('submit');

        $this->assertNull(session('filament.admin.password_reset.user_id'));
        $this->assertNull(session('filament.admin.password_reset.password_hash'));
        $this->assertNull(session('filament.admin.password_reset.token'));
    }

    public function test_invalid_totp_code_does_not_reset_password(): void
    {
        $this->mockTotpProvider(false);

        $user = $this->createUserWithTotp(['email' => 'user@example.com']);
        $originalPasswordHash = $user->password;

        session()->put('filament.admin.password_reset.user_id', $user->id);
        session()->put('filament.admin.password_reset.password_hash', Hash::make('NewPassword1!'));
        session()->put('filament.admin.password_reset.token', 'fake-token');

        Livewire::test(PasswordResetMfaChallenge::class)
            ->set('data.code', '000000')
            ->call('submit')
            ->assertHasErrors(['data.code']);

        $this->assertEquals($originalPasswordHash, $user->fresh()->password);
    }

    public function test_valid_recovery_code_completes_password_reset(): void
    {
        $user = $this->createUserWithRecoveryCodes(['email' => 'user@example.com']);
        $newPasswordHash = Hash::make('NewPassword1!');
        $token = Password::broker(config('fortify.passwords'))->createToken($user);

        session()->put('filament.admin.password_reset.user_id', $user->id);
        session()->put('filament.admin.password_reset.password_hash', $newPasswordHash);
        session()->put('filament.admin.password_reset.token', $token);

        Livewire::test(PasswordResetMfaChallenge::class)
            ->set('data.method', 'recovery')
            ->set('data.recovery_code', 'RECOVERY-CODE-1')
            ->call('submit')
            ->assertRedirect(Filament::getLoginUrl());

        $this->assertEquals($newPasswordHash, $user->fresh()->password);
    }

    public function test_invalid_recovery_code_does_not_reset_password(): void
    {
        $user = $this->createUserWithRecoveryCodes(['email' => 'user@example.com']);
        $originalPasswordHash = $user->password;

        session()->put('filament.admin.password_reset.user_id', $user->id);
        session()->put('filament.admin.password_reset.password_hash', Hash::make('NewPassword1!'));
        session()->put('filament.admin.password_reset.token', 'fake-token');

        Livewire::test(PasswordResetMfaChallenge::class)
            ->set('data.method', 'recovery')
            ->set('data.recovery_code', 'WRONG-RECOVERY-CODE')
            ->call('submit')
            ->assertHasErrors(['data.recovery_code']);

        $this->assertEquals($originalPasswordHash, $user->fresh()->password);
    }

    public function test_only_selected_method_credential_is_used(): void
    {
        $this->mockTotpProvider(false);

        $user = $this->createUserWithTotp(['email' => 'user@example.com']);

        session()->put('filament.admin.password_reset.user_id', $user->id);
        session()->put('filament.admin.password_reset.password_hash', Hash::make('NewPassword1!'));
        session()->put('filament.admin.password_reset.token', 'fake-token');

        // method=totp with invalid code; stale recovery_code field is ignored
        Livewire::test(PasswordResetMfaChallenge::class)
            ->set('data.method', 'totp')
            ->set('data.code', '123456')
            ->set('data.recovery_code', 'RECOVERY-CODE-1')
            ->call('submit')
            ->assertHasErrors(['data.code'])
            ->assertHasNoErrors(['data.recovery_code'])
            ->assertHasNoErrors(['data.email_code']);
    }

    // ─── Password-reset email code (Story 1) ──────────────────────────────────

    public function test_password_reset_email_code_send_dispatches_notification(): void
    {
        Notification::fake();

        $user = $this->createUserWithTotp(['email' => 'user@example.com']);
        $token = Password::broker(config('fortify.passwords'))->createToken($user);

        session()->put('filament.admin.password_reset.user_id', $user->id);
        session()->put('filament.admin.password_reset.password_hash', Hash::make('NewPassword1!'));
        session()->put('filament.admin.password_reset.token', $token);

        Livewire::test(PasswordResetMfaChallenge::class)
            ->call('sendEmailCode')
            ->assertHasNoErrors();

        Notification::assertSentTo($user, EmailTwoFactorCodeNotification::class);
    }

    public function test_password_reset_email_code_send_stores_only_hashed_cache_state(): void
    {
        Notification::fake();

        $user = $this->createUserWithTotp(['email' => 'user@example.com']);
        $token = Password::broker(config('fortify.passwords'))->createToken($user);

        session()->put('filament.admin.password_reset.user_id', $user->id);
        session()->put('filament.admin.password_reset.password_hash', Hash::make('NewPassword1!'));
        session()->put('filament.admin.password_reset.token', $token);

        Livewire::test(PasswordResetMfaChallenge::class)
            ->call('sendEmailCode');

        $challengeId = session('filament.admin.password_reset.email_challenge_id');
        $this->assertNotNull($challengeId);
        $this->assertTrue(Str::isUuid($challengeId));

        $service = app(EmailTwoFactorCodeService::class);
        $payload = Cache::get($service->cacheKey($challengeId));

        $this->assertNotNull($payload);
        $this->assertArrayHasKey('code_hash', $payload);
        $this->assertGreaterThan(6, strlen($payload['code_hash']));
        $this->assertStringStartsWith('$2y$', $payload['code_hash']);

        // No plaintext 6-digit code in session
        foreach (session()->all() as $key => $value) {
            if (is_string($value)) {
                $this->assertDoesNotMatchRegularExpression('/^\d{6}$/', $value, "Session '{$key}' contains a raw 6-digit code.");
            }
        }
    }

    public function test_password_reset_email_code_send_uses_password_reset_session_namespace(): void
    {
        Notification::fake();

        $user = $this->createUserWithTotp(['email' => 'user@example.com']);
        $token = Password::broker(config('fortify.passwords'))->createToken($user);

        session()->put('filament.admin.password_reset.user_id', $user->id);
        session()->put('filament.admin.password_reset.password_hash', Hash::make('NewPassword1!'));
        session()->put('filament.admin.password_reset.token', $token);

        Livewire::test(PasswordResetMfaChallenge::class)
            ->call('sendEmailCode');

        // Challenge ID must be stored under the password-reset namespace, not the login MFA namespace
        $this->assertNotNull(session('filament.admin.password_reset.email_challenge_id'));
        $this->assertNull(session('filament.admin.2fa.email_challenge_id'));
    }

    public function test_valid_password_reset_email_code_updates_password_and_redirects_to_login(): void
    {
        $user = $this->createUserWithTotp(['email' => 'user@example.com']);
        $newPasswordHash = Hash::make('NewPassword1!');
        $token = Password::broker(config('fortify.passwords'))->createToken($user);

        $challengeId = (string) Str::uuid();
        $plainCode = '123456';

        $service = app(EmailTwoFactorCodeService::class);
        Cache::put($service->cacheKey($challengeId), [
            'user_id' => $user->id,
            'code_hash' => Hash::make($plainCode),
            'expires_at' => now()->addMinutes(10)->timestamp,
        ], 600);

        session()->put('filament.admin.password_reset.user_id', $user->id);
        session()->put('filament.admin.password_reset.password_hash', $newPasswordHash);
        session()->put('filament.admin.password_reset.token', $token);
        session()->put('filament.admin.password_reset.email_challenge_id', $challengeId);

        Livewire::test(PasswordResetMfaChallenge::class)
            ->set('data.method', 'email')
            ->set('data.email_code', $plainCode)
            ->call('submit')
            ->assertRedirect(Filament::getLoginUrl());

        $this->assertEquals($newPasswordHash, $user->fresh()->password);
        $this->assertGuest(config('fortify.guard'));

        $tokenRepository = Password::broker(config('fortify.passwords'))->getRepository();
        $this->assertFalse($tokenRepository->exists($user->fresh(), $token));

        $this->assertNull(session('filament.admin.password_reset.user_id'));
        $this->assertNull(session('filament.admin.password_reset.password_hash'));
        $this->assertNull(session('filament.admin.password_reset.token'));
        $this->assertNull(session('filament.admin.password_reset.email_challenge_id'));
        $this->assertNull(Cache::get($service->cacheKey($challengeId)));
    }

    public function test_invalid_password_reset_email_code_does_not_update_password(): void
    {
        $user = $this->createUserWithTotp(['email' => 'user@example.com']);
        $originalPasswordHash = $user->password;
        $token = Password::broker(config('fortify.passwords'))->createToken($user);

        $challengeId = (string) Str::uuid();

        $service = app(EmailTwoFactorCodeService::class);
        Cache::put($service->cacheKey($challengeId), [
            'user_id' => $user->id,
            'code_hash' => Hash::make('123456'),
            'expires_at' => now()->addMinutes(10)->timestamp,
        ], 600);

        session()->put('filament.admin.password_reset.user_id', $user->id);
        session()->put('filament.admin.password_reset.password_hash', Hash::make('NewPassword1!'));
        session()->put('filament.admin.password_reset.token', $token);
        session()->put('filament.admin.password_reset.email_challenge_id', $challengeId);

        Livewire::test(PasswordResetMfaChallenge::class)
            ->set('data.method', 'email')
            ->set('data.email_code', '999999')
            ->call('submit')
            ->assertHasErrors(['data.email_code']);

        $this->assertEquals($originalPasswordHash, $user->fresh()->password);
    }

    public function test_expired_password_reset_email_code_does_not_update_password(): void
    {
        $user = $this->createUserWithTotp(['email' => 'user@example.com']);
        $originalPasswordHash = $user->password;
        $token = Password::broker(config('fortify.passwords'))->createToken($user);

        $challengeId = (string) Str::uuid();

        // Cache is empty — simulates expiry

        session()->put('filament.admin.password_reset.user_id', $user->id);
        session()->put('filament.admin.password_reset.password_hash', Hash::make('NewPassword1!'));
        session()->put('filament.admin.password_reset.token', $token);
        session()->put('filament.admin.password_reset.email_challenge_id', $challengeId);

        Livewire::test(PasswordResetMfaChallenge::class)
            ->set('data.method', 'email')
            ->set('data.email_code', '123456')
            ->call('submit')
            ->assertHasErrors(['data.email_code']);

        $this->assertEquals($originalPasswordHash, $user->fresh()->password);
    }

    public function test_reused_password_reset_email_code_does_not_update_password(): void
    {
        $user = $this->createUserWithTotp(['email' => 'user@example.com']);
        $newPasswordHash = Hash::make('NewPassword1!');
        $token = Password::broker(config('fortify.passwords'))->createToken($user);

        $challengeId = (string) Str::uuid();
        $plainCode = '123456';

        $service = app(EmailTwoFactorCodeService::class);
        $cacheKey = $service->cacheKey($challengeId);

        Cache::put($cacheKey, [
            'user_id' => $user->id,
            'code_hash' => Hash::make($plainCode),
            'expires_at' => now()->addMinutes(10)->timestamp,
        ], 600);

        session()->put('filament.admin.password_reset.user_id', $user->id);
        session()->put('filament.admin.password_reset.password_hash', $newPasswordHash);
        session()->put('filament.admin.password_reset.token', $token);
        session()->put('filament.admin.password_reset.email_challenge_id', $challengeId);

        // First submission — succeeds
        $token2 = Password::broker(config('fortify.passwords'))->createToken($user);
        session()->put('filament.admin.password_reset.user_id', $user->id);
        session()->put('filament.admin.password_reset.password_hash', $newPasswordHash);
        session()->put('filament.admin.password_reset.token', $token2);
        session()->put('filament.admin.password_reset.email_challenge_id', $challengeId);

        Livewire::test(PasswordResetMfaChallenge::class)
            ->set('data.method', 'email')
            ->set('data.email_code', $plainCode)
            ->call('submit');

        $this->assertNull(Cache::get($cacheKey));

        // Second submission — cache is gone, must fail
        $token3 = Password::broker(config('fortify.passwords'))->createToken($user);
        session()->put('filament.admin.password_reset.user_id', $user->id);
        session()->put('filament.admin.password_reset.password_hash', Hash::make('AnotherPassword1!'));
        session()->put('filament.admin.password_reset.token', $token3);
        session()->put('filament.admin.password_reset.email_challenge_id', $challengeId);

        $originalHash = $user->fresh()->password;

        Livewire::test(PasswordResetMfaChallenge::class)
            ->set('data.method', 'email')
            ->set('data.email_code', $plainCode)
            ->call('submit')
            ->assertHasErrors(['data.email_code']);

        $this->assertEquals($originalHash, $user->fresh()->password);
    }

    public function test_valid_mfa_with_expired_reset_token_does_not_update_password(): void
    {
        $this->mockTotpProvider(true);

        $user = $this->createUserWithTotp(['email' => 'user@example.com']);
        $originalPasswordHash = $user->password;

        // Store a token string in session but do NOT create it in the DB (simulates expiry)
        session()->put('filament.admin.password_reset.user_id', $user->id);
        session()->put('filament.admin.password_reset.password_hash', Hash::make('NewPassword1!'));
        session()->put('filament.admin.password_reset.token', 'expired-or-deleted-token');

        Livewire::test(PasswordResetMfaChallenge::class)
            ->set('data.method', 'totp')
            ->set('data.code', '123456')
            ->call('submit')
            ->assertRedirect(Filament::getLoginUrl());

        $this->assertEquals($originalPasswordHash, $user->fresh()->password);
        $this->assertNull(session('filament.admin.password_reset.user_id'));
    }

    public function test_partial_pending_reset_state_fails_fast_and_does_not_show_success(): void
    {
        $this->mockTotpProvider(true);

        $user = $this->createUserWithTotp(['email' => 'user@example.com']);
        $originalPasswordHash = $user->password;

        // Only user_id is set; hash and token are missing
        session()->put('filament.admin.password_reset.user_id', $user->id);

        Livewire::test(PasswordResetMfaChallenge::class)
            ->set('data.method', 'totp')
            ->set('data.code', '123456')
            ->call('submit')
            ->assertRedirect(Filament::getLoginUrl())
            ->assertNotNotified(__('Your password has been reset. You may now log in.'));

        $this->assertEquals($originalPasswordHash, $user->fresh()->password);
    }

    // ─── Method selection UX (Story 2) ───────────────────────────────────────

    public function test_default_method_is_totp_on_password_reset_mfa_page(): void
    {
        $user = $this->createUserWithTotp(['email' => 'user@example.com']);

        session()->put('filament.admin.password_reset.user_id', $user->id);
        session()->put('filament.admin.password_reset.password_hash', Hash::make('NewPassword1!'));
        session()->put('filament.admin.password_reset.token', 'fake-token');

        Livewire::test(PasswordResetMfaChallenge::class)
            ->assertFormFieldExists('method')
            ->assertSet('data.method', 'totp');
    }

    public function test_invalid_recovery_code_reports_error_on_recovery_code_field(): void
    {
        $user = $this->createUserWithRecoveryCodes(['email' => 'user@example.com']);

        session()->put('filament.admin.password_reset.user_id', $user->id);
        session()->put('filament.admin.password_reset.password_hash', Hash::make('NewPassword1!'));
        session()->put('filament.admin.password_reset.token', 'fake-token');

        Livewire::test(PasswordResetMfaChallenge::class)
            ->set('data.method', 'recovery')
            ->set('data.recovery_code', 'INVALID-CODE')
            ->call('submit')
            ->assertHasErrors(['data.recovery_code'])
            ->assertHasNoErrors(['data.code'])
            ->assertHasNoErrors(['data.email_code']);
    }

    public function test_password_reset_mfa_reset_flow_returns_to_the_panel_login(): void
    {
        $this->mockTotpProvider(true);

        $user = $this->createUserWithTotp(['email' => 'user@example.com']);
        $token = Password::broker(config('fortify.passwords'))->createToken($user);

        session()->put('filament.admin.password_reset.user_id', $user->id);
        session()->put('filament.admin.password_reset.password_hash', Hash::make('NewPassword1!'));
        session()->put('filament.admin.password_reset.token', $token);

        Livewire::test(PasswordResetMfaChallenge::class)
            ->set('data.code', '123456')
            ->call('submit')
            ->assertRedirect(Filament::getLoginUrl());
    }
}
