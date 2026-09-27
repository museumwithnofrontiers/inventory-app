<?php

namespace Tests\Filament\RelationManagers;

use App\Filament\Resources\ItemResource\Pages\CreateItem;
use App\Filament\Resources\ProjectResource\Pages\ViewProject;
use App\Filament\Resources\ProjectResource\RelationManagers\ItemsRelationManager;
use App\Models\Item;
use App\Models\Project;
use Filament\Actions\MountableAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Features\SupportTesting\Testable;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * M7 story A5.3 (epic #1876): the has-many convention on a project's items
 * (App\Filament\Resources\ProjectResource\RelationManagers\ItemsRelationManager).
 * Mounted on ViewProject — that's where users land on a Project and where
 * every action here must work per AuthorizesRelationMutations (A0.1), which
 * also makes the manager editable on the resource's View page.
 */
class ProjectItemsRelationManagerTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    // ── Header: Create ──────────────────────────────────────────────────────

    public function test_create_action_url_carries_the_project_id(): void
    {
        $user = $this->createCrudUser();
        $project = Project::factory()->create(['internal_name' => 'The project']);

        $this->setCurrentPanel();

        $component = Livewire::actingAs($user)->test(ItemsRelationManager::class, [
            'ownerRecord' => $project,
            'pageClass' => ViewProject::class,
        ]);

        $create = $this->headerAction($component, 'create');

        $this->assertStringContainsString('/admin/items/create', (string) $create->getUrl());
        $this->assertStringContainsString("project_id={$project->id}", (string) $create->getUrl());
    }

    /**
     * The Create page the header action navigates to actually shows the
     * project once landed on, via CreateItem's own PrefillsCreateFormFromQuery
     * wiring (App\Filament\Resources\ItemResource\Pages\CreateItem).
     */
    public function test_prefilled_create_page_shows_the_project(): void
    {
        $user = $this->createCrudUser();
        $project = Project::factory()->create(['internal_name' => 'The project']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->withQueryParams(['project_id' => $project->id])
            ->test(CreateItem::class)
            ->assertFormSet(['project_id' => $project->id]);
    }

    // ── Header: Attach existing ──────────────────────────────────────────────

    public function test_associate_action_sets_project_id_on_the_attached_item(): void
    {
        $user = $this->createCrudUser();
        $project = Project::factory()->create();
        $target = Item::factory()->Object()->create(['internal_name' => 'soon-to-be-project-item']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ItemsRelationManager::class, [
                'ownerRecord' => $project,
                'pageClass' => ViewProject::class,
            ])
            ->callTableAction('associate', data: ['recordId' => $target->id])
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('items', [
            'id' => $target->id,
            'project_id' => $project->id,
        ]);
    }

    // ── Row: Detach / Delete ─────────────────────────────────────────────────

    public function test_dissociate_clears_project_id_without_deleting_the_record(): void
    {
        $user = $this->createCrudUser();
        $project = Project::factory()->create();
        $item = Item::factory()->Object()->create(['internal_name' => 'project-item', 'project_id' => $project->id]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ItemsRelationManager::class, [
                'ownerRecord' => $project,
                'pageClass' => ViewProject::class,
            ])
            ->callTableAction('dissociate', $item)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('items', [
            'id' => $item->id,
            'project_id' => null,
        ]);
    }

    public function test_delete_action_removes_the_item(): void
    {
        $user = $this->createCrudUser();
        $project = Project::factory()->create();
        $item = Item::factory()->Object()->create(['internal_name' => 'project-item', 'project_id' => $project->id]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ItemsRelationManager::class, [
                'ownerRecord' => $project,
                'pageClass' => ViewProject::class,
            ])
            ->callTableAction('delete', $item)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('items', ['id' => $item->id]);
    }

    // ── Authorization: view-only user sees no mutating action ──────────────

    public function test_view_only_user_sees_no_mutating_action(): void
    {
        $viewer = $this->createViewOnlyUser();
        $project = Project::factory()->create();
        $item = Item::factory()->Object()->create(['internal_name' => 'project-item', 'project_id' => $project->id]);

        $this->setCurrentPanel();

        Livewire::actingAs($viewer)
            ->test(ItemsRelationManager::class, [
                'ownerRecord' => $project,
                'pageClass' => ViewProject::class,
            ])
            ->assertTableActionHidden('create')
            ->assertTableActionHidden('associate')
            ->assertTableActionHidden('edit', $item)
            ->assertTableActionHidden('dissociate', $item)
            ->assertTableActionHidden('delete', $item)
            ->assertTableBulkActionHidden('dissociate');
    }

    public function test_crud_user_keeps_every_mutating_action(): void
    {
        $user = $this->createCrudUser();
        $project = Project::factory()->create();
        $item = Item::factory()->Object()->create(['internal_name' => 'project-item', 'project_id' => $project->id]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ItemsRelationManager::class, [
                'ownerRecord' => $project,
                'pageClass' => ViewProject::class,
            ])
            ->assertTableActionVisible('create')
            ->assertTableActionVisible('associate')
            ->assertTableActionVisible('edit', $item)
            ->assertTableActionVisible('dissociate', $item)
            ->assertTableActionVisible('delete', $item)
            ->assertTableBulkActionVisible('dissociate');
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function headerAction(Testable $component, string $name): MountableAction
    {
        $table = $component->instance()->getTable();

        foreach ($table->getHeaderActions() as $action) {
            if ($action instanceof MountableAction && $action->getName() === $name) {
                return $action;
            }
        }

        $this->fail("Header action [{$name}] not found.");
    }
}
