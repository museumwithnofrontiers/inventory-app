<?php

namespace Tests\Filament\Authorization;

use App\Enums\Permission;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SelfRegistrationSettingsPageAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_users_without_manage_users_permission_cannot_access_self_registration_settings(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo(Permission::ACCESS_ADMIN_PANEL->value);

        $this->actingAs($user)->get('/admin/self-registration-settings-page')
            ->assertForbidden();
    }

    public function test_users_with_manage_users_permission_can_access_self_registration_settings(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo([
            Permission::ACCESS_ADMIN_PANEL->value,
            Permission::MANAGE_USERS->value,
        ]);

        $this->actingAs($user)->get('/admin/self-registration-settings-page')
            ->assertOk();
    }

    public function test_self_registration_settings_does_not_appear_in_nav_for_unpermitted_users(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo(Permission::ACCESS_ADMIN_PANEL->value);

        $this->actingAs($user)->get('/admin')
            ->assertOk()
            ->assertDontSee('Self-Registration');
    }

    public function test_self_registration_settings_appears_in_nav_for_permitted_users(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo([
            Permission::ACCESS_ADMIN_PANEL->value,
            Permission::MANAGE_USERS->value,
        ]);

        $this->actingAs($user)->get('/admin')
            ->assertOk()
            ->assertSee('Self-Registration');
    }

    public function test_unauthenticated_users_are_redirected_to_login(): void
    {
        $this->get('/admin/self-registration-settings-page')
            ->assertRedirect('/admin/login');
    }
}
