<?php

namespace Tests\Filament;

use App\Enums\Permission;
use App\Filament\Resources\ProjectResource\Pages\CreateProject;
use App\Filament\Resources\ProjectResource\Pages\EditProject;
use App\Filament\Resources\ProjectResource\Pages\ListProject;
use App\Filament\Resources\ProjectResource\RelationManagers\CollectionsRelationManager;
use App\Filament\Resources\ProjectResource\RelationManagers\ItemsRelationManager;
use App\Models\Collection;
use App\Models\Context;
use App\Models\Item;
use App\Models\Language;
use App\Models\Project;
use App\Models\User;
use Filament\Facades\Filament;
use Filament\Tables\Actions\DeleteAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

class ProjectResourceTest extends TestCase
{
    use RefreshDatabase;

    public function test_authorized_users_can_render_all_project_resource_pages_and_relations(): void
    {
        $user = $this->createCrudUser();
        $context = Context::factory()->create(['internal_name' => 'Catalogue']);
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);
        $project = Project::factory()->create([
            'internal_name' => 'Temple catalogue',
            'backward_compatibility' => 'prj-01',
            'context_id' => $context->id,
            'language_id' => $language->id,
        ]);
        $collection = Collection::factory()->create([
            'internal_name' => 'Temple collection',
            'context_id' => $context->id,
            'language_id' => $language->id,
        ]);
        $item = Item::factory()->Object()->create([
            'internal_name' => 'Temple relief',
            'project_id' => $project->id,
            'collection_id' => $collection->id,
        ]);

        $this->actingAs($user)->get('/admin/projects')
            ->assertOk()
            ->assertSee('Projects');

        $this->actingAs($user)->get('/admin/projects/create')
            ->assertOk()
            ->assertSee('Create');

        $this->actingAs($user)->get("/admin/projects/{$project->getKey()}/edit")
            ->assertOk()
            ->assertSee('Temple catalogue')
            ->assertSee('Items')
            ->assertSee('Collections');

        $this->actingAs($user)->get("/admin/projects/{$project->getKey()}")
            ->assertOk()
            ->assertSee('Temple catalogue')
            ->assertSee('prj-01');

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ItemsRelationManager::class, [
                'ownerRecord' => $project,
                'pageClass' => EditProject::class,
            ])
            ->assertCanSeeTableRecords([$item]);

        Livewire::actingAs($user)
            ->test(CollectionsRelationManager::class, [
                'ownerRecord' => $project,
                'pageClass' => EditProject::class,
            ])
            ->assertCanSeeTableRecords([$collection]);
    }

    public function test_authorized_users_can_create_edit_and_delete_projects(): void
    {
        $user = $this->createCrudUser();
        $context = Context::factory()->create(['internal_name' => 'Catalogue']);
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);
        $project = Project::factory()->create([
            'internal_name' => 'Temple catalogue',
            'backward_compatibility' => 'prj-01',
            'launch_date' => '2025-01-01',
            'is_launched' => false,
            'is_enabled' => false,
            'copyright' => '© Temple catalogue',
            'context_id' => $context->id,
            'language_id' => $language->id,
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CreateProject::class)
            ->fillForm([
                'internal_name' => 'Archive rollout',
                'backward_compatibility' => 'prj-02',
                'launch_date' => '2025-05-01',
                'is_launched' => true,
                'is_enabled' => true,
                'site_url' => 'https://example.org/archive',
                'related_database_url' => 'https://example.org/archive-db',
                'artistic_introduction_url' => 'https://example.org/archive-intro',
                'copyright' => '© Archive rollout',
                'context_id' => $context->id,
                'language_id' => $language->id,
            ])
            ->call('create')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('projects', [
            'internal_name' => 'Archive rollout',
            'backward_compatibility' => 'prj-02',
            'launch_date' => '2025-05-01',
            'is_launched' => true,
            'is_enabled' => true,
            'site_url' => 'https://example.org/archive',
            'related_database_url' => 'https://example.org/archive-db',
            'artistic_introduction_url' => 'https://example.org/archive-intro',
            'copyright' => '© Archive rollout',
            'context_id' => $context->id,
            'language_id' => $language->id,
        ]);

        Livewire::actingAs($user)
            ->test(EditProject::class, [
                'record' => $project->getRouteKey(),
            ])
            ->assertFormSet([
                'internal_name' => 'Temple catalogue',
                'backward_compatibility' => 'prj-01',
                'launch_date' => '2025-01-01',
                'is_launched' => false,
                'is_enabled' => false,
                'copyright' => '© Temple catalogue',
                'context_id' => $context->id,
                'language_id' => $language->id,
            ])
            ->fillForm([
                'internal_name' => 'Temple migration',
                'backward_compatibility' => 'prj-11',
                'launch_date' => '2025-06-01',
                'is_launched' => true,
                'is_enabled' => true,
                'site_url' => 'https://example.org/temple',
                'related_database_url' => 'https://example.org/temple-db',
                'artistic_introduction_url' => 'https://example.org/temple-intro',
                'copyright' => '© Temple migration',
                'context_id' => $context->id,
                'language_id' => $language->id,
            ])
            ->call('save')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('projects', [
            'id' => $project->id,
            'internal_name' => 'Temple migration',
            'backward_compatibility' => 'prj-11',
            'launch_date' => '2025-06-01',
            'is_launched' => true,
            'is_enabled' => true,
            'site_url' => 'https://example.org/temple',
            'related_database_url' => 'https://example.org/temple-db',
            'artistic_introduction_url' => 'https://example.org/temple-intro',
            'copyright' => '© Temple migration',
        ]);

        Livewire::actingAs($user)
            ->test(ListProject::class)
            ->callTableAction(DeleteAction::class, $project)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('projects', [
            'id' => $project->id,
        ]);
    }

    public function test_project_copyright_stores_null_for_blank(): void
    {
        $user = $this->createCrudUser();
        $project = Project::factory()->create(['copyright' => 'Original copyright']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(EditProject::class, [
                'record' => $project->getRouteKey(),
            ])
            ->fillForm([
                'copyright' => '',
            ])
            ->call('save')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('projects', [
            'id' => $project->id,
            'copyright' => null,
        ]);
    }

    public function test_users_without_admin_panel_permission_receive_forbidden_on_the_filament_project_resource(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo([
            Permission::VIEW_DATA->value,
            Permission::CREATE_DATA->value,
            Permission::UPDATE_DATA->value,
            Permission::DELETE_DATA->value,
        ]);

        $response = $this->actingAs($user)->get('/admin/projects');

        $response->assertForbidden();
    }

    protected function createCrudUser(): User
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo([
            Permission::ACCESS_ADMIN_PANEL->value,
            Permission::VIEW_DATA->value,
            Permission::CREATE_DATA->value,
            Permission::UPDATE_DATA->value,
            Permission::DELETE_DATA->value,
        ]);

        return $user;
    }

    protected function setCurrentPanel(): void
    {
        Filament::setCurrentPanel(Filament::getPanel('admin'));
    }
}
