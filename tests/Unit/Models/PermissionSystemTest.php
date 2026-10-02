<?php

namespace Tests\Unit\Models;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class PermissionSystemTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_can_create_roles_and_permissions(): void
    {
        // Create a role
        $role = Role::create(['name' => 'test-role']);

        $this->assertDatabaseHas('roles', [
            'name' => 'test-role',
        ]);

        // Create a permission
        $permission = Permission::create(['name' => 'test-permission']);

        $this->assertDatabaseHas('permissions', [
            'name' => 'test-permission',
        ]);

        // Assign permission to role
        $role->givePermissionTo($permission);

        $this->assertTrue($role->hasPermissionTo('test-permission'));
    }

    public function test_it_can_assign_roles_to_users(): void
    {
        $user = User::factory()->create();
        $role = Role::create(['name' => 'test-role']);

        // Assign role to user
        $user->assignRole($role);

        $this->assertTrue($user->hasRole('test-role'));
        $this->assertDatabaseHas('model_has_roles', [
            'model_type' => User::class,
            'model_id' => $user->id,
            'role_id' => $role->id,
        ]);
    }

    public function test_it_can_check_user_permissions(): void
    {
        $user = User::factory()->create();
        $role = Role::create(['name' => 'test-role']);
        $permission = Permission::create(['name' => 'test-permission']);

        $role->givePermissionTo($permission);
        $user->assignRole($role);

        $this->assertTrue($user->hasPermissionTo('test-permission'));
    }

    public function test_it_can_give_direct_permissions_to_users(): void
    {
        $user = User::factory()->create();
        $permission = Permission::create(['name' => 'direct-permission']);

        $user->givePermissionTo($permission);

        $this->assertTrue($user->hasPermissionTo('direct-permission'));
        $this->assertTrue($user->hasDirectPermission('direct-permission'));
    }
}
