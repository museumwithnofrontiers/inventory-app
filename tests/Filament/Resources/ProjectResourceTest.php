<?php

namespace Tests\Filament\Resources;

use App\Enums\Permission;
use App\Filament\Resources\CollectionResource;
use App\Filament\Resources\ContextResource;
use App\Filament\Resources\ItemResource;
use App\Filament\Resources\ProjectResource\Pages\ViewProject;
use App\Filament\Resources\ProjectResource\RelationManagers\CollectionsRelationManager;
use App\Filament\Resources\ProjectResource\RelationManagers\ItemsRelationManager;
use App\Models\Collection;
use App\Models\Context;
use App\Models\Item;
use App\Models\Language;
use App\Models\Project;
use App\Models\User;
use Filament\Tables\Columns\TextColumn;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

class ProjectResourceTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_authorized_users_can_render_all_project_resource_pages(): void
    {
        $user = $this->createCrudUser();
        $context = Context::factory()->create(['internal_name' => 'Catalogue']);
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);
        $project = Project::factory()->create([
            'internal_name' => 'Temple catalogue',
            'context_id' => $context->id,
            'language_id' => $language->id,
        ]);

        $this->actingAs($user)->get('/admin/projects')
            ->assertOk()
            ->assertSee('Projects');

        $this->actingAs($user)->get('/admin/projects/create')
            ->assertOk()
            ->assertSee('Create');

        $this->actingAs($user)->get("/admin/projects/{$project->getKey()}/edit")
            ->assertOk()
            ->assertSee('Temple catalogue');

        $this->actingAs($user)->get("/admin/projects/{$project->getKey()}")
            ->assertOk()
            ->assertSee('Temple catalogue');
    }

    public function test_project_view_page_shows_url_fields(): void
    {
        $user = $this->createCrudUser();
        $project = Project::factory()->withUrls()->create([
            'internal_name' => 'Temple catalogue',
        ]);

        $this->actingAs($user)
            ->get("/admin/projects/{$project->getKey()}")
            ->assertOk()
            ->assertSee($project->site_url)
            ->assertSee($project->related_database_url)
            ->assertSee($project->artistic_introduction_url);
    }

    public function test_project_infolist_context_links_to_context_resource_with_manage_reference_data(): void
    {
        $user = $this->createViewAndReferenceDataUser();

        $context = Context::factory()->create(['internal_name' => 'Catalogue']);
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);
        $project = Project::factory()->create([
            'context_id' => $context->id,
            'language_id' => $language->id,
        ]);

        $this->setCurrentPanel();

        $this->actingAs($user)
            ->get("/admin/projects/{$project->getKey()}")
            ->assertOk()
            ->assertSee(ContextResource::getUrl('view', ['record' => $context]));
    }

    public function test_project_infolist_context_is_plain_text_without_manage_reference_data(): void
    {
        $user = $this->createCrudUser();

        $context = Context::factory()->create(['internal_name' => 'Catalogue']);
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);
        $project = Project::factory()->create([
            'context_id' => $context->id,
            'language_id' => $language->id,
        ]);

        $this->actingAs($user)
            ->get("/admin/projects/{$project->getKey()}")
            ->assertOk()
            ->assertDontSee(ContextResource::getUrl('view', ['record' => $context]));
    }

    public function test_project_items_relation_manager_display_label_links_to_item_resource(): void
    {
        $user = $this->createCrudUser();
        $project = Project::factory()->create(['internal_name' => 'Temple catalogue']);
        $item = Item::factory()->Object()->create([
            'project_id' => $project->id,
            'internal_name' => 'Temple relief',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ItemsRelationManager::class, [
                'ownerRecord' => $project,
                'pageClass' => ViewProject::class,
            ])
            ->assertTableColumnExists(
                'display_label',
                fn (TextColumn $column): bool => $column->getUrl() === ItemResource::getUrl('view', ['record' => $item]),
                $item
            );
    }

    public function test_project_collections_relation_manager_internal_name_links_to_collection_resource(): void
    {
        $user = $this->createCrudUser();
        $context = Context::factory()->create(['internal_name' => 'Catalogue']);
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);
        $project = Project::factory()->create(['internal_name' => 'Temple catalogue']);
        $collection = Collection::factory()->create([
            'internal_name' => 'Temple collection',
            'context_id' => $context->id,
            'language_id' => $language->id,
        ]);
        // Link collection to project via an item (the BelongsToMany uses items as the pivot table)
        Item::factory()->Object()->create([
            'project_id' => $project->id,
            'collection_id' => $collection->id,
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CollectionsRelationManager::class, [
                'ownerRecord' => $project,
                'pageClass' => ViewProject::class,
            ])
            ->assertTableColumnExists(
                'display_label',
                fn (TextColumn $column): bool => $column->getUrl() === CollectionResource::getUrl('view', ['record' => $collection]),
                $collection
            );
    }

    protected function createViewAndReferenceDataUser(): User
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo([
            Permission::ACCESS_ADMIN_PANEL->value,
            Permission::VIEW_DATA->value,
            Permission::MANAGE_REFERENCE_DATA->value,
        ]);

        return $user;
    }
}
