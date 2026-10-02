<?php

namespace Tests\Filament\Pages;

use App\Enums\Permission;
use App\Filament\Pages\ApiTokensPage;
use App\Filament\Pages\ProfilePage;
use App\Models\User;
use Filament\Facades\Filament;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\PersonalAccessToken;
use Livewire\Livewire;
use Tests\TestCase;

class ApiTokensPageTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected function setUp(): void
    {
        parent::setUp();
        Filament::setCurrentPanel(Filament::getPanel('admin'));

        $this->user = User::factory()->create();
        $this->user->givePermissionTo(Permission::ACCESS_ADMIN_PANEL->value);
        $this->actingAs($this->user);
    }

    public function test_the_page_is_reached_from_the_profile_page(): void
    {
        Livewire::test(ProfilePage::class)
            ->assertActionHasUrl('apiTokens', ApiTokensPage::getUrl());

        $this->get(ApiTokensPage::getUrl())->assertOk();
    }

    public function test_a_guest_is_sent_to_login(): void
    {
        auth()->logout();

        $this->get(ApiTokensPage::getUrl())->assertRedirect(Filament::getLoginUrl());
    }

    public function test_it_lists_only_the_signed_in_users_tokens(): void
    {
        $this->user->createToken('mine');
        User::factory()->create()->createToken('someone-elses');

        $mine = PersonalAccessToken::query()->where('name', 'mine')->firstOrFail();
        $theirs = PersonalAccessToken::query()->where('name', 'someone-elses')->firstOrFail();

        Livewire::test(ApiTokensPage::class)
            ->assertCanSeeTableRecords([$mine])
            ->assertCanNotSeeTableRecords([$theirs]);
    }

    public function test_creating_a_token_shows_its_plain_text_once(): void
    {
        $component = Livewire::test(ApiTokensPage::class)
            ->callAction('createToken', data: ['name' => 'Build server'])
            ->assertHasNoActionErrors()
            ->assertActionMounted('showToken');

        $token = $this->user->tokens()->where('name', 'Build server')->firstOrFail();

        /** @var array<int, array<string, string>> $arguments */
        $arguments = $component->get('mountedActionsArguments');
        $plainText = $arguments[0]['token'];

        // What the dialog shows is the token Sanctum stored the hash of
        [, $secret] = explode('|', $plainText, 2);
        $this->assertSame($token->token, hash('sha256', $secret));
    }

    public function test_a_created_token_authenticates_against_the_api(): void
    {
        $component = Livewire::test(ApiTokensPage::class)
            ->callAction('createToken', data: ['name' => 'Script']);

        /** @var array<int, array<string, string>> $arguments */
        $arguments = $component->get('mountedActionsArguments');

        auth()->logout();

        $this->withToken($arguments[0]['token'])
            ->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('id', $this->user->id);
    }

    public function test_a_token_needs_a_name(): void
    {
        Livewire::test(ApiTokensPage::class)
            ->callAction('createToken', data: ['name' => ''])
            ->assertHasActionErrors(['name' => 'required']);

        $this->assertCount(0, $this->user->tokens);
    }

    public function test_revoking_a_token_deletes_it(): void
    {
        $this->user->createToken('old');
        $token = PersonalAccessToken::query()->where('name', 'old')->firstOrFail();

        Livewire::test(ApiTokensPage::class)
            ->callTableAction('revoke', $token);

        $this->assertModelMissing($token);
    }
}
