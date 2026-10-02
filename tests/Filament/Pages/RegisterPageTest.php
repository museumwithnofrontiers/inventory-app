<?php

namespace Tests\Filament\Pages;

use App\Filament\Auth\Register;
use App\Models\Setting;
use App\Models\User;
use Filament\Facades\Filament;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Livewire\Features\SupportTesting\Testable;
use Livewire\Livewire;
use Tests\TestCase;

class RegisterPageTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Filament::setCurrentPanel(Filament::getPanel('admin'));
    }

    protected function openRegistration(bool $open = true): void
    {
        Setting::set('self_registration_enabled', $open, 'boolean');
    }

    protected function fillForm(string $email = 'new.user@example.com'): Testable
    {
        return Livewire::test(Register::class)
            ->set('data.name', 'New User')
            ->set('data.email', $email)
            ->set('data.password', 'a-Long-passw0rd')
            ->set('data.passwordConfirmation', 'a-Long-passw0rd');
    }

    public function test_the_page_returns_to_login_while_registration_is_closed(): void
    {
        $this->openRegistration(false);

        Livewire::test(Register::class)
            ->assertRedirect(Filament::getLoginUrl())
            ->assertNotified();
    }

    public function test_the_page_renders_while_registration_is_open(): void
    {
        $this->openRegistration();

        $this->get(Filament::getRegistrationUrl())
            ->assertOk()
            ->assertSeeLivewire(Register::class);
    }

    public function test_registering_creates_an_account_that_still_needs_verification_and_approval(): void
    {
        Notification::fake();
        $this->openRegistration();

        $this->fillForm()->call('register')->assertHasNoErrors();

        $user = User::query()->where('email', 'new.user@example.com')->firstOrFail();
        $this->assertSame('New User', $user->name);
        $this->assertNull($user->email_verified_at);
        $this->assertNull($user->approved_at);
        $this->assertCount(0, $user->getAllPermissions());
        $this->assertCount(0, $user->roles);
    }

    public function test_registering_sends_a_verification_link_to_the_panel(): void
    {
        Notification::fake();
        $this->openRegistration();

        $this->fillForm()->call('register');

        $user = User::query()->where('email', 'new.user@example.com')->firstOrFail();
        Notification::assertSentToTimes($user, VerifyEmail::class, 1);
        Notification::assertSentTo($user, VerifyEmail::class, function (VerifyEmail $notification) use ($user): bool {
            $url = explode('?', $notification->toMail($user)->actionUrl, 2)[0];

            return $url === route('filament.admin.auth.verify-email', ['id' => $user->getKey(), 'hash' => sha1($user->email)]);
        });
    }

    public function test_registering_returns_to_login_without_signing_in(): void
    {
        Notification::fake();
        $this->openRegistration();

        $this->fillForm()
            ->call('register')
            ->assertRedirect(Filament::getLoginUrl())
            ->assertNotified();

        $this->assertGuest();
    }

    public function test_registering_is_refused_when_registration_closed_after_the_form_opened(): void
    {
        $this->openRegistration();
        $form = $this->fillForm();

        $this->openRegistration(false);
        $form->call('register')->assertRedirect(Filament::getLoginUrl());

        $this->assertDatabaseMissing('users', ['email' => 'new.user@example.com']);
    }

    public function test_a_password_that_does_not_match_its_confirmation_is_rejected(): void
    {
        $this->openRegistration();

        $this->fillForm()
            ->set('data.passwordConfirmation', 'something-else-entirely')
            ->call('register')
            ->assertHasErrors(['data.password']);

        $this->assertDatabaseMissing('users', ['email' => 'new.user@example.com']);
    }

    public function test_an_address_already_registered_is_rejected(): void
    {
        $this->openRegistration();
        User::factory()->create(['email' => 'taken@example.com']);

        $this->fillForm('taken@example.com')
            ->call('register')
            ->assertHasErrors(['data.email']);
    }

    public function test_the_login_page_offers_registration_only_while_it_is_open(): void
    {
        $this->openRegistration(false);
        $this->get(Filament::getLoginUrl())->assertOk()->assertDontSee(Filament::getRegistrationUrl());

        $this->openRegistration();
        $this->get(Filament::getLoginUrl())->assertOk()->assertSee(Filament::getRegistrationUrl());
    }
}
