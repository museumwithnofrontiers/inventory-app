<?php

namespace Tests\Filament\Pages;

use App\Enums\Permission;
use App\Filament\Auth\Login as AdminLogin;
use App\Models\User;
use Filament\Facades\Filament;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Livewire\Features\SupportTesting\Testable;
use Livewire\Livewire;
use Tests\TestCase;

/**
 * What /admin/login tells the owner of an account that can't enter yet.
 */
class LoginAccountStateTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Filament::setCurrentPanel(Filament::getPanel('admin'));
    }

    protected function attempt(User $user, string $password = 'password'): Testable
    {
        return Livewire::test(AdminLogin::class)
            ->set('data.email', $user->email)
            ->set('data.password', $password)
            ->call('authenticate');
    }

    public function test_an_unverified_account_is_told_so_and_sent_a_new_link(): void
    {
        Notification::fake();
        $user = User::factory()->unverified()->pendingApproval()->create();

        $this->attempt($user)
            ->assertHasErrors(['data.email'])
            ->assertSee(__('Your e-mail address is not verified yet. We have sent you a new verification link.'));

        Notification::assertSentToTimes($user, VerifyEmail::class, 1);
        $this->assertGuest();
    }

    public function test_the_new_link_is_not_sent_again_at_every_attempt(): void
    {
        Notification::fake();
        $user = User::factory()->unverified()->create();

        $this->attempt($user);
        $this->attempt($user)
            ->assertSee(__('Your e-mail address is not verified yet. Use the verification link we sent you.'));

        Notification::assertSentToTimes($user, VerifyEmail::class, 1);
    }

    public function test_a_wrong_password_says_nothing_about_the_account(): void
    {
        Notification::fake();
        $user = User::factory()->unverified()->create();

        $this->attempt($user, 'not-the-password')
            ->assertHasErrors(['data.email'])
            ->assertDontSee(__('Your e-mail address is not verified yet. We have sent you a new verification link.'));

        Notification::assertNothingSent();
    }

    public function test_an_account_awaiting_approval_is_told_so(): void
    {
        $user = User::factory()->pendingApproval()->create();

        $this->attempt($user)
            ->assertHasErrors(['data.email'])
            ->assertSee(__('Your account is awaiting approval by an administrator.'));

        $this->assertGuest();
    }

    public function test_a_suspended_account_gets_the_ordinary_failure(): void
    {
        $user = User::factory()->suspended()->create();
        $user->givePermissionTo(Permission::ACCESS_ADMIN_PANEL->value);

        $this->attempt($user)
            ->assertHasErrors(['data.email'])
            ->assertSee(__('filament-panels::pages/auth/login.messages.failed'));

        $this->assertGuest();
    }
}
