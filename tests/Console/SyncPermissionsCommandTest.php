<?php

namespace Tests\Console;

use App\Enums\Permission as PermissionEnum;
use App\Enums\Role as RoleEnum;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithConsoleEvents;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * permissions:sync makes the database match App\Enums\Role and
 * App\Enums\Permission (RoleSync), and never changes who holds which role.
 */
class SyncPermissionsCommandTest extends TestCase
{
    use RefreshDatabase;

    // Artisan's command events, which tests turn off and the audit log listens to
    use WithConsoleEvents;

    public function test_it_creates_every_permission_and_role_of_the_enums(): void
    {
        Role::query()->delete();
        Permission::query()->delete();

        $this->artisan('permissions:sync')->assertExitCode(0);

        foreach (PermissionEnum::cases() as $permission) {
            $this->assertDatabaseHas('permissions', ['name' => $permission->value, 'guard_name' => 'web']);
        }

        foreach (RoleEnum::cases() as $case) {
            $role = Role::findByName($case->value, 'web');
            $this->assertEqualsCanonicalizing($case->permissionNames(), $role->permissions->pluck('name')->all());
        }
    }

    public function test_the_four_roles_carry_the_decided_permissions(): void
    {
        $this->assertEqualsCanonicalizing(['view data', 'access-admin-panel', 'access-mcp'], RoleEnum::VISITOR->permissionNames());
        $this->assertEqualsCanonicalizing(
            ['view data', 'create data', 'update data', 'delete data', 'access-admin-panel', 'access-mcp'],
            RoleEnum::DATA_MANAGER->permissionNames(),
        );
        $this->assertEqualsCanonicalizing(['manage users', 'access-admin-panel', 'access-mcp'], RoleEnum::USER_MANAGER->permissionNames());
        $this->assertEqualsCanonicalizing(
            ['manage users', 'manage user managers', 'access-admin-panel', 'access-mcp'],
            RoleEnum::SUPERADMIN->permissionNames(),
        );
    }

    public function test_it_resets_a_role_whose_permissions_drifted(): void
    {
        $visitor = Role::findByName(RoleEnum::VISITOR->value, 'web');
        $visitor->givePermissionTo(PermissionEnum::DELETE_DATA->value);

        $this->artisan('permissions:sync')->assertExitCode(0);

        $this->assertEqualsCanonicalizing(
            RoleEnum::VISITOR->permissionNames(),
            $visitor->fresh()?->permissions->pluck('name')->all() ?? [],
        );
    }

    public function test_it_removes_permissions_and_unheld_roles_the_enums_no_longer_define(): void
    {
        Permission::create(['name' => 'manage roles', 'guard_name' => 'web']);
        Role::create(['name' => 'Old Role', 'guard_name' => 'web']);

        $this->artisan('permissions:sync')->assertExitCode(0);

        $this->assertDatabaseMissing('permissions', ['name' => 'manage roles']);
        $this->assertDatabaseMissing('roles', ['name' => 'Old Role']);
    }

    public function test_it_refuses_to_remove_a_role_someone_still_holds(): void
    {
        $role = Role::create(['name' => 'Old Role', 'guard_name' => 'web']);
        User::factory()->create()->assignRole($role);

        $this->artisan('permissions:sync')->assertExitCode(1);

        $this->assertDatabaseHas('roles', ['name' => 'Old Role']);
    }

    public function test_it_keeps_role_assignments(): void
    {
        $user = User::factory()->create();
        $user->assignRole(RoleEnum::DATA_MANAGER->value);

        $this->artisan('permissions:sync')->assertExitCode(0);
        $this->artisan('permissions:sync')->assertExitCode(0);

        $this->assertSame(RoleEnum::DATA_MANAGER, $user->fresh()?->currentRole());
    }

    public function test_it_is_idempotent_and_logs_only_real_changes(): void
    {
        $synced = fn (): int => AuditLog::query()->where('action', 'roles.synced')->count();
        $before = $synced();

        $this->artisan('permissions:sync')->expectsOutputToContain('already match')->assertExitCode(0);

        $this->assertSame($before, $synced());
        $this->assertTrue(AuditLog::query()->where('action', 'console.command')->exists());

        Role::findByName(RoleEnum::VISITOR->value, 'web')->givePermissionTo(PermissionEnum::DELETE_DATA->value);
        $this->artisan('permissions:sync')->assertExitCode(0);

        $this->assertSame($before + 1, $synced());
    }
}
