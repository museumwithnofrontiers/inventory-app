<?php

namespace Tests\Filament\Resources;

use App\Enums\Role as RoleEnum;
use App\Filament\Resources\UserResource;
use App\Filament\Resources\UserResource\Pages\CreateUser;
use App\Filament\Resources\UserResource\Pages\EditUser;
use App\Filament\Resources\UserResource\Pages\ListUser;
use App\Models\User;
use App\Notifications\AdminPasswordResetNotification;
use App\Support\Authorization\UserRoles;
use Filament\Actions\DeleteAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Livewire\Livewire;
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
        $user->assignRole(RoleEnum::USER_MANAGER->value);

        return $user;
    }

    protected function createSuperadmin(): User
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        app(UserRoles::class)->assign($user, RoleEnum::SUPERADMIN);

        return $user;
    }

    private const CONFIRM = ['confirm_current_password' => 'password'];

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
                'confirm_current_password' => 'password',
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
                'confirm_current_password' => 'password',
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
                'confirm_current_password' => 'password',
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
                'confirm_current_password' => 'password',
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
            ->callTableAction(DeleteAction::class, $target, data: ['confirm_current_password' => 'password'])
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('users', ['id' => $target->id]);
    }

    public function test_user_resource_can_filter_by_role(): void
    {
        $manager = $this->createManagerUser();

        $userWithRole = User::factory()->create(['email_verified_at' => now()]);
        $userWithRole->assignRole(RoleEnum::VISITOR->value);

        $userWithoutRole = User::factory()->create(['email_verified_at' => now()]);

        $this->setCurrentPanel();

        Livewire::actingAs($manager)
            ->test(ListUser::class)
            ->filterTable('role', RoleEnum::VISITOR->value)
            ->assertCanSeeTableRecords([$userWithRole])
            ->assertCanNotSeeTableRecords([$userWithoutRole]);

        Livewire::actingAs($manager)
            ->test(ListUser::class)
            ->filterTable('no_role')
            ->assertCanSeeTableRecords([$userWithoutRole])
            ->assertCanNotSeeTableRecords([$userWithRole, $manager]);
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

    public function test_suspend_action_asks_for_the_password_and_sets_suspended_at(): void
    {
        $manager = $this->createManagerUser();
        $target = User::factory()->create(['suspended_at' => null]);

        $this->setCurrentPanel();

        Livewire::actingAs($manager)
            ->test(ListUser::class)
            ->callTableAction('suspend', $target, data: ['confirm_current_password' => 'wrong'])
            ->assertHasTableActionErrors(['confirm_current_password']);

        $this->assertNull($target->fresh()->suspended_at);

        Livewire::actingAs($manager)
            ->test(ListUser::class)
            ->callTableAction('suspend', $target, data: self::CONFIRM)
            ->assertHasNoTableActionErrors();

        $this->assertNotNull($target->fresh()->suspended_at);
    }

    public function test_reactivate_action_clears_suspended_at(): void
    {
        $manager = $this->createManagerUser();
        $target = User::factory()->create(['suspended_at' => now()]);

        $this->setCurrentPanel();

        Livewire::actingAs($manager)
            ->test(ListUser::class)
            ->callTableAction('reactivate', $target, data: self::CONFIRM)
            ->assertHasNoTableActionErrors();

        $this->assertNull($target->fresh()->suspended_at);
    }

    public function test_change_role_action_replaces_the_one_role(): void
    {
        $manager = $this->createManagerUser();
        $target = User::factory()->create(['email_verified_at' => now()]);
        $target->assignRole(RoleEnum::VISITOR->value);

        $this->setCurrentPanel();

        Livewire::actingAs($manager)
            ->test(ListUser::class)
            ->callTableAction('assignRole', $target, data: ['role' => RoleEnum::DATA_MANAGER->value, ...self::CONFIRM])
            ->assertHasNoTableActionErrors();

        $roles = $target->fresh()?->roles->pluck('name')->all();
        $this->assertSame([RoleEnum::DATA_MANAGER->value], $roles);
    }

    public function test_change_role_action_can_take_the_role_away(): void
    {
        $manager = $this->createManagerUser();
        $target = User::factory()->create(['email_verified_at' => now()]);
        $target->assignRole(RoleEnum::VISITOR->value);

        $this->setCurrentPanel();

        Livewire::actingAs($manager)
            ->test(ListUser::class)
            ->callTableAction('assignRole', $target, data: ['role' => null, ...self::CONFIRM])
            ->assertHasNoTableActionErrors();

        $this->assertNull($target->fresh()?->currentRole());
    }

    public function test_the_edit_form_changes_the_role(): void
    {
        $manager = $this->createManagerUser();
        $target = User::factory()->create(['email_verified_at' => now()]);

        $this->setCurrentPanel();

        Livewire::actingAs($manager)
            ->test(EditUser::class, ['record' => $target->getRouteKey()])
            ->fillForm(['role' => RoleEnum::VISITOR->value, ...self::CONFIRM])
            ->call('save')
            ->assertHasNoFormErrors();

        $this->assertSame(RoleEnum::VISITOR, $target->fresh()?->currentRole());
    }

    public function test_the_edit_form_requires_the_password(): void
    {
        $manager = $this->createManagerUser();
        $target = User::factory()->create(['name' => 'Old Name']);

        $this->setCurrentPanel();

        Livewire::actingAs($manager)
            ->test(EditUser::class, ['record' => $target->getRouteKey()])
            ->fillForm(['name' => 'New Name', 'confirm_current_password' => ''])
            ->call('save')
            ->assertHasFormErrors(['confirm_current_password' => 'required']);

        $this->assertSame('Old Name', $target->fresh()?->name);
    }

    public function test_a_user_manager_is_not_offered_the_user_manager_or_superadmin_role(): void
    {
        $manager = $this->createManagerUser();
        $target = User::factory()->create(['email_verified_at' => now()]);

        $this->setCurrentPanel();
        $this->actingAs($manager);

        $this->assertSame(
            [RoleEnum::VISITOR->value => RoleEnum::VISITOR->value, RoleEnum::DATA_MANAGER->value => RoleEnum::DATA_MANAGER->value],
            UserResource::roleOptions($target),
        );

        $this->assertFalse($manager->can('assignRole', [$target, RoleEnum::USER_MANAGER]));
    }

    public function test_the_superadmin_may_appoint_a_user_manager_but_not_another_superadmin(): void
    {
        $superadmin = $this->createSuperadmin();
        $target = User::factory()->create(['email_verified_at' => now()]);

        $this->setCurrentPanel();
        $this->actingAs($superadmin);

        $this->assertArrayHasKey(RoleEnum::USER_MANAGER->value, UserResource::roleOptions($target));
        $this->assertArrayNotHasKey(RoleEnum::SUPERADMIN->value, UserResource::roleOptions($target));

        Livewire::actingAs($superadmin)
            ->test(ListUser::class)
            ->callTableAction('assignRole', $target, data: ['role' => RoleEnum::USER_MANAGER->value, ...self::CONFIRM])
            ->assertHasNoTableActionErrors();

        $this->assertSame(RoleEnum::USER_MANAGER, $target->fresh()?->currentRole());
    }

    public function test_the_superadmin_row_offers_no_action_that_changes_it(): void
    {
        $manager = $this->createManagerUser();
        $superadmin = $this->createSuperadmin();

        $this->setCurrentPanel();

        Livewire::actingAs($manager)
            ->test(ListUser::class)
            ->assertTableActionHidden('edit', $superadmin)
            ->assertTableActionHidden('delete', $superadmin)
            ->assertTableActionHidden('suspend', $superadmin)
            ->assertTableActionHidden('assignRole', $superadmin);
    }

    public function test_a_user_manager_cannot_change_their_own_role(): void
    {
        $manager = $this->createManagerUser();

        $this->setCurrentPanel();

        Livewire::actingAs($manager)
            ->test(ListUser::class)
            ->assertTableActionHidden('assignRole', $manager)
            ->assertTableActionHidden('suspend', $manager);
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

    public function test_bulk_suspend_skips_accounts_the_actor_may_not_change(): void
    {
        $manager = $this->createManagerUser();
        $users = User::factory()->count(2)->create(['suspended_at' => null]);
        $superadmin = $this->createSuperadmin();

        $this->setCurrentPanel();

        Livewire::actingAs($manager)
            ->test(ListUser::class)
            ->callTableBulkAction('suspend', $users->push($superadmin)->push($manager), data: self::CONFIRM)
            ->assertHasNoTableActionErrors();

        foreach ($users as $user) {
            if ($user->is($superadmin) || $user->is($manager)) {
                $this->assertNull($user->fresh()->suspended_at);
            } else {
                $this->assertNotNull($user->fresh()->suspended_at);
            }
        }
    }

    public function test_bulk_change_role_gives_each_selected_user_the_one_role(): void
    {
        $manager = $this->createManagerUser();
        $users = User::factory()->count(2)->create(['email_verified_at' => now()]);

        $this->setCurrentPanel();

        Livewire::actingAs($manager)
            ->test(ListUser::class)
            ->callTableBulkAction('assignRole', $users, data: ['role' => RoleEnum::VISITOR->value, ...self::CONFIRM])
            ->assertHasNoTableActionErrors();

        foreach ($users as $user) {
            $this->assertSame(RoleEnum::VISITOR, $user->fresh()?->currentRole());
        }
    }

    public function test_data_users_see_no_user_actions(): void
    {
        $dataUser = User::factory()->create(['email_verified_at' => now()]);
        $dataUser->assignRole(RoleEnum::DATA_MANAGER->value);

        $this->actingAs($dataUser)->get('/admin/users')->assertForbidden();
    }
}
