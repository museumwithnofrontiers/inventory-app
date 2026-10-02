<?php

namespace Tests\Filament;

use App\Enums\Permission;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserResourceTest extends TestCase
{
    use RefreshDatabase;

    public function test_authorized_users_can_access_the_filament_user_resource(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo([
            Permission::ACCESS_ADMIN_PANEL->value,
            Permission::MANAGE_USERS->value,
            Permission::ASSIGN_ROLES->value,
        ]);

        $response = $this->actingAs($user)->get('/admin/users');

        $response
            ->assertOk()
            ->assertSee('Users');
    }

    public function test_users_without_admin_panel_permission_receive_forbidden_on_the_filament_user_resource(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo(Permission::MANAGE_USERS->value);

        $response = $this->actingAs($user)->get('/admin/users');

        $response->assertForbidden();
    }

    public function test_policy_denied_actions_are_hidden_in_filament_user_pages(): void
    {
        $manager = User::factory()->create(['email_verified_at' => now()]);
        $manager->givePermissionTo([
            Permission::ACCESS_ADMIN_PANEL->value,
            Permission::MANAGE_USERS->value,
        ]);

        $target = User::factory()->create(['email_verified_at' => now()]);

        $indexResponse = $this->actingAs($manager)->get('/admin/users');
        $editResponse = $this->actingAs($manager)->get("/admin/users/{$target->getKey()}/edit");

        $indexResponse
            ->assertOk()
            ->assertDontSee('Delete');

        $editResponse
            ->assertOk()
            ->assertDontSee('Delete');
    }

    public function test_logging_out_from_filament_ends_the_session(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo([
            Permission::ACCESS_ADMIN_PANEL->value,
            Permission::VIEW_DATA->value,
        ]);

        $this->actingAs($user)->get('/admin')->assertOk();

        $response = $this->post(route('filament.admin.auth.logout'));

        $response->assertRedirect('/admin/login');
        $this->assertGuest();
        $this->get('/admin')->assertRedirect('/admin/login');
    }
}
