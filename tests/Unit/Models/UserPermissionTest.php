<?php

namespace Tests\Unit\Models;

use App\Enums\Permission as PermissionEnum;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class UserPermissionTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_be_assigned_role_with_permissions(): void
    {
        // Permissions already exist from TestCase::ensurePermissionsExist()
        $viewPermission = Permission::findByName(PermissionEnum::VIEW_DATA->value);
        $createPermission = Permission::findByName(PermissionEnum::CREATE_DATA->value);
        $managePermission = Permission::findByName(PermissionEnum::MANAGE_USERS->value);

        // Create a role with specific permissions
        $role = Role::create(['name' => 'Test Role']);
        $role->givePermissionTo([$viewPermission, $createPermission]);

        $user = User::factory()->create();

        // Test: Assign role to user
        $user->assignRole($role);

        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        // Verify: User has the role and its permissions
        $this->assertTrue($user->hasRole('Test Role'));
        $this->assertTrue($user->hasPermissionTo(PermissionEnum::VIEW_DATA->value));
        $this->assertTrue($user->hasPermissionTo(PermissionEnum::CREATE_DATA->value));

        // Verify: User doesn't have permissions not in the role
        $this->assertFalse($user->hasPermissionTo(PermissionEnum::MANAGE_USERS->value));
    }

    public function test_user_can_be_given_direct_permissions(): void
    {
        $user = User::factory()->create();
        $permission = Permission::findByName(PermissionEnum::VIEW_DATA->value);

        // Test: Give permission directly to user
        $user->givePermissionTo($permission);

        // Verify: User has the permission directly
        $this->assertTrue($user->hasPermissionTo(PermissionEnum::VIEW_DATA->value));
        $this->assertTrue($user->hasDirectPermission(PermissionEnum::VIEW_DATA->value));
    }

    public function test_user_without_permissions_cannot_access_features(): void
    {
        // Permissions already exist from TestCase::ensurePermissionsExist()
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $user = User::factory()->create();

        // Test: User with no permissions cannot access any features
        $this->assertFalse($user->hasPermissionTo(PermissionEnum::VIEW_DATA->value));
        $this->assertFalse($user->hasPermissionTo(PermissionEnum::CREATE_DATA->value));
        $this->assertFalse($user->hasPermissionTo(PermissionEnum::MANAGE_USERS->value));
    }
}
