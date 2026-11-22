<?php

namespace Tests\Unit\Policies;

use App\Enums\Role;
use App\Models\User;
use App\Policies\UserPolicy;
use App\Support\Authorization\UserRoles;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The account rules: user managers manage accounts; only the superadmin
 * changes another user manager; nobody changes the superadmin in the panel,
 * or their own role; the superadmin role is never given in the panel.
 */
class UserPolicyTest extends TestCase
{
    use RefreshDatabase;

    private UserPolicy $policy;

    protected function setUp(): void
    {
        parent::setUp();
        $this->policy = new UserPolicy;
    }

    private function withRole(?Role $role): User
    {
        $user = User::factory()->create(['email_verified_at' => now(), 'approved_at' => now()]);

        if ($role !== null) {
            app(UserRoles::class)->assign($user, $role);
        }

        return $user->fresh() ?? $user;
    }

    public function test_only_user_managers_see_accounts(): void
    {
        $this->assertTrue($this->policy->viewAny($this->withRole(Role::USER_MANAGER)));
        $this->assertTrue($this->policy->viewAny($this->withRole(Role::SUPERADMIN)));
        $this->assertFalse($this->policy->viewAny($this->withRole(Role::DATA_MANAGER)));
        $this->assertFalse($this->policy->viewAny($this->withRole(Role::VISITOR)));
        $this->assertFalse($this->policy->viewAny($this->withRole(null)));
    }

    public function test_a_user_manager_manages_ordinary_accounts(): void
    {
        $manager = $this->withRole(Role::USER_MANAGER);
        $target = $this->withRole(Role::DATA_MANAGER);

        $this->assertTrue($this->policy->update($manager, $target));
        $this->assertTrue($this->policy->suspend($manager, $target));
        $this->assertTrue($this->policy->reactivate($manager, $target));
        $this->assertTrue($this->policy->delete($manager, $target));
        $this->assertTrue($this->policy->approve($manager, $target));
        $this->assertTrue($this->policy->resetTwoFactor($manager, $target));
        $this->assertTrue($this->policy->assignRole($manager, $target, Role::VISITOR));
        $this->assertTrue($this->policy->assignRole($manager, $target, null));
    }

    public function test_a_user_manager_cannot_create_or_change_another_user_manager(): void
    {
        $manager = $this->withRole(Role::USER_MANAGER);
        $peer = $this->withRole(Role::USER_MANAGER);
        $target = $this->withRole(Role::DATA_MANAGER);

        $this->assertFalse($this->policy->update($manager, $peer));
        $this->assertFalse($this->policy->suspend($manager, $peer));
        $this->assertFalse($this->policy->delete($manager, $peer));
        $this->assertFalse($this->policy->resetTwoFactor($manager, $peer));
        $this->assertFalse($this->policy->assignRole($manager, $peer, Role::VISITOR));
        $this->assertFalse($this->policy->assignRole($manager, $target, Role::USER_MANAGER));
    }

    public function test_nobody_changes_the_superadmin_in_the_panel(): void
    {
        $superadmin = $this->withRole(Role::SUPERADMIN);
        $manager = $this->withRole(Role::USER_MANAGER);

        foreach ([$manager, $superadmin] as $actor) {
            $this->assertFalse($this->policy->update($actor, $superadmin));
            $this->assertFalse($this->policy->suspend($actor, $superadmin));
            $this->assertFalse($this->policy->delete($actor, $superadmin));
            $this->assertFalse($this->policy->resetTwoFactor($actor, $superadmin));
            $this->assertFalse($this->policy->assignRole($actor, $superadmin, Role::USER_MANAGER));
        }
    }

    public function test_the_superadmin_manages_the_other_user_managers(): void
    {
        $superadmin = $this->withRole(Role::SUPERADMIN);
        $manager = $this->withRole(Role::USER_MANAGER);
        $target = $this->withRole(Role::VISITOR);

        $this->assertTrue($this->policy->update($superadmin, $manager));
        $this->assertTrue($this->policy->suspend($superadmin, $manager));
        $this->assertTrue($this->policy->delete($superadmin, $manager));
        $this->assertTrue($this->policy->assignRole($superadmin, $manager, Role::DATA_MANAGER));
        $this->assertTrue($this->policy->assignRole($superadmin, $target, Role::USER_MANAGER));
    }

    public function test_the_superadmin_role_is_never_given_in_the_panel(): void
    {
        $superadmin = $this->withRole(Role::SUPERADMIN);
        $target = $this->withRole(Role::USER_MANAGER);

        $this->assertFalse($this->policy->assignRole($superadmin, $target, Role::SUPERADMIN));
        $this->assertNotContains(Role::SUPERADMIN, $this->policy->assignableRoles($superadmin, $target));
    }

    public function test_nobody_changes_their_own_role_suspends_or_deletes_themselves(): void
    {
        foreach ([Role::USER_MANAGER, Role::SUPERADMIN] as $role) {
            $actor = $this->withRole($role);

            $this->assertFalse($this->policy->assignRole($actor, $actor, Role::VISITOR));
            $this->assertFalse($this->policy->suspend($actor, $actor));
            $this->assertFalse($this->policy->delete($actor, $actor));
            $this->assertFalse($this->policy->resetTwoFactor($actor, $actor));
            $this->assertSame([], $this->policy->assignableRoles($actor, $actor));
        }
    }

    public function test_a_user_manager_may_edit_their_own_account_but_not_its_role(): void
    {
        $manager = $this->withRole(Role::USER_MANAGER);

        $this->assertTrue($this->policy->update($manager, $manager));
        $this->assertFalse($this->policy->assignRole($manager, $manager, null));
    }

    public function test_assignable_roles_follow_the_actor(): void
    {
        $target = $this->withRole(Role::VISITOR);

        $this->assertSame(
            [Role::VISITOR, Role::DATA_MANAGER],
            $this->policy->assignableRoles($this->withRole(Role::USER_MANAGER), $target),
        );
        $this->assertSame(
            [Role::VISITOR, Role::DATA_MANAGER, Role::USER_MANAGER],
            $this->policy->assignableRoles($this->withRole(Role::SUPERADMIN), $target),
        );
        $this->assertSame([], $this->policy->assignableRoles($this->withRole(Role::DATA_MANAGER), $target));
    }
}
