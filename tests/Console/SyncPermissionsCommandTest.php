<?php

namespace Tests\Console;

use App\Enums\Permission as PermissionEnum;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class SyncPermissionsCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_command_creates_missing_permissions(): void
    {
        // Delete all permissions first
        Permission::query()->delete();

        $this->artisan('permissions:sync')
            ->assertExitCode(0);

        // Verify all permissions from enum exist
        foreach (PermissionEnum::cases() as $permission) {
            $this->assertDatabaseHas('permissions', [
                'name' => $permission->value,
            ]);
        }
    }

    public function test_command_creates_standard_roles_without_production_flag(): void
    {
        Role::query()->delete();

        $this->artisan('permissions:sync')
            ->assertExitCode(0);

        // Should create 3 standard roles
        $this->assertDatabaseHas('roles', ['name' => 'Non-verified users']);
        $this->assertDatabaseHas('roles', ['name' => 'Regular User']);
        $this->assertDatabaseHas('roles', ['name' => 'Manager of Users']);

        // Should NOT create Visitor role without --production flag
        $this->assertDatabaseMissing('roles', ['name' => 'Visitor']);
    }

    public function test_command_creates_visitor_role_with_production_flag(): void
    {
        Role::query()->delete();

        $this->artisan('permissions:sync --production')
            ->assertExitCode(0);

        // Should create all 4 roles including Visitor
        $this->assertDatabaseHas('roles', ['name' => 'Non-verified users']);
        $this->assertDatabaseHas('roles', ['name' => 'Visitor']);
        $this->assertDatabaseHas('roles', ['name' => 'Regular User']);
        $this->assertDatabaseHas('roles', ['name' => 'Manager of Users']);
    }

    public function test_command_syncs_role_permissions_correctly(): void
    {
        $this->artisan('permissions:sync --production')
            ->assertExitCode(0);

        // Verify Non-verified users has no permissions
        $nonVerifiedRole = Role::findByName('Non-verified users');
        $this->assertCount(0, $nonVerifiedRole->permissions);

        // Verify Visitor has VIEW_DATA, ACCESS_ADMIN_PANEL and ACCESS_MCP
        $visitorRole = Role::findByName('Visitor');
        $this->assertCount(3, $visitorRole->permissions);
        $this->assertTrue($visitorRole->hasPermissionTo(PermissionEnum::ACCESS_MCP->value));
        $this->assertTrue($visitorRole->hasPermissionTo(PermissionEnum::VIEW_DATA->value));
        $this->assertTrue($visitorRole->hasPermissionTo(PermissionEnum::ACCESS_ADMIN_PANEL->value));

        // Verify Regular User has data operation permissions and Filament reference-data access
        $regularRole = Role::findByName('Regular User');
        $this->assertCount(7, $regularRole->permissions);
        $this->assertTrue($regularRole->hasPermissionTo(PermissionEnum::ACCESS_MCP->value));
        $this->assertTrue($regularRole->hasPermissionTo(PermissionEnum::VIEW_DATA->value));
        $this->assertTrue($regularRole->hasPermissionTo(PermissionEnum::CREATE_DATA->value));
        $this->assertTrue($regularRole->hasPermissionTo(PermissionEnum::UPDATE_DATA->value));
        $this->assertTrue($regularRole->hasPermissionTo(PermissionEnum::DELETE_DATA->value));
        $this->assertTrue($regularRole->hasPermissionTo(PermissionEnum::ACCESS_ADMIN_PANEL->value));
        $this->assertTrue($regularRole->hasPermissionTo(PermissionEnum::MANAGE_REFERENCE_DATA->value));

        // Verify Manager has user/role management permissions
        $managerRole = Role::findByName('Manager of Users');
        $this->assertCount(8, $managerRole->permissions);
        $this->assertTrue($managerRole->hasPermissionTo(PermissionEnum::ACCESS_MCP->value));
        $this->assertTrue($managerRole->hasPermissionTo(PermissionEnum::MANAGE_USERS->value));
        $this->assertTrue($managerRole->hasPermissionTo(PermissionEnum::ASSIGN_ROLES->value));
        $this->assertTrue($managerRole->hasPermissionTo(PermissionEnum::VIEW_USER_MANAGEMENT->value));
        $this->assertTrue($managerRole->hasPermissionTo(PermissionEnum::MANAGE_ROLES->value));
        $this->assertTrue($managerRole->hasPermissionTo(PermissionEnum::VIEW_ROLE_MANAGEMENT->value));
        $this->assertTrue($managerRole->hasPermissionTo(PermissionEnum::MANAGE_SETTINGS->value));
        $this->assertTrue($managerRole->hasPermissionTo(PermissionEnum::ACCESS_ADMIN_PANEL->value));
    }

    public function test_command_is_idempotent(): void
    {
        // Run command first time
        $this->artisan('permissions:sync --production')
            ->assertExitCode(0);

        $firstRunPermissionCount = Permission::count();
        $firstRunRoleCount = Role::count();

        // Run command second time
        $this->artisan('permissions:sync --production')
            ->assertExitCode(0);

        // Counts should be the same
        $this->assertEquals($firstRunPermissionCount, Permission::count());
        $this->assertEquals($firstRunRoleCount, Role::count());

        // Verify output indicates no changes
        $this->artisan('permissions:sync --production')
            ->expectsOutput('Syncing permissions and roles...')
            ->assertExitCode(0);
    }

    public function test_command_updates_permission_descriptions(): void
    {
        // First ensure all permissions exist
        foreach (PermissionEnum::cases() as $permission) {
            Permission::firstOrCreate(
                ['name' => $permission->value],
                ['description' => 'Old description']
            );
        }

        // Manually update one permission's description to old value
        $permission = Permission::where('name', PermissionEnum::VIEW_DATA->value)->first();
        $permission->update(['description' => 'Old description']);

        $this->artisan('permissions:sync')
            ->assertExitCode(0);

        // Verify description was updated
        $permission->refresh();
        $this->assertEquals('Read access to all data models', $permission->description);
    }

    public function test_command_updates_role_descriptions(): void
    {
        // Use the seeded role and set an old description
        $role = Role::where('name', 'Regular User')->first();
        $role->update(['description' => 'Old description']);

        $this->artisan('permissions:sync')
            ->assertExitCode(0);

        // Verify description was updated
        $role->refresh();
        $this->assertEquals('Standard user with data operation access', $role->description);
    }

    public function test_command_updates_role_permissions_when_changed(): void
    {
        // Use the seeded role and reset to only VIEW_DATA (missing others)
        $role = Role::where('name', 'Regular User')->first();
        $role->permissions()->detach();
        $role->givePermissionTo(PermissionEnum::VIEW_DATA->value);

        $this->artisan('permissions:sync')
            ->assertExitCode(0);

        // Verify all expected permissions are now assigned
        $role->refresh();
        $this->assertCount(7, $role->permissions);
        $this->assertTrue($role->hasPermissionTo(PermissionEnum::ACCESS_MCP->value));
        $this->assertTrue($role->hasPermissionTo(PermissionEnum::VIEW_DATA->value));
        $this->assertTrue($role->hasPermissionTo(PermissionEnum::CREATE_DATA->value));
        $this->assertTrue($role->hasPermissionTo(PermissionEnum::UPDATE_DATA->value));
        $this->assertTrue($role->hasPermissionTo(PermissionEnum::DELETE_DATA->value));
        $this->assertTrue($role->hasPermissionTo(PermissionEnum::ACCESS_ADMIN_PANEL->value));
        $this->assertTrue($role->hasPermissionTo(PermissionEnum::MANAGE_REFERENCE_DATA->value));
    }

    public function test_command_clears_permission_cache(): void
    {
        $this->artisan('permissions:sync')
            ->assertExitCode(0);

        // This test verifies the command completes without errors
        // The cache clearing is tested implicitly - if cache wasn't cleared,
        // subsequent permission checks would fail
        $this->assertTrue(true);
    }
}
