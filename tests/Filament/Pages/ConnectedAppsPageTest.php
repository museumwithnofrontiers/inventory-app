<?php

namespace Tests\Filament\Pages;

use App\Enums\OAuthScope;
use App\Enums\Permission;
use App\Filament\Pages\ConnectedAppsPage;
use App\Filament\Pages\ProfilePage;
use App\Models\Item;
use App\Models\User;
use Filament\Facades\Filament;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Passport\Passport;
use Livewire\Livewire;
use Tests\TestCase;
use Tests\Traits\IssuesOAuthTokens;

class ConnectedAppsPageTest extends TestCase
{
    use IssuesOAuthTokens;
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        Filament::setCurrentPanel(Filament::getPanel('admin'));
        $this->user = User::factory()->create();
        $this->user->givePermissionTo([Permission::ACCESS_ADMIN_PANEL->value, Permission::VIEW_DATA->value]);
    }

    public function test_the_profile_page_links_to_the_page(): void
    {
        $this->actingAs($this->user, 'web');

        Livewire::test(ProfilePage::class)
            ->assertActionHasUrl('connectedApps', ConnectedAppsPage::getUrl());
        $this->get(ConnectedAppsPage::getUrl())->assertOk();
    }

    public function test_a_guest_is_sent_to_the_login(): void
    {
        $this->get(ConnectedAppsPage::getUrl())->assertRedirect(Filament::getLoginUrl());
    }

    public function test_it_lists_only_the_apps_the_user_authorized(): void
    {
        $mine = $this->createPublicOAuthClient('My assistant');
        $theirs = $this->createPublicOAuthClient('Their assistant');
        $other = User::factory()->create();
        $other->givePermissionTo([Permission::ACCESS_ADMIN_PANEL->value]);

        $this->issueOAuthToken($this->user, $mine, OAuthScope::API_READ->value);
        $this->issueOAuthToken($other, $theirs, OAuthScope::API_READ->value);

        $this->actingAs($this->user, 'web');
        Livewire::test(ConnectedAppsPage::class)
            ->assertCanSeeTableRecords([$mine])
            ->assertCanNotSeeTableRecords([$theirs])
            ->assertSee(OAuthScope::API_READ->value);
    }

    public function test_revoking_an_app_ends_its_access_at_once(): void
    {
        Item::factory()->create();
        $client = $this->createPublicOAuthClient('My assistant');
        $token = $this->issueOAuthToken($this->user, $client, OAuthScope::API_READ->value);
        $this->forgetBearerGuards();
        $this->withToken($token)->getJson(route('item.index'))->assertOk();
        $this->forgetBearerGuards();

        $this->actingAs($this->user, 'web');
        Livewire::test(ConnectedAppsPage::class)
            ->callTableAction('revoke', $client)
            ->assertCanNotSeeTableRecords([$client]);
        $this->forgetBearerGuards();

        $this->withToken($token)->getJson(route('item.index'))->assertUnauthorized();
        $this->assertFalse(
            Passport::refreshToken()->newQuery()->where('revoked', false)->exists(),
            'The refresh token must be revoked with the access token',
        );
    }
}
