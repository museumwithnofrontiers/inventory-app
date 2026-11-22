<?php

namespace Tests\Console;

use App\Enums\Role;
use App\Models\AuditLog;
use App\Models\User;
use App\Support\Authorization\UserRoles;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithConsoleEvents;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role as RoleModel;
use Tests\TestCase;

/**
 * The account commands (user:set-role, user:remove-role, user:superadmin),
 * their audit log entries, and the migration to one role per user.
 */
class UserRoleCommandsTest extends TestCase
{
    use RefreshDatabase;

    // Artisan's command events, which tests turn off and the audit log listens to
    use WithConsoleEvents;

    public function test_set_role_replaces_the_one_role(): void
    {
        $user = User::factory()->create(['email' => 'someone@example.com']);
        $user->assignRole(Role::VISITOR->value);

        $this->artisan('user:set-role', ['email' => 'someone@example.com', 'role' => 'Manager of Data'])->assertExitCode(0);

        $this->assertSame([Role::DATA_MANAGER->value], $user->fresh()?->roles->pluck('name')->all());
        $this->assertDatabaseHas('audit_logs', ['action' => 'console.command', 'subject_label' => 'user:set-role']);
    }

    public function test_assign_role_is_an_alias(): void
    {
        $user = User::factory()->create(['email' => 'someone@example.com']);

        $this->artisan('user:assign-role', ['email' => 'someone@example.com', 'role' => 'Visitor'])->assertExitCode(0);

        $this->assertSame(Role::VISITOR, $user->fresh()?->currentRole());
    }

    public function test_set_role_never_gives_or_takes_the_superadmin_role(): void
    {
        $user = User::factory()->create(['email' => 'someone@example.com']);
        $superadmin = User::factory()->create(['email' => 'boss@example.com']);
        app(UserRoles::class)->assign($superadmin, Role::SUPERADMIN);

        $this->artisan('user:set-role', ['email' => 'someone@example.com', 'role' => 'Superadmin'])->assertExitCode(1);
        $this->artisan('user:set-role', ['email' => 'boss@example.com', 'role' => 'Visitor'])->assertExitCode(1);
        $this->artisan('user:remove-role', ['email' => 'boss@example.com'])->assertExitCode(1);
        $this->artisan('user:set-role', ['email' => 'someone@example.com', 'role' => 'Unknown'])->assertExitCode(1);

        $this->assertNull($user->fresh()?->currentRole());
        $this->assertSame(Role::SUPERADMIN, $superadmin->fresh()?->currentRole());
    }

    public function test_remove_role_leaves_no_role(): void
    {
        $user = User::factory()->create(['email' => 'someone@example.com']);
        $user->assignRole(Role::DATA_MANAGER->value);

        $this->artisan('user:remove-role', ['email' => 'someone@example.com'])->assertExitCode(0);

        $this->assertNull($user->fresh()?->currentRole());
    }

    public function test_superadmin_moves_the_role(): void
    {
        $old = User::factory()->create(['email' => 'old@example.com']);
        $new = User::factory()->create(['email' => 'new@example.com']);
        app(UserRoles::class)->assign($old, Role::SUPERADMIN);

        $this->artisan('user:superadmin', ['email' => 'new@example.com'])->assertExitCode(0);

        $this->assertSame(Role::SUPERADMIN, $new->fresh()?->currentRole());
        $this->assertSame(Role::USER_MANAGER, $old->fresh()?->currentRole());

        $entry = AuditLog::query()->where('action', 'console.command')->where('subject_label', 'user:superadmin')->firstOrFail();
        $this->assertSame(['email' => 'new@example.com'], $entry->changes['arguments'] ?? null);
        $this->assertNull($entry->actor_id);
    }

    public function test_the_migration_converts_old_accounts(): void
    {
        /** @var Migration $migration */
        $migration = require database_path('migrations/2026_11_22_200100_one_role_per_user.php');
        $migration->down();

        // The old shape: "Regular User", "Non-verified users", an obsolete permission,
        // a user with two roles and one with a direct permission
        RoleModel::findByName(Role::DATA_MANAGER->value, 'web')->update(['name' => 'Regular User']);
        RoleModel::findByName(Role::SUPERADMIN->value, 'web')->delete();
        RoleModel::create(['name' => 'Non-verified users', 'guard_name' => 'web']);
        Permission::create(['name' => 'manage roles', 'guard_name' => 'web']);

        $firstManager = User::factory()->create(['created_at' => now()->subYear()]);
        $firstManager->assignRole('Manager of Users');
        $laterManager = User::factory()->create(['created_at' => now()->subMonth()]);
        $laterManager->assignRole('Manager of Users');
        $both = User::factory()->create();
        $both->assignRole(['Regular User', 'Visitor']);
        $editor = User::factory()->create();
        $editor->assignRole('Regular User');
        $pending = User::factory()->create();
        $pending->assignRole('Non-verified users');
        $direct = User::factory()->create();
        $direct->givePermissionTo('view data');

        $migration->up();

        $this->assertSame(Role::SUPERADMIN, $firstManager->fresh()?->currentRole());
        $this->assertSame(Role::USER_MANAGER, $laterManager->fresh()?->currentRole());
        $this->assertSame([Role::DATA_MANAGER->value], $both->fresh()?->roles->pluck('name')->all());
        $this->assertSame(Role::DATA_MANAGER, $editor->fresh()?->currentRole());
        $this->assertNull($pending->fresh()?->currentRole());
        $this->assertSame([], $direct->fresh()?->getDirectPermissions()->pluck('name')->all());
        $this->assertDatabaseMissing('roles', ['name' => 'Regular User']);
        $this->assertDatabaseMissing('roles', ['name' => 'Non-verified users']);
        $this->assertDatabaseMissing('permissions', ['name' => 'manage roles']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'user.direct_permissions_removed', 'subject_id' => (string) $direct->id]);
    }
}
