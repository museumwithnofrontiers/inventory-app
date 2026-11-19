<?php

namespace Tests\Filament\RelationManagers;

use App\Filament\Resources\CollectionResource\Pages\ViewCollection;
use App\Filament\Resources\CollectionResource\RelationManagers\ItemsRelationManager;
use App\Models\Collection;
use App\Models\CollectionItem;
use App\Models\Context;
use App\Models\Item;
use App\Models\Language;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * M16 C1 (#2641): an item on a collection is a placement, a record with its
 * own UUID, its variant and parent variant numbers, the picture it shows and
 * the curator flag.
 */
class CollectionItemPlacementTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_attaching_an_item_makes_a_placement_with_its_own_uuid(): void
    {
        $collection = $this->makeCollection();
        $item = Item::factory()->Object()->create();

        $collection->attachedItems()->attach($item->id, ['display_order' => 2]);

        $placement = CollectionItem::query()->where('collection_id', $collection->id)->firstOrFail();
        $this->assertTrue(Str::isUuid($placement->id));
        $this->assertSame($item->id, $placement->item_id);
        $this->assertSame(2, $placement->display_order);
        $this->assertNull($placement->curator_selected);
    }

    public function test_the_pair_stays_unique(): void
    {
        $collection = $this->makeCollection();
        $item = Item::factory()->Object()->create();
        $collection->attachedItems()->attach($item->id);

        $this->expectException(QueryException::class);
        $collection->attachedItems()->attach($item->id);
    }

    public function test_crud_user_edits_the_placement_fields(): void
    {
        $collection = $this->makeCollection();
        $item = Item::factory()->Object()->create();
        $picture = Item::factory()->Picture()->create(['parent_id' => $item->id]);
        $collection->attachedItems()->attach($item->id, ['display_order' => 1]);

        $this->setCurrentPanel();

        Livewire::actingAs($this->createCrudUser())
            ->test(ItemsRelationManager::class, [
                'ownerRecord' => $collection,
                'pageClass' => ViewCollection::class,
            ])
            ->mountTableAction('edit', $item)
            ->setTableActionData([
                'display_order' => 1,
                'variant_order' => 3,
                'parent_variant_order' => 2,
                'picture_item_id' => $picture->id,
                'curator_selected' => '1',
            ])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $placement = CollectionItem::query()->where('collection_id', $collection->id)->firstOrFail();
        $this->assertSame(3, $placement->variant_order);
        $this->assertSame(2, $placement->parent_variant_order);
        $this->assertSame($picture->id, $placement->picture_item_id);
        $this->assertTrue($placement->curator_selected);
        $this->assertSame($picture->id, $placement->picture?->id);
    }

    public function test_the_curator_flag_can_go_back_to_not_given(): void
    {
        $collection = $this->makeCollection();
        $item = Item::factory()->Object()->create();
        $collection->attachedItems()->attach($item->id, ['curator_selected' => false]);

        $this->setCurrentPanel();

        Livewire::actingAs($this->createCrudUser())
            ->test(ItemsRelationManager::class, [
                'ownerRecord' => $collection,
                'pageClass' => ViewCollection::class,
            ])
            ->mountTableAction('edit', $item)
            ->assertTableActionDataSet(['curator_selected' => '0'])
            ->setTableActionData(['curator_selected' => null])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $this->assertNull(CollectionItem::query()->where('collection_id', $collection->id)->firstOrFail()->curator_selected);
    }

    public function test_crud_user_can_reorder_and_view_only_user_cannot(): void
    {
        $collection = $this->makeCollection();
        $first = Item::factory()->Object()->create();
        $second = Item::factory()->Object()->create();
        $collection->attachedItems()->attach($first->id, ['display_order' => 1]);
        $collection->attachedItems()->attach($second->id, ['display_order' => 2]);

        $this->setCurrentPanel();

        Livewire::actingAs($this->createCrudUser())
            ->test(ItemsRelationManager::class, [
                'ownerRecord' => $collection,
                'pageClass' => ViewCollection::class,
            ])
            ->call('reorderTable', [$second->id, $first->id]);

        $orders = CollectionItem::query()->where('collection_id', $collection->id)->pluck('display_order', 'item_id');
        $this->assertSame(1, $orders[$second->id]);
        $this->assertSame(2, $orders[$first->id]);

        Livewire::actingAs($this->createViewOnlyUser())
            ->test(ItemsRelationManager::class, [
                'ownerRecord' => $collection,
                'pageClass' => ViewCollection::class,
            ])
            ->assertDontSeeHtml('wire:click="toggleTableReordering"');
    }

    public function test_deleting_the_picture_clears_the_placement_picture(): void
    {
        $collection = $this->makeCollection();
        $item = Item::factory()->Object()->create();
        $picture = Item::factory()->Picture()->create(['parent_id' => $item->id]);
        $collection->attachedItems()->attach($item->id, ['picture_item_id' => $picture->id]);

        $picture->delete();

        $this->assertNull(CollectionItem::query()->where('collection_id', $collection->id)->firstOrFail()->picture_item_id);
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
