<?php

namespace Tests\Filament\RelationManagers;

use App\Filament\Resources\CollectionResource\Pages\ViewCollection;
use App\Filament\Resources\CollectionResource\RelationManagers\ChildCollectionsRelationManager;
use App\Models\Collection;
use Filament\Actions\MountableAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Features\SupportTesting\Testable;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * M7 story A1.1 (epic #1872): the has-many convention on
 * ChildCollectionsRelationManager. Mounted on ViewCollection — that's where
 * users land on a Collection and where every action here must work per
 * AuthorizesRelationMutations (A0.1), which also makes the manager editable
 * on the resource's View page.
 */
class ChildCollectionsRelationManagerTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    // ── Header: Create ──────────────────────────────────────────────────────

    public function test_create_action_url_carries_the_parent_id(): void
    {
        $user = $this->createCrudUser();
        $collection = Collection::factory()->create(['internal_name' => 'Parent collection']);

        $this->setCurrentPanel();

        $component = Livewire::actingAs($user)->test(ChildCollectionsRelationManager::class, [
            'ownerRecord' => $collection,
            'pageClass' => ViewCollection::class,
        ]);

        $create = $this->headerAction($component, 'create');

        $this->assertStringContainsString('/admin/collections/create', (string) $create->getUrl());
        $this->assertStringContainsString("parent_id={$collection->id}", (string) $create->getUrl());
    }

    // ── Header: Attach existing (cycle guard) ───────────────────────────────

    public function test_associate_excludes_the_owner_and_its_ancestors_but_offers_unrelated_collections(): void
    {
        $user = $this->createCrudUser();

        // 3-level chain: grandparent -> parent -> collection (the owner whose
        // children are being managed). Both grandparent and parent are
        // ancestors of $collection and must never be offered as a child.
        $grandparent = Collection::factory()->create(['internal_name' => 'grandparent-collection']);
        $parent = Collection::factory()->create(['internal_name' => 'parent-collection', 'parent_id' => $grandparent->id]);
        $collection = Collection::factory()->create(['internal_name' => 'the-collection', 'parent_id' => $parent->id]);
        $unrelated = Collection::factory()->create(['internal_name' => 'unrelated-collection']);

        $this->setCurrentPanel();

        $component = Livewire::actingAs($user)->test(ChildCollectionsRelationManager::class, [
            'ownerRecord' => $collection,
            'pageClass' => ViewCollection::class,
        ]);

        $component->mountTableAction('associate');

        $form = $component->instance()->getMountedTableActionForm();
        $this->assertNotNull($form);
        $select = $form->getFlatFields()['recordId'];

        $this->assertArrayNotHasKey($grandparent->id, $select->getSearchResults('grandparent-collection'));
        $this->assertArrayNotHasKey($parent->id, $select->getSearchResults('parent-collection'));
        $this->assertArrayHasKey($unrelated->id, $select->getSearchResults('unrelated-collection'));

        $component->call('unmountTableAction', false, false);
    }

    public function test_associate_action_sets_parent_id_on_the_attached_collection(): void
    {
        $user = $this->createCrudUser();
        $collection = Collection::factory()->create(['internal_name' => 'the-collection']);
        $target = Collection::factory()->create(['internal_name' => 'soon-to-be-child']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ChildCollectionsRelationManager::class, [
                'ownerRecord' => $collection,
                'pageClass' => ViewCollection::class,
            ])
            ->callTableAction('associate', data: ['recordId' => $target->id])
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('collections', [
            'id' => $target->id,
            'parent_id' => $collection->id,
        ]);
    }

    // ── Row: Detach / Delete ─────────────────────────────────────────────────

    public function test_dissociate_clears_parent_id_without_deleting_the_record(): void
    {
        $user = $this->createCrudUser();
        $collection = Collection::factory()->create(['internal_name' => 'the-collection']);
        $child = Collection::factory()->create(['internal_name' => 'child-collection', 'parent_id' => $collection->id]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ChildCollectionsRelationManager::class, [
                'ownerRecord' => $collection,
                'pageClass' => ViewCollection::class,
            ])
            ->callTableAction('dissociate', $child)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('collections', [
            'id' => $child->id,
            'parent_id' => null,
        ]);
    }

    public function test_delete_action_removes_the_child_collection(): void
    {
        $user = $this->createCrudUser();
        $collection = Collection::factory()->create(['internal_name' => 'the-collection']);
        $child = Collection::factory()->create(['internal_name' => 'child-collection', 'parent_id' => $collection->id]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ChildCollectionsRelationManager::class, [
                'ownerRecord' => $collection,
                'pageClass' => ViewCollection::class,
            ])
            ->callTableAction('delete', $child)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('collections', ['id' => $child->id]);
    }

    // ── Authorization: view-only user sees no mutating action ──────────────

    public function test_view_only_user_sees_no_mutating_action(): void
    {
        $viewer = $this->createViewOnlyUser();
        $collection = Collection::factory()->create(['internal_name' => 'the-collection']);
        $child = Collection::factory()->create(['internal_name' => 'child-collection', 'parent_id' => $collection->id]);

        $this->setCurrentPanel();

        Livewire::actingAs($viewer)
            ->test(ChildCollectionsRelationManager::class, [
                'ownerRecord' => $collection,
                'pageClass' => ViewCollection::class,
            ])
            ->assertTableActionHidden('create')
            ->assertTableActionHidden('associate')
            ->assertTableActionHidden('edit', $child)
            ->assertTableActionHidden('dissociate', $child)
            ->assertTableActionHidden('delete', $child)
            ->assertTableBulkActionHidden('dissociate');
    }

    public function test_crud_user_keeps_every_mutating_action(): void
    {
        $user = $this->createCrudUser();
        $collection = Collection::factory()->create(['internal_name' => 'the-collection']);
        $child = Collection::factory()->create(['internal_name' => 'child-collection', 'parent_id' => $collection->id]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ChildCollectionsRelationManager::class, [
                'ownerRecord' => $collection,
                'pageClass' => ViewCollection::class,
            ])
            ->assertTableActionVisible('create')
            ->assertTableActionVisible('associate')
            ->assertTableActionVisible('edit', $child)
            ->assertTableActionVisible('dissociate', $child)
            ->assertTableActionVisible('delete', $child)
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
