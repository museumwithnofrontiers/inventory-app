<?php

namespace Tests\Filament\Resources;

use App\Enums\Permission;
use App\Filament\Resources\UserResource\Pages\CreateUser;
use App\Filament\Resources\UserResource\Pages\EditUser;
use App\Filament\Resources\UserResource\Pages\ListUser;
use App\Models\User;
use App\Notifications\AdminPasswordResetNotification;
use Filament\Tables\Actions\DeleteAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Livewire\Livewire;
use Spatie\Permission\Models\Role;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

class UserResourceTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    // ── Helpers ───────────────────────────────────────────────────────────────

    protected function createManagerUser(): User
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo([
            Permission::ACCESS_ADMIN_PANEL->value,
            Permission::MANAGE_USERS->value,
            Permission::ASSIGN_ROLES->value,
        ]);

        return $user;
    }

    protected function createManageOnlyUser(): User
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo([
            Permission::ACCESS_ADMIN_PANEL->value,
            Permission::MANAGE_USERS->value,
        ]);

        return $user;
    }

    // ── Page rendering ────────────────────────────────────────────────────────

    public function test_authorized_users_can_render_all_user_resource_pages(): void
    {
        $manager = $this->createManagerUser();
        $target = User::factory()->create(['email_verified_at' => now()]);

        $this->actingAs($manager)->get('/admin/users')
            ->assertOk()
            ->assertSee('Users');

        $this->actingAs($manager)->get('/admin/users/create')
            ->assertOk();

        $this->actingAs($manager)->get("/admin/users/{$target->getKey()}/edit")
            ->assertOk()
            ->assertSee($target->name);

        $this->actingAs($manager)->get("/admin/users/{$target->getKey()}")
            ->assertOk()
            ->assertSee($target->name);
    }

    // ── Create ────────────────────────────────────────────────────────────────

    public function test_authorized_users_can_create_a_user(): void
    {
        $manager = $this->createManagerUser();

        $this->setCurrentPanel();

        Notification::fake();

        Livewire::actingAs($manager)
            ->test(CreateUser::class)
            ->fillForm([
                'name' => 'New User',
                'email' => 'newuser@example.com',
            ])
            ->call('create')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('users', [
            'name' => 'New User',
            'email' => 'newuser@example.com',
        ]);
    }

    public function test_creating_a_user_sends_invitation_email(): void
    {
        $manager = $this->createManagerUser();

        $this->setCurrentPanel();

        Notification::fake();

        Livewire::actingAs($manager)
            ->test(CreateUser::class)
            ->fillForm([
                'name' => 'Invited User',
                'email' => 'invited@example.com',
            ])
            ->call('create')
            ->assertHasNoFormErrors();

        $created = User::where('email', 'invited@example.com')->firstOrFail();
        Notification::assertSentTo($created, AdminPasswordResetNotification::class);
    }

    public function test_creating_a_user_sets_approved_at(): void
    {
        $manager = $this->createManagerUser();

        $this->setCurrentPanel();

        Notification::fake();

        Livewire::actingAs($manager)
            ->test(CreateUser::class)
            ->fillForm([
                'name' => 'Auto-Approved User',
                'email' => 'approved@example.com',
            ])
            ->call('create')
            ->assertHasNoFormErrors();

        $created = User::where('email', 'approved@example.com')->firstOrFail();
        $this->assertNotNull($created->approved_at);
    }

    // ── Edit ──────────────────────────────────────────────────────────────────

    public function test_authorized_users_can_edit_a_user(): void
    {
        $manager = $this->createManagerUser();
        $target = User::factory()->create([
            'name' => 'Old Name',
            'email' => 'old@example.com',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($manager)
            ->test(EditUser::class, ['record' => $target->getRouteKey()])
            ->fillForm([
                'name' => 'New Name',
                'email' => 'new@example.com',
            ])
            ->call('save')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('users', [
            'id' => $target->id,
            'name' => 'New Name',
            'email' => 'new@example.com',
        ]);
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    public function test_authorized_users_can_delete_a_user(): void
    {
        $manager = $this->createManagerUser();
        $target = User::factory()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($manager)
            ->test(ListUser::class)
            ->callTableAction(DeleteAction::class, $target)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('users', ['id' => $target->id]);
    }

    // ── Filters ───────────────────────────────────────────────────────────────

    public function test_user_resource_can_filter_by_role(): void
    {
        $manager = $this->createManagerUser();
        $role = Role::firstOrCreate(['name' => 'Test Role', 'guard_name' => 'web']);

        $userWithRole = User::factory()->create(['email_verified_at' => now()]);
        $userWithRole->syncRoles([$role]);

        $userWithoutRole = User::factory()->create(['email_verified_at' => now()]);

        $this->setCurrentPanel();

        Livewire::actingAs($manager)
            ->test(ListUser::class)
            ->filterTable('role', 'Test Role')
            ->assertCanSeeTableRecords([$userWithRole])
            ->assertCanNotSeeTableRecords([$userWithoutRole]);
    }

    public function test_user_resource_can_filter_by_email_verified(): void
    {
        $manager = $this->createManagerUser();
        $verified = User::factory()->create(['email_verified_at' => now()]);
        $unverified = User::factory()->create(['email_verified_at' => null]);

        $this->setCurrentPanel();

        Livewire::actingAs($manager)
            ->test(ListUser::class)
            ->filterTable('email_verified')
            ->assertCanSeeTableRecords([$verified, $manager])
            ->assertCanNotSeeTableRecords([$unverified]);
    }

    public function test_user_resource_can_filter_by_pending_approval(): void
    {
        $manager = $this->createManagerUser();
        $pending = User::factory()->create(['approved_at' => null]);
        $approved = User::factory()->create(['approved_at' => now()]);

        $this->setCurrentPanel();

        Livewire::actingAs($manager)
            ->test(ListUser::class)
            ->filterTable('pending_approval')
            ->assertCanSeeTableRecords([$pending])
            ->assertCanNotSeeTableRecords([$approved, $manager]);
    }

    public function test_user_resource_can_filter_by_suspended(): void
    {
        $manager = $this->createManagerUser();
        $suspended = User::factory()->create(['suspended_at' => now()]);
        $active = User::factory()->create(['suspended_at' => null]);

        $this->setCurrentPanel();

        Livewire::actingAs($manager)
            ->test(ListUser::class)
            ->filterTable('suspended')
            ->assertCanSeeTableRecords([$suspended])
            ->assertCanNotSeeTableRecords([$active, $manager]);
    }

    // ── Per-row actions ───────────────────────────────────────────────────────

    public function test_mark_email_verified_action_sets_email_verified_at(): void
    {
        $manager = $this->createManagerUser();
        $target = User::factory()->create(['email_verified_at' => null]);

        $this->setCurrentPanel();

        Livewire::actingAs($manager)
            ->test(ListUser::class)
            ->callTableAction('markEmailVerified', $target)
            ->assertHasNoTableActionErrors();

        $this->assertNotNull($target->fresh()->email_verified_at);
    }

    public function test_clear_email_verification_action_nulls_email_verified_at(): void
    {
        $manager = $this->createManagerUser();
        $target = User::factory()->create(['email_verified_at' => now()]);

        $this->setCurrentPanel();

        Livewire::actingAs($manager)
            ->test(ListUser::class)
            ->callTableAction('clearEmailVerification', $target)
            ->assertHasNoTableActionErrors();

        $this->assertNull($target->fresh()->email_verified_at);
    }

    public function test_approve_action_sets_approved_at(): void
    {
        $manager = $this->createManagerUser();
        $target = User::factory()->create(['approved_at' => null]);

        $this->setCurrentPanel();

        Livewire::actingAs($manager)
            ->test(ListUser::class)
            ->callTableAction('approve', $target)
            ->assertHasNoTableActionErrors();

        $this->assertNotNull($target->fresh()->approved_at);
    }

    public function test_suspend_action_sets_suspended_at(): void
    {
        $manager = $this->createManagerUser();
        $target = User::factory()->create(['suspended_at' => null]);

        $this->setCurrentPanel();

        Livewire::actingAs($manager)
            ->test(ListUser::class)
            ->callTableAction('suspend', $target)
            ->assertHasNoTableActionErrors();

        $this->assertNotNull($target->fresh()->suspended_at);
    }

    public function test_assign_role_action_syncs_the_role(): void
    {
        $manager = $this->createManagerUser();
        $target = User::factory()->create(['email_verified_at' => now()]);
        $role = Role::firstOrCreate(['name' => 'Editor', 'guard_name' => 'web']);

        $this->setCurrentPanel();

        Livewire::actingAs($manager)
            ->test(ListUser::class)
            ->callTableAction('assignRole', $target, data: ['role_id' => $role->id])
            ->assertHasNoTableActionErrors();

        $this->assertTrue($target->fresh()->hasRole('Editor'));
    }

    // ── Bulk actions ──────────────────────────────────────────────────────────

    public function test_bulk_approve_action_sets_approved_at_on_all_selected(): void
    {
        $manager = $this->createManagerUser();
        $users = User::factory()->count(2)->create(['approved_at' => null]);

        $this->setCurrentPanel();

        Livewire::actingAs($manager)
            ->test(ListUser::class)
            ->callTableBulkAction('approve', $users)
            ->assertHasNoTableActionErrors();

        foreach ($users as $user) {
            $this->assertNotNull($user->fresh()->approved_at);
        }
    }

    public function test_bulk_suspend_action_sets_suspended_at_on_all_selected(): void
    {
        $manager = $this->createManagerUser();
        $users = User::factory()->count(2)->create(['suspended_at' => null]);

        $this->setCurrentPanel();

        Livewire::actingAs($manager)
            ->test(ListUser::class)
            ->callTableBulkAction('suspend', $users)
            ->assertHasNoTableActionErrors();

        foreach ($users as $user) {
            $this->assertNotNull($user->fresh()->suspended_at);
        }
    }

    public function test_bulk_assign_role_action_syncs_role_on_all_selected(): void
    {
        $manager = $this->createManagerUser();
        $users = User::factory()->count(2)->create(['email_verified_at' => now()]);
        $role = Role::firstOrCreate(['name' => 'Reviewer', 'guard_name' => 'web']);

        $this->setCurrentPanel();

        Livewire::actingAs($manager)
            ->test(ListUser::class)
            ->callTableBulkAction('assignRole', $users, data: ['role_id' => $role->id])
            ->assertHasNoTableActionErrors();

        foreach ($users as $user) {
            $this->assertTrue($user->fresh()->hasRole('Reviewer'));
        }
    }

    // ── Role-assignment permission boundary ───────────────────────────────────

    public function test_user_without_assign_roles_cannot_see_assign_role_row_action(): void
    {
        $manager = $this->createManageOnlyUser();
        $target = User::factory()->create(['email_verified_at' => now()]);

        $this->setCurrentPanel();

        Livewire::actingAs($manager)
            ->test(ListUser::class)
            ->assertTableActionHidden('assignRole', $target);
    }

    public function test_user_with_assign_roles_can_see_assign_role_row_action(): void
    {
        $manager = $this->createManagerUser();
        $target = User::factory()->create(['email_verified_at' => now()]);

        $this->setCurrentPanel();

        Livewire::actingAs($manager)
            ->test(ListUser::class)
            ->assertTableActionVisible('assignRole', $target);
    }

    public function test_user_without_assign_roles_cannot_see_assign_role_bulk_action(): void
    {
        $manager = $this->createManageOnlyUser();

        $this->setCurrentPanel();

        Livewire::actingAs($manager)
            ->test(ListUser::class)
            ->assertTableBulkActionHidden('assignRole');
    }

    public function test_user_with_assign_roles_can_see_assign_role_bulk_action(): void
    {
        $manager = $this->createManagerUser();

        $this->setCurrentPanel();

        Livewire::actingAs($manager)
            ->test(ListUser::class)
            ->assertTableBulkActionVisible('assignRole');
    }

    // ── Self-suspend protection ───────────────────────────────────────────────

    public function test_suspend_row_action_is_hidden_for_self(): void
    {
        $manager = $this->createManagerUser();

        $this->setCurrentPanel();

        Livewire::actingAs($manager)
            ->test(ListUser::class)
            ->assertTableActionHidden('suspend', $manager);
    }

    public function test_suspend_row_action_is_visible_for_another_user(): void
    {
        $manager = $this->createManagerUser();
        $target = User::factory()->create(['suspended_at' => null]);

        $this->setCurrentPanel();

        Livewire::actingAs($manager)
            ->test(ListUser::class)
            ->assertTableActionVisible('suspend', $target);
    }
}
