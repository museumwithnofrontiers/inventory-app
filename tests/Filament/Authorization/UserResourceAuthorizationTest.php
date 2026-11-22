<?php

namespace Tests\Filament\Authorization;

use App\Enums\Permission;
use App\Enums\Role;
use App\Models\User;
use App\Support\Authorization\UserRoles;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserResourceAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_users_without_manage_users_permission_cannot_see_user_resource(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo(Permission::ACCESS_ADMIN_PANEL->value);

        $this->actingAs($user)->get('/admin')
            ->assertOk()
            ->assertDontSee('Users');

        $this->actingAs($user)->get('/admin/users')
            ->assertForbidden();
    }

    public function test_users_with_manage_users_permission_can_access_user_index(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo([
            Permission::ACCESS_ADMIN_PANEL->value,
            Permission::MANAGE_USERS->value,
        ]);

        $this->actingAs($user)->get('/admin/users')
            ->assertOk();
    }

    public function test_user_managers_can_delete_other_users(): void
    {
        $manager = User::factory()->create(['email_verified_at' => now()]);
        $manager->assignRole(Role::USER_MANAGER->value);

        $target = User::factory()->create(['email_verified_at' => now()]);

        $this->actingAs($manager)->get("/admin/users/{$target->getKey()}/edit")
            ->assertOk()
            ->assertSee('Delete');
    }

    public function test_a_user_manager_cannot_open_the_superadmin_or_another_user_manager(): void
    {
        $manager = User::factory()->create(['email_verified_at' => now()]);
        $manager->assignRole(Role::USER_MANAGER->value);

        $peer = User::factory()->create(['email_verified_at' => now()]);
        $peer->assignRole(Role::USER_MANAGER->value);

        $superadmin = User::factory()->create(['email_verified_at' => now()]);
        app(UserRoles::class)->assign($superadmin, Role::SUPERADMIN);

        $this->actingAs($manager)->get("/admin/users/{$peer->getKey()}/edit")->assertForbidden();
        $this->actingAs($manager)->get("/admin/users/{$superadmin->getKey()}/edit")->assertForbidden();
    }

    public function test_user_cannot_delete_themselves(): void
    {
        $manager = User::factory()->create(['email_verified_at' => now()]);
        $manager->assignRole(Role::USER_MANAGER->value);

        $this->actingAs($manager)->delete("/admin/users/{$manager->getKey()}");

        $this->assertDatabaseHas('users', ['id' => $manager->id]);
    }

    public function test_unauthenticated_users_are_redirected_to_login(): void
    {
        $this->get('/admin/users')
            ->assertRedirect('/admin/login');
    }
}
