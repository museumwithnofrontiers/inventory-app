<?php

namespace Tests\Unit\Policies;

use App\Enums\Permission;
use App\Models\User;
use App\Policies\PermissionPolicy;
use App\Policies\RolePolicy;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission as PermissionModel;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Roles and permissions are defined in code: user managers may look at them,
 * nobody creates, changes or deletes one in the panel.
 */
class RolePolicyTest extends TestCase
{
    use RefreshDatabase;

    private function userWithPermissions(string ...$permissions): User
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo($permissions);

        return $user;
    }

    public function test_user_managers_may_look_at_roles_and_permissions(): void
    {
        $manager = $this->userWithPermissions(Permission::MANAGE_USERS->value);
        $role = Role::findByName('Visitor', 'web');
        $permission = PermissionModel::findByName(Permission::VIEW_DATA->value, 'web');

        $this->assertTrue((new RolePolicy)->viewAny($manager));
        $this->assertTrue((new RolePolicy)->view($manager, $role));
        $this->assertTrue((new PermissionPolicy)->viewAny($manager));
        $this->assertTrue((new PermissionPolicy)->view($manager, $permission));
    }

    public function test_other_users_may_not(): void
    {
        $reader = $this->userWithPermissions(Permission::VIEW_DATA->value);

        $this->assertFalse((new RolePolicy)->viewAny($reader));
        $this->assertFalse((new PermissionPolicy)->viewAny($reader));
    }

    public function test_nobody_creates_changes_or_deletes_a_role_or_permission(): void
    {
        $manager = $this->userWithPermissions(Permission::MANAGE_USERS->value, Permission::MANAGE_USER_MANAGERS->value);
        $role = Role::findByName('Visitor', 'web');
        $permission = PermissionModel::findByName(Permission::VIEW_DATA->value, 'web');

        $this->assertFalse((new RolePolicy)->create($manager));
        $this->assertFalse((new RolePolicy)->update($manager, $role));
        $this->assertFalse((new RolePolicy)->delete($manager, $role));
        $this->assertFalse((new RolePolicy)->deleteAny($manager));
        $this->assertFalse((new PermissionPolicy)->create($manager));
        $this->assertFalse((new PermissionPolicy)->update($manager, $permission));
        $this->assertFalse((new PermissionPolicy)->delete($manager, $permission));
    }
}
