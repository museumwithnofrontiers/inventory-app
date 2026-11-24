<?php

namespace Tests\Filament\Pages;

use App\Enums\Permission;
use App\Filament\Auth\Login as AdminLogin;
use App\Filament\Auth\TwoFactorChallenge;
use App\Filament\Pages\ProfilePage;
use App\Models\User;
use Filament\Facades\Filament;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Fortify\Contracts\TwoFactorAuthenticationProvider;
use Livewire\Livewire;
use Mockery;
use Tests\TestCase;
use Tests\Traits\CreatesTwoFactorUsers;

class ProfilePageTest extends TestCase
{
    use CreatesTwoFactorUsers, RefreshDatabase;

    // ── Helpers ──────────────────────────────────────────────────────────────

    protected function createUserWithPanelAccess(array $extra = []): User
    {
        $user = User::factory()->create(array_merge([
            'password' => Hash::make('password'),
            'email_verified_at' => now(),
        ], $extra));
        $user->givePermissionTo(Permission::ACCESS_ADMIN_PANEL->value);

        return $user;
    }

    protected function setPanel(): void
    {
        Filament::setCurrentPanel(Filament::getPanel('admin'));
    }

    /**
     * Mock the TOTP provider with all expected method calls for 2FA setup.
     */
    protected function mockFullTotpProvider(bool $shouldVerify = true): void
    {
        $mock = Mockery::mock(TwoFactorAuthenticationProvider::class);
        $mock->shouldReceive('generateSecretKey')->andReturn('JBSWY3DPEHPK3PXP');
        $mock->shouldReceive('qrCodeUrl')->andReturn('otpauth://totp/test:user@example.com?secret=JBSWY3DPEHPK3PXP');
        $mock->shouldReceive('verify')->andReturn($shouldVerify);

        $this->app->instance(TwoFactorAuthenticationProvider::class, $mock);
    }

    // ── Page access ──────────────────────────────────────────────────────────

    public function test_profile_page_is_accessible_by_any_user_with_panel_access(): void
    {
        $user = $this->createUserWithPanelAccess();

        $this->actingAs($user)->get('/admin/profile')
            ->assertOk()
            ->assertSee('Profile');
    }

    public function test_profile_page_shows_the_authenticated_user_name_and_email(): void
    {
        $user = $this->createUserWithPanelAccess(['name' => 'Alice Test', 'email' => 'alice@example.test']);

        $this->actingAs($user)->get('/admin/profile')
            ->assertOk()
            ->assertSee('Alice Test')
            ->assertSee('alice@example.test');
    }

    public function test_profile_page_is_in_the_user_menu(): void
    {
        $user = $this->createUserWithPanelAccess();

        $this->setPanel();

        $panelMenuItems = Filament::getCurrentOrDefaultPanel()->getUserMenuItems();

        $profileItem = collect($panelMenuItems)->first(
            fn ($item) => str_contains((string) $item->getUrl(), 'profile')
        );

        $this->assertNotNull($profileItem, 'ProfilePage menu item not found in user menu');
    }

    // ── Profile update ───────────────────────────────────────────────────────

