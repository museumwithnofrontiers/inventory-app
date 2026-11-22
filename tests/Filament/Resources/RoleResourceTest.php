<?php

namespace Tests\Filament\Resources;

use App\Enums\Permission;
use App\Filament\Resources\RoleResource\Pages\ListRole;
use App\Filament\Resources\RoleResource\Pages\ViewRole;
use App\Filament\Resources\RoleResource\RelationManagers\PermissionsRelationManager;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Spatie\Permission\Models\Role;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * The roles screen is read-only: the roles and their permissions are defined
 * in code (App\Enums\Role) and kept in the database by RoleSync.
 */
class RoleResourceTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    protected function createManagerUser(): User
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo([
            Permission::ACCESS_ADMIN_PANEL->value,
            Permission::MANAGE_USERS->value,
        ]);

        return $user;
    }

    public function test_user_managers_can_list_and_view_roles(): void
    {
        $manager = $this->createManagerUser();
        $role = Role::findByName('Manager of Data', 'web');

        $this->actingAs($manager)->get('/admin/roles')
            ->assertOk()
            ->assertSee('Manager of Data');

        $this->actingAs($manager)->get("/admin/roles/{$role->getKey()}")
            ->assertOk()
            ->assertSee('Manager of Data');
    }

    public function test_there_is_no_create_or_edit_page(): void
    {
        $manager = $this->createManagerUser();
        $role = Role::findByName('Visitor', 'web');

        $this->actingAs($manager)->get('/admin/roles/create')->assertNotFound();
        $this->actingAs($manager)->get("/admin/roles/{$role->getKey()}/edit")->assertNotFound();
    }

    public function test_the_list_offers_no_create_edit_or_delete_action(): void
    {
        $this->setCurrentPanel();
        $role = Role::findByName('Visitor', 'web');

        Livewire::actingAs($this->createManagerUser())
            ->test(ListRole::class)
            ->assertActionDoesNotExist('create')
            ->assertTableActionDoesNotExist('edit')
            ->assertTableActionDoesNotExist('delete')
            ->assertCanSeeTableRecords([$role]);
    }

    public function test_the_permissions_of_a_role_are_read_only(): void
    {
        $this->setCurrentPanel();
        $role = Role::findByName('Visitor', 'web');

        Livewire::actingAs($this->createManagerUser())
            ->test(PermissionsRelationManager::class, ['ownerRecord' => $role, 'pageClass' => ViewRole::class])
            ->assertOk()
            ->assertTableActionDoesNotExist('attach')
            ->assertTableActionDoesNotExist('edit')
            ->assertTableActionDoesNotExist('detach')
            ->assertTableActionDoesNotExist('createPermission')
            ->assertTableActionDoesNotExist('deletePermission');
    }
}
