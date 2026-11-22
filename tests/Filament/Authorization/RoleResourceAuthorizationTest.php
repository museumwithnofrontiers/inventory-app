<?php

namespace Tests\Filament\Authorization;

use App\Enums\Permission;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class RoleResourceAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_users_without_manage_roles_permission_cannot_see_roles_resource(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo(Permission::ACCESS_ADMIN_PANEL->value);

        $this->actingAs($user)->get('/admin')
            ->assertOk()
            ->assertDontSee('Roles');

        $this->actingAs($user)->get('/admin/roles')
            ->assertForbidden();
    }

    public function test_user_managers_can_access_roles_index_and_view_a_role(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo([
            Permission::ACCESS_ADMIN_PANEL->value,
            Permission::MANAGE_USERS->value,
        ]);

        $role = Role::findByName('Visitor', 'web');

        $this->actingAs($user)->get('/admin/roles')
            ->assertOk();

        $this->actingAs($user)->get("/admin/roles/{$role->getKey()}")
            ->assertOk();
    }

    public function test_data_users_cannot_see_roles(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo(Permission::dataOperations());
        $user->givePermissionTo(Permission::ACCESS_ADMIN_PANEL->value);

        $this->actingAs($user)->get('/admin/roles')
            ->assertForbidden();
    }

    public function test_unauthenticated_users_are_redirected_to_login(): void
    {
        $this->get('/admin/roles')
            ->assertRedirect('/admin/login');
    }
}