    public function test_user_can_update_name_and_email(): void
    {
        $user = $this->createUserWithPanelAccess(['name' => 'Old Name', 'email' => 'old@example.test']);

        $this->setPanel();

        Livewire::actingAs($user)
            ->test(ProfilePage::class)
            ->fillForm([
                'name' => 'New Name',
                'email' => 'new@example.test',
            ])
            ->call('save')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'name' => 'New Name',
            'email' => 'new@example.test',
        ]);
    }

    // ── Change password ──────────────────────────────────────────────────────

    public function test_user_can_change_password_with_correct_current_password(): void
    {
        $user = $this->createUserWithPanelAccess();

        $this->setPanel();

        Livewire::actingAs($user)
            ->test(ProfilePage::class)
            ->callAction('changePassword', [
                'current_password' => 'password',
                'password' => 'new-Password123!',
                'password_confirmation' => 'new-Password123!',
            ])
            ->assertHasNoActionErrors();

        $user->refresh();
        $this->assertTrue(Hash::check('new-Password123!', $user->password));
    }

    public function test_change_password_fails_with_wrong_current_password(): void
    {
        $user = $this->createUserWithPanelAccess();

        $this->setPanel();

        Livewire::actingAs($user)
            ->test(ProfilePage::class)
            ->callAction('changePassword', [
                'current_password' => 'wrongpassword',
                'password' => 'new-Password123!',
                'password_confirmation' => 'new-Password123!',
            ]);

        $user->refresh();
        $this->assertTrue(Hash::check('password', $user->password));
    }

    // ── Two-factor authentication ────────────────────────────────────────────

    public function test_user_can_enable_two_factor_authentication(): void
    {
        $this->mockFullTotpProvider(true);

        $user = $this->createUserWithPanelAccess(['two_factor_secret' => null, 'two_factor_confirmed_at' => null]);

        $this->setPanel();

        Livewire::actingAs($user)
            ->test(ProfilePage::class)
            ->callAction('enableTwoFactor', ['totp_code' => '123456'])
            ->assertHasNoActionErrors();

        $user->refresh();
        $this->assertTrue($user->hasEnabledTwoFactorAuthentication());
    }

    public function test_enable_two_factor_rolls_back_when_invalid_totp_code_is_provided(): void
    {
        $this->mockFullTotpProvider(false);

        $user = $this->createUserWithPanelAccess(['two_factor_secret' => null, 'two_factor_confirmed_at' => null]);

        $this->setPanel();

        Livewire::actingAs($user)
            ->test(ProfilePage::class)
            ->callAction('enableTwoFactor', ['totp_code' => '000000']);

        $user->refresh();
        $this->assertFalse($user->hasEnabledTwoFactorAuthentication());
    }

    public function test_user_can_disable_two_factor_authentication(): void
    {
        // Direct Livewire component test — ACCESS_ADMIN_PANEL is in Permission::sensitivePermissions(),
        // so we create a user without any permissions to test the happy path.
        // Panel middleware is bypassed when testing the Livewire component directly.
        $user = $this->createUserWithTotp(['email_verified_at' => now()]);

        $this->setPanel();

        Livewire::actingAs($user)
            ->test(ProfilePage::class)
            ->callAction('disableTwoFactor')
            ->assertHasNoActionErrors();

        $user->refresh();
        $this->assertFalse($user->hasEnabledTwoFactorAuthentication());
    }

    public function test_disable_two_factor_is_blocked_when_user_has_sensitive_permissions(): void
    {
        $user = $this->createUserWithTotp(['email_verified_at' => now()]);
        $user->givePermissionTo([
            Permission::MANAGE_USERS->value,
        ]);

        $this->setPanel();

        Livewire::actingAs($user)
            ->test(ProfilePage::class)
            ->callAction('disableTwoFactor');

        $user->refresh();
        $this->assertTrue($user->hasEnabledTwoFactorAuthentication());
    }

    public function test_user_can_regenerate_recovery_codes(): void
    {
        $user = $this->createUserWithRecoveryCodes(['email_verified_at' => now()]);
        $user->givePermissionTo(Permission::ACCESS_ADMIN_PANEL->value);

        $originalCodes = $user->recoveryCodes();

        $this->setPanel();

        Livewire::actingAs($user)
            ->test(ProfilePage::class)
            ->callAction('regenerateRecoveryCodes')
            ->assertHasNoActionErrors();

        $user->refresh();
        $newCodes = $user->recoveryCodes();

        $this->assertNotEmpty($newCodes);
        $this->assertNotEquals($originalCodes, $newCodes);
    }

    // ── Logout other browser sessions ────────────────────────────────────────

    public function test_user_can_logout_other_browser_sessions_with_correct_password(): void
    {
        $user = $this->createUserWithPanelAccess();

        $this->setPanel();

        Livewire::actingAs($user)
            ->test(ProfilePage::class)
            ->callAction('logoutOtherBrowserSessions', ['password' => 'password'])
            ->assertHasNoActionErrors();
    }

    public function test_logout_other_sessions_fails_with_wrong_password(): void
    {
        $user = $this->createUserWithPanelAccess();

        $this->setPanel();

        Livewire::actingAs($user)
            ->test(ProfilePage::class)
            ->callAction('logoutOtherBrowserSessions', ['password' => 'wrongpassword']);

        // Wrong password: action halts, so the user is still present in the database
        $this->assertDatabaseHas('users', ['id' => $user->id]);
    }

    // ── Delete account ───────────────────────────────────────────────────────

    public function test_user_can_delete_own_account_with_correct_password(): void
    {
        $user = $this->createUserWithPanelAccess();
        $userId = $user->id;

        $this->setPanel();

        Livewire::actingAs($user)
            ->test(ProfilePage::class)
            ->callAction('deleteAccount', ['password' => 'password']);

        $this->assertDatabaseMissing('users', ['id' => $userId]);
    }

    public function test_delete_account_fails_with_wrong_password(): void
    {
        $user = $this->createUserWithPanelAccess();
        $userId = $user->id;

        $this->setPanel();

        Livewire::actingAs($user)
            ->test(ProfilePage::class)
            ->callAction('deleteAccount', ['password' => 'wrongpassword']);

        $this->assertDatabaseHas('users', ['id' => $userId]);
    }

    // ── 2FA round-trip ───────────────────────────────────────────────────────

    public function test_unenrolled_user_can_enrol_in_two_factor_and_authenticate_with_it(): void
    {
        $this->mockFullTotpProvider(true);

        $user = $this->createUserWithPanelAccess(['two_factor_secret' => null, 'two_factor_confirmed_at' => null]);

        // Step 1: Enrol via ProfilePage
        $this->setPanel();

        Livewire::actingAs($user)
            ->test(ProfilePage::class)
            ->callAction('enableTwoFactor', ['totp_code' => '123456'])
            ->assertHasNoActionErrors();

        $user->refresh();
        $this->assertTrue($user->hasEnabledTwoFactorAuthentication());

        // Step 2: Log out and attempt to log back in — 2FA challenge should appear
        $this->actingAs($user)->post(route('filament.admin.auth.logout'));
        $this->assertGuest();

        Filament::setCurrentPanel(Filament::getPanel('admin'));

        Livewire::test(AdminLogin::class)
            ->set('data.email', $user->email)
            ->set('data.password', 'password')
            ->call('authenticate');

        // 2FA challenge: user is not yet fully authenticated
        $this->assertGuest();
        $this->assertSame($user->getKey(), session('filament.admin.2fa.user_id'));

        // Step 3: Complete 2FA challenge via the Filament challenge page
        $this->mockTotpProvider(true);

        Livewire::test(TwoFactorChallenge::class)
            ->set('data.code', '123456')
            ->call('submit');

        $this->assertAuthenticatedAs($user);
    }
}
