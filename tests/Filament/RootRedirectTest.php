<?php

namespace Tests\Filament;

use App\Enums\Permission;
use App\Models\User;
use Filament\Facades\Filament;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RootRedirectTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_root_redirects_to_the_panel(): void
    {
        $this->get(route('root'))->assertRedirect(url(Filament::getPanel('admin')->getPath()));
    }

    public function test_a_guest_reaching_the_panel_is_sent_to_its_login(): void
    {
        $this->get(url(Filament::getPanel('admin')->getPath()))
            ->assertRedirect(Filament::getPanel('admin')->getLoginUrl());
    }

    public function test_a_signed_in_user_lands_on_the_dashboard(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo(Permission::ACCESS_ADMIN_PANEL->value);

        $this->actingAs($user)
            ->followingRedirects()
            ->get(route('root'))
            ->assertOk()
            ->assertSee('Dashboard');
    }
}
