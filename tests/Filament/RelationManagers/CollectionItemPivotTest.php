<?php

namespace Tests\Filament\RelationManagers;

use App\Filament\Resources\CollectionResource\Pages\ViewCollection;
use App\Filament\Resources\CollectionResource\RelationManagers\ItemsRelationManager;
use App\Filament\Resources\ItemResource\Pages\ViewItem;
use App\Filament\Resources\ItemResource\RelationManagers\CollectionAppearancesRelationManager;
use App\Models\Collection;
use App\Models\CollectionItem;
use App\Models\Context;
use App\Models\Item;
use App\Models\Language;
use Filament\Tables\Actions\DetachAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * M7 Story A2.1 (#1900): the collection_item pivot, both sides. Mounted on
 * the View pages (ViewCollection, ViewItem) — where every entry point into a
 * Collection or Item lands (M7 Story A0.6, #1895) — via
 * AuthorizesRelationMutations::isReadOnly(), which both managers now use.
 */
class CollectionItemPivotTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    // ── Collection side: ItemsRelationManager ───────────────────────────────

    public function test_crud_user_attaches_edits_and_detaches_an_item_from_the_collection_view_page(): void
    {
        $collection = $this->makeCollection();
        $item = Item::factory()->Object()->create();
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ItemsRelationManager::class, [
                'ownerRecord' => $collection,
                'pageClass' => ViewCollection::class,
            ])
            ->mountTableAction('attach')
            ->setTableActionData([
                'recordId' => $item->id,
                'display_order' => 3,
                'extra' => json_encode(['note' => 'first']),
            ])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('collection_item', [
            'collection_id' => $collection->id,
            'item_id' => $item->id,
            'display_order' => 3,
        ]);

        $pivot = CollectionItem::query()
            ->where('collection_id', $collection->id)
            ->where('item_id', $item->id)
            ->firstOrFail();
        $this->assertSame(['note' => 'first'], $pivot->extra);

        $itemInternalNameBeforeEdit = $item->internal_name;

        Livewire::actingAs($user)
            ->test(ItemsRelationManager::class, [
                'ownerRecord' => $collection,
                'pageClass' => ViewCollection::class,
            ])
            ->mountTableAction('edit', $item)
            ->setTableActionData([
                'display_order' => 7,
                'extra' => json_encode(['note' => 'updated']),
            ])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('collection_item', [
            'collection_id' => $collection->id,
            'item_id' => $item->id,
            'display_order' => 7,
        ]);
        $pivot = CollectionItem::query()
            ->where('collection_id', $collection->id)
            ->where('item_id', $item->id)
            ->firstOrFail();
        $this->assertSame(['note' => 'updated'], $pivot->extra);
        // The edit-pivot modal must never touch the related Item's own columns.
        $this->assertSame($itemInternalNameBeforeEdit, $item->fresh()->internal_name);

        Livewire::actingAs($user)
            ->test(ItemsRelationManager::class, [
                'ownerRecord' => $collection,
                'pageClass' => ViewCollection::class,
            ])
            ->callTableAction(DetachAction::class, $item->fresh())
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('collection_item', [
            'collection_id' => $collection->id,
            'item_id' => $item->id,
        ]);
        $this->assertModelExists($item);
    }

    public function test_view_only_user_sees_no_item_pivot_mutations_on_the_collection_view_page(): void
    {
        $collection = $this->makeCollection();
        $item = Item::factory()->Object()->create();
        $collection->attachedItems()->attach($item->id, ['display_order' => 1]);
        $user = $this->createViewOnlyUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ItemsRelationManager::class, [
                'ownerRecord' => $collection,
                'pageClass' => ViewCollection::class,
            ])
            ->assertTableActionHidden('attach')
            ->assertTableActionHidden('edit', $item)
            ->assertTableActionHidden('detach', $item);
    }

    // ── Item side: CollectionAppearancesRelationManager ─────────────────────

    public function test_crud_user_attaches_edits_and_detaches_a_collection_from_the_item_view_page(): void
    {
        $item = Item::factory()->Object()->create();
        $collection = $this->makeCollection();
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CollectionAppearancesRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->mountTableAction('attach')
            ->setTableActionData([
                'recordId' => $collection->id,
                'display_order' => 2,
                'extra' => json_encode(['note' => 'appearance']),
            ])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('collection_item', [
            'collection_id' => $collection->id,
            'item_id' => $item->id,
            'display_order' => 2,
        ]);

        $pivot = CollectionItem::query()
            ->where('collection_id', $collection->id)
            ->where('item_id', $item->id)
            ->firstOrFail();
        $this->assertSame(['note' => 'appearance'], $pivot->extra);

        $collectionInternalNameBeforeEdit = $collection->internal_name;

        Livewire::actingAs($user)
            ->test(CollectionAppearancesRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->mountTableAction('edit', $collection)
            ->setTableActionData([
                'display_order' => 9,
                'extra' => json_encode(['note' => 'appearance-updated']),
            ])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('collection_item', [
            'collection_id' => $collection->id,
            'item_id' => $item->id,
            'display_order' => 9,
        ]);
        $pivot = CollectionItem::query()
            ->where('collection_id', $collection->id)
            ->where('item_id', $item->id)
            ->firstOrFail();
        $this->assertSame(['note' => 'appearance-updated'], $pivot->extra);
        // The edit-pivot modal must never touch the related Collection's own columns.
        $this->assertSame($collectionInternalNameBeforeEdit, $collection->fresh()->internal_name);

        Livewire::actingAs($user)
            ->test(CollectionAppearancesRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->callTableAction(DetachAction::class, $collection->fresh())
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('collection_item', [
            'collection_id' => $collection->id,
            'item_id' => $item->id,
        ]);
        $this->assertModelExists($collection);
    }

    public function test_view_only_user_sees_no_collection_pivot_mutations_on_the_item_view_page(): void
    {
        $item = Item::factory()->Object()->create();
        $collection = $this->makeCollection();
        $item->attachedToCollections()->attach($collection->id, ['display_order' => 1]);
        $user = $this->createViewOnlyUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CollectionAppearancesRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->assertTableActionHidden('attach')
            ->assertTableActionHidden('edit', $collection)
            ->assertTableActionHidden('detach', $collection);
    }

    private function makeCollection(): Collection
    {
        $context = Context::factory()->create();
        $language = Language::query()->find('eng') ?? Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);

        return Collection::factory()->create([
            'context_id' => $context->id,
            'language_id' => $language->id,
        ]);
    }
}
