<?php

namespace Tests\Filament\Resources;

use App\Enums\Permission;
use App\Filament\Resources\RoleResource\Pages\CreateRole;
use App\Filament\Resources\RoleResource\Pages\EditRole;
use App\Filament\Resources\RoleResource\Pages\ListRole;
use App\Filament\Resources\RoleResource\RelationManagers\PermissionsRelationManager;
use App\Models\User;
use Filament\Tables\Actions\DeleteAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Spatie\Permission\Models\Permission as SpatiePermission;
use Spatie\Permission\Models\Role;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

class RoleResourceTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    // ── Helpers ───────────────────────────────────────────────────────────────

    protected function createManagerUser(): User
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo([
            Permission::ACCESS_ADMIN_PANEL->value,
            Permission::MANAGE_ROLES->value,
        ]);

        return $user;
    }

    // ── Page rendering ────────────────────────────────────────────────────────

    public function test_authorized_users_can_render_all_role_resource_pages(): void
    {
        $manager = $this->createManagerUser();
        $role = Role::firstOrCreate(['name' => 'Editor', 'guard_name' => 'web']);

        $this->actingAs($manager)->get('/admin/roles')
            ->assertOk()
            ->assertSee('Roles');

        $this->actingAs($manager)->get('/admin/roles/create')
            ->assertOk();

        $this->actingAs($manager)->get("/admin/roles/{$role->getKey()}/edit")
            ->assertOk()
            ->assertSee('Editor');

        $this->actingAs($manager)->get("/admin/roles/{$role->getKey()}")
            ->assertOk()
            ->assertSee('Editor');
    }

    // ── CRUD ──────────────────────────────────────────────────────────────────

    public function test_authorized_users_can_create_a_role(): void
    {
        $manager = $this->createManagerUser();

        $this->setCurrentPanel();

        Livewire::actingAs($manager)
            ->test(CreateRole::class)
            ->fillForm([
                'name' => 'Custom Role',
                'guard_name' => 'web',
            ])
            ->call('create')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('roles', ['name' => 'Custom Role']);
    }

    public function test_authorized_users_can_edit_a_role(): void
    {
        $manager = $this->createManagerUser();
        $role = Role::firstOrCreate(['name' => 'Old Name', 'guard_name' => 'web']);

        $this->setCurrentPanel();

        Livewire::actingAs($manager)
            ->test(EditRole::class, ['record' => $role->getRouteKey()])
            ->fillForm([
                'name' => 'New Name',
                'guard_name' => 'web',
            ])
            ->call('save')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('roles', [
            'id' => $role->id,
            'name' => 'New Name',
        ]);
    }

    public function test_authorized_users_can_delete_a_role(): void
    {
        $manager = $this->createManagerUser();
        $role = Role::firstOrCreate(['name' => 'Deletable Role', 'guard_name' => 'web']);

        $this->setCurrentPanel();

        Livewire::actingAs($manager)
            ->test(ListRole::class)
            ->callTableAction(DeleteAction::class, $role)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('roles', ['id' => $role->id]);
    }

    // ── PermissionsRelationManager ────────────────────────────────────────────

    public function test_permissions_relation_manager_can_attach_and_detach_permissions(): void
    {
        $manager = $this->createManagerUser();
        $role = Role::firstOrCreate(['name' => 'Reviewer', 'guard_name' => 'web']);
        $permission = SpatiePermission::firstOrCreate(['name' => 'custom-permission', 'guard_name' => 'web']);

        $this->setCurrentPanel();

        Livewire::actingAs($manager)
            ->test(PermissionsRelationManager::class, ['ownerRecord' => $role, 'pageClass' => EditRole::class])
            ->callTableAction('attach', data: ['recordId' => $permission->id, 'record' => $permission->id])
            ->assertHasNoTableActionErrors();

        $this->assertTrue($role->fresh()->hasPermissionTo('custom-permission'));
    }

    public function test_permissions_relation_manager_can_create_a_new_permission(): void
    {
        $manager = $this->createManagerUser();
        $role = Role::firstOrCreate(['name' => 'Reviewer', 'guard_name' => 'web']);

        $this->setCurrentPanel();

        Livewire::actingAs($manager)
            ->test(PermissionsRelationManager::class, ['ownerRecord' => $role, 'pageClass' => EditRole::class])
            ->callTableAction('createPermission', data: ['name' => 'brand-new-permission'])
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('permissions', ['name' => 'brand-new-permission']);
        $this->assertTrue($role->fresh()->hasPermissionTo('brand-new-permission'));
    }

    public function test_permissions_relation_manager_can_rename_a_permission(): void
    {
        $manager = $this->createManagerUser();
        $role = Role::firstOrCreate(['name' => 'Reviewer', 'guard_name' => 'web']);
        $permission = SpatiePermission::firstOrCreate(['name' => 'renameable-permission', 'guard_name' => 'web']);
        $role->givePermissionTo($permission);

        $this->setCurrentPanel();

        Livewire::actingAs($manager)
            ->test(PermissionsRelationManager::class, ['ownerRecord' => $role, 'pageClass' => EditRole::class])
            ->callTableAction('edit', $permission, data: ['name' => 'renamed-permission'])
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('permissions', ['id' => $permission->id, 'name' => 'renamed-permission']);
    }

    public function test_permissions_relation_manager_can_delete_non_critical_permission(): void
    {
        $manager = $this->createManagerUser();
        $role = Role::firstOrCreate(['name' => 'Reviewer', 'guard_name' => 'web']);
        $permission = SpatiePermission::firstOrCreate(['name' => 'deletable-permission', 'guard_name' => 'web']);
        $role->givePermissionTo($permission);

        $this->setCurrentPanel();

        Livewire::actingAs($manager)
            ->test(PermissionsRelationManager::class, ['ownerRecord' => $role, 'pageClass' => EditRole::class])
            ->callTableAction('deletePermission', $permission)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('permissions', ['id' => $permission->id]);
    }

    public function test_permissions_relation_manager_cannot_delete_critical_permissions(): void
    {
        $manager = $this->createManagerUser();
        $role = Role::firstOrCreate(['name' => 'Reviewer', 'guard_name' => 'web']);
        $criticalName = 'access-admin-panel';
        $permission = SpatiePermission::firstOrCreate(['name' => $criticalName, 'guard_name' => 'web']);
        $role->givePermissionTo($permission);

        $this->setCurrentPanel();

        Livewire::actingAs($manager)
            ->test(PermissionsRelationManager::class, ['ownerRecord' => $role, 'pageClass' => EditRole::class])
            ->assertTableActionDisabled('deletePermission', $permission);

        $this->assertDatabaseHas('permissions', ['id' => $permission->id, 'name' => $criticalName]);
    }
}
