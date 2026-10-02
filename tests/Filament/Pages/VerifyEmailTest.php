<?php

namespace Tests\Filament\Pages;

use App\Enums\Permission;
use App\Models\User;
use Filament\Facades\Filament;
use Illuminate\Auth\Events\Verified;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

class VerifyEmailTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Filament::setCurrentPanel(Filament::getPanel('admin'));
    }

    /**
     * The link exactly as the verification message carries it.
     */
    protected function linkFor(User $user): string
    {
        return (new VerifyEmail)->toMail($user)->actionUrl;
    }

    /**
     * The link without its signature and expiry.
     */
    protected function unsigned(string $link): string
    {
        return explode('?', $link, 2)[0];
    }

    public function test_the_message_links_to_the_panel_route(): void
    {
        $user = User::factory()->unverified()->create();

        $this->assertSame(
            route('filament.admin.auth.verify-email', ['id' => $user->getKey(), 'hash' => sha1($user->email)]),
            $this->unsigned($this->linkFor($user)),
        );
    }

    public function test_every_verification_message_carries_the_panel_link(): void
    {
        Notification::fake();
        $user = User::factory()->unverified()->create();

        // What the user list's "resend" action and a changed address both call
        $user->sendEmailVerificationNotification();

        Notification::assertSentTo($user, VerifyEmail::class, fn (VerifyEmail $notification): bool => $this->unsigned(
            $notification->toMail($user)->actionUrl,
        ) === route('filament.admin.auth.verify-email', ['id' => $user->getKey(), 'hash' => sha1($user->email)]));
    }

    public function test_the_link_verifies_an_account_awaiting_approval_without_a_session(): void
    {
        Event::fake([Verified::class]);
        $user = User::factory()->unverified()->pendingApproval()->create();

        $this->get($this->linkFor($user))
            ->assertRedirect(Filament::getPanel('admin')->getLoginUrl());

        $this->assertTrue($user->fresh()?->hasVerifiedEmail());
        Event::assertDispatched(Verified::class);
        $this->assertGuest();
    }

    public function test_a_link_with_the_hash_of_another_address_is_refused(): void
    {
        $user = User::factory()->unverified()->create();

        $url = URL::temporarySignedRoute('filament.admin.auth.verify-email', now()->addHour(), [
            'id' => $user->getKey(),
            'hash' => sha1('someone.else@example.com'),
        ]);

        $this->get($url)->assertForbidden();
        $this->assertFalse($user->fresh()?->hasVerifiedEmail());
    }

    public function test_an_unsigned_link_is_refused(): void
    {
        $user = User::factory()->unverified()->create();

        $this->get(route('filament.admin.auth.verify-email', [
            'id' => $user->getKey(),
            'hash' => sha1($user->email),
        ]))->assertForbidden();

        $this->assertFalse($user->fresh()?->hasVerifiedEmail());
    }

    public function test_an_expired_link_is_refused(): void
    {
        $user = User::factory()->unverified()->create();
        $link = $this->linkFor($user);

        $this->travel(2)->days();

        $this->get($link)->assertForbidden();
        $this->assertFalse($user->fresh()?->hasVerifiedEmail());
    }

    public function test_a_signed_in_user_who_can_enter_the_panel_goes_straight_back_to_it(): void
    {
        // An administrator, say, whose changed address needs verifying again
        $user = User::factory()->unverified()->create();
        $user->givePermissionTo(Permission::ACCESS_ADMIN_PANEL->value);

        $this->actingAs($user)
            ->get($this->linkFor($user))
            ->assertRedirect(Filament::getPanel('admin')->getUrl());

        $this->assertTrue($user->fresh()?->hasVerifiedEmail());
    }

    public function test_an_address_already_verified_is_left_as_it_is(): void
    {
        Event::fake([Verified::class]);
        $user = User::factory()->create(['email_verified_at' => now()->subWeek()]);
        $verifiedAt = $user->email_verified_at;

        $this->get($this->linkFor($user))->assertRedirect(Filament::getPanel('admin')->getLoginUrl());

        $this->assertEquals($verifiedAt, $user->fresh()?->email_verified_at);
        Event::assertNotDispatched(Verified::class);
    }
}
