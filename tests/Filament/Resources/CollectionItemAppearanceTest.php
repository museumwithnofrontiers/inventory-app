<?php

namespace Tests\Filament\Resources;

use App\Enums\Permission;
use App\Filament\Pages\ViewCollectionItemAppearance;
use App\Filament\Resources\CollectionResource\Pages\ViewCollection;
use App\Filament\Resources\CollectionResource\RelationManagers\ItemsRelationManager;
use App\Filament\Resources\ItemResource\Pages\ViewItem;
use App\Filament\Resources\ItemResource\RelationManagers\CollectionAppearancesRelationManager;
use App\Models\Collection;
use App\Models\CollectionItem;
use App\Models\CollectionItemExploreMonument;
use App\Models\CollectionItemTranslation;
use App\Models\Context;
use App\Models\Item;
use App\Models\Language;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * Tests covering Collection-Item appearance presentation in Filament.
 *
 * Uses self-contained factory data: a placement and its texts per language
 * (CollectionItemTranslation, M16 C2): a description and the text's own
 * legacy key.
 */
class CollectionItemAppearanceTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    // -------------------------------------------------------------------------
    // Collection page — Items relation manager
    // -------------------------------------------------------------------------

    public function test_collection_items_relation_manager_shows_item_with_display_order(): void
    {
        $user = $this->createCrudUser();
        $collection = Collection::factory()->create(['internal_name' => 'THG Collection']);
        $item = Item::factory()->Object()->create(['internal_name' => 'THG Relief']);

        $this->attachWithTexts($collection, $item, ['display_order' => 5], [
            'eng' => 'A remarkable carved relief depicting the daily life of ancient communities.',
        ], [
            'eng' => 'THG-001-ENG',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ItemsRelationManager::class, [
                'ownerRecord' => $collection,
                'pageClass' => ViewCollection::class,
            ])
            ->assertCanSeeTableRecords([$item])
            ->assertTableColumnExists('pivot.display_order');
    }

    public function test_collection_items_relation_manager_shows_contextual_text_preview_column(): void
    {
        $user = $this->createCrudUser();
        $collection = Collection::factory()->create(['internal_name' => 'THG Collection']);
        $item = Item::factory()->Object()->create(['internal_name' => 'THG Relief']);
        Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        // Default context required so ItemDisplayLabel::withDisplayLabel() resolves without errors.
        Context::factory()->create(['internal_name' => 'Default', 'is_default' => true]);

        $this->attachWithTexts($collection, $item, ['display_order' => 1], [
            'eng' => 'A remarkable carved relief depicting the daily life of ancient communities.',
            'fra' => 'Un remarquable relief sculpté représentant la vie quotidienne des communautés anciennes.',
        ], []);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ItemsRelationManager::class, [
                'ownerRecord' => $collection,
                'pageClass' => ViewCollection::class,
            ])
            ->assertTableColumnExists('pivot.contextual_text_preview')
            ->assertTableColumnExists('pivot.contextual_description_languages');
    }

    public function test_collection_items_relation_manager_has_view_appearance_action_for_items_with_pivot_data(): void
    {
        $user = $this->createCrudUser();
        $collection = Collection::factory()->create(['internal_name' => 'THG Collection']);
        $item = Item::factory()->Object()->create(['internal_name' => 'THG Relief']);

        $this->attachWithTexts($collection, $item, ['display_order' => 2], [
            'eng' => 'A remarkable carved relief.',
            'fra' => 'Un remarquable relief sculpté.',
        ], [
            'eng' => 'THG-001-ENG',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ItemsRelationManager::class, [
                'ownerRecord' => $collection,
                'pageClass' => ViewCollection::class,
            ])
            ->assertTableActionExists('view_appearance', record: $item);
    }

    public function test_collection_items_relation_manager_has_view_appearance_action_for_items_without_pivot_data(): void
    {
        $user = $this->createCrudUser();
        $collection = Collection::factory()->create(['internal_name' => 'THG Collection']);
        $item = Item::factory()->Object()->create(['internal_name' => 'THG Relief']);

        $collection->attachedItems()->attach($item->id);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ItemsRelationManager::class, [
                'ownerRecord' => $collection,
                'pageClass' => ViewCollection::class,
            ])
            ->assertTableActionExists('view_appearance', record: $item);
    }

    public function test_collection_items_relation_manager_view_appearance_action_links_to_appearance_page(): void
    {
        $user = $this->createCrudUser();
        $collection = Collection::factory()->create(['internal_name' => 'THG Collection']);
        $item = Item::factory()->Object()->create(['internal_name' => 'THG Relief']);

        $collection->attachedItems()->attach($item->id, ['display_order' => 3]);

        $this->setCurrentPanel();

        $expectedUrl = ViewCollectionItemAppearance::getAppearanceUrl($collection, $item);

        Livewire::actingAs($user)
            ->test(ItemsRelationManager::class, [
                'ownerRecord' => $collection,
                'pageClass' => ViewCollection::class,
            ])
            ->assertSeeHtml(htmlspecialchars($expectedUrl, ENT_QUOTES));
    }

    // -------------------------------------------------------------------------
    // Item page — Collection appearances relation manager
    // -------------------------------------------------------------------------

    public function test_collection_appearances_relation_manager_shows_collection_for_item(): void
    {
        $user = $this->createCrudUser();
        $context = Context::factory()->create(['internal_name' => 'Catalogue']);
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);
        $collection = Collection::factory()->create([
            'internal_name' => 'THG Collection',
            'context_id' => $context->id,
            'language_id' => $language->id,
        ]);
        $item = Item::factory()->Object()->create(['internal_name' => 'THG Relief']);

        $this->attachWithTexts($collection, $item, ['display_order' => 3], [
            'eng' => 'A remarkable carved relief depicting the daily life of ancient communities.',
            'fra' => 'Un remarquable relief sculpté.',
        ], [
            'eng' => 'THG-001-ENG',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CollectionAppearancesRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->assertCanSeeTableRecords([$collection])
            ->assertTableColumnExists('pivot.display_order')
            ->assertTableColumnExists('pivot.contextual_text_preview')
            ->assertTableColumnExists('pivot.contextual_description_languages');
    }

    public function test_collection_appearances_relation_manager_has_view_appearance_action_when_pivot_has_data(): void
    {
        $user = $this->createCrudUser();
        $context = Context::factory()->create(['internal_name' => 'Catalogue']);
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);
        $collection = Collection::factory()->create([
            'internal_name' => 'THG Collection',
            'context_id' => $context->id,
            'language_id' => $language->id,
        ]);
        $item = Item::factory()->Object()->create(['internal_name' => 'THG Relief']);

        $this->attachWithTexts($collection, $item, ['display_order' => 1], [
            'eng' => 'A remarkable carved relief.',
            'fra' => 'Un remarquable relief sculpté.',
        ], [
            'eng' => 'THG-001-ENG',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CollectionAppearancesRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->assertTableActionExists('view_appearance', record: $collection);
    }

    public function test_collection_appearances_relation_manager_has_view_appearance_action_when_no_pivot_data(): void
    {
        $user = $this->createCrudUser();
        $context = Context::factory()->create(['internal_name' => 'Catalogue']);
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);
        $collection = Collection::factory()->create([
            'internal_name' => 'THG Collection',
            'context_id' => $context->id,
            'language_id' => $language->id,
        ]);
        $item = Item::factory()->Object()->create(['internal_name' => 'THG Relief']);

        $collection->attachedItems()->attach($item->id);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CollectionAppearancesRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->assertTableActionExists('view_appearance', record: $collection);
    }

    public function test_collection_appearances_relation_manager_view_appearance_action_links_to_appearance_page(): void
    {
        $user = $this->createCrudUser();
        $context = Context::factory()->create(['internal_name' => 'Catalogue']);
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);
        $collection = Collection::factory()->create([
            'internal_name' => 'THG Collection',
            'context_id' => $context->id,
            'language_id' => $language->id,
        ]);
        $item = Item::factory()->Object()->create(['internal_name' => 'THG Relief']);

        $collection->attachedItems()->attach($item->id, ['display_order' => 2]);

        $this->setCurrentPanel();

        $expectedUrl = ViewCollectionItemAppearance::getAppearanceUrl($collection, $item);

        Livewire::actingAs($user)
            ->test(CollectionAppearancesRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->assertSeeHtml(htmlspecialchars($expectedUrl, ENT_QUOTES));
    }

    public function test_collection_appearances_relation_manager_shows_empty_state_when_item_not_in_any_collection(): void
    {
        $user = $this->createCrudUser();
        $context = Context::factory()->create(['internal_name' => 'Catalogue']);
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);
        $item = Item::factory()->Object()->create(['internal_name' => 'Standalone item']);
        // A collection that exists but is NOT attached to $item — verified to be absent from the table.
        $otherCollection = Collection::factory()->create([
            'internal_name' => 'Other collection',
            'context_id' => $context->id,
            'language_id' => $language->id,
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CollectionAppearancesRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->assertCanNotSeeTableRecords([$otherCollection]);
    }

    // -------------------------------------------------------------------------
    // Appearance detail page
    // -------------------------------------------------------------------------

    public function test_appearance_detail_page_route_exists(): void
    {
        $this->setCurrentPanel();
        $this->assertNotNull(
            route('filament.admin.collection-item.appearance', [
                'collection' => 'collection-id',
                'item' => 'item-id',
            ])
        );
    }

    public function test_appearance_detail_page_renders_for_authorized_user(): void
    {
        $user = $this->createCrudUser();
        $context = Context::factory()->create(['internal_name' => 'Catalogue']);
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);
        $collection = Collection::factory()->create([
            'internal_name' => 'THG Collection',
            'context_id' => $context->id,
            'language_id' => $language->id,
        ]);
        $item = Item::factory()->Object()->create(['internal_name' => 'THG Relief']);

        $this->attachWithTexts($collection, $item, ['display_order' => 7], [
            'eng' => 'A remarkable carved relief depicting the daily life of ancient communities.',
        ], [
            'eng' => 'THG-001-ENG',
        ]);

        $this->setCurrentPanel();

        $response = $this->actingAs($user)->get(
            route('filament.admin.collection-item.appearance', [
                'collection' => $collection->id,
                'item' => $item->id,
            ])
        );

        $response->assertSuccessful();
        $response->assertSee('THG Collection', escape: false);
        $response->assertSee('THG Relief', escape: false);
        $response->assertSee('7');
        $response->assertSee('A remarkable carved relief depicting the daily life of ancient communities.', escape: false);
        $response->assertSee('THG-001-ENG', escape: false);
    }

    public function test_appearance_detail_page_shows_all_language_sections(): void
    {
        $user = $this->createCrudUser();
        $collection = Collection::factory()->create(['internal_name' => 'Multi-lang Collection']);
        $item = Item::factory()->Object()->create(['internal_name' => 'Multi-lang Item']);

        $this->attachWithTexts($collection, $item, [], [
            'eng' => 'English description.',
            'fra' => 'Description française.',
            'ara' => 'وصف عربي.',
        ]);

        $this->setCurrentPanel();

        $response = $this->actingAs($user)->get(
            route('filament.admin.collection-item.appearance', [
                'collection' => $collection->id,
                'item' => $item->id,
            ])
        );

        $response->assertSuccessful();
        $response->assertSee('ENG');
        $response->assertSee('FRA');
        $response->assertSee('ARA');
        $response->assertSee('English description.', escape: false);
        $response->assertSee('Description française.', escape: false);
    }

    public function test_appearance_detail_page_returns_404_when_pivot_not_found(): void
    {
        $user = $this->createCrudUser();
        $collection = Collection::factory()->create();
        $item = Item::factory()->Object()->create();
        // No pivot relationship attached

        $this->setCurrentPanel();

        $response = $this->actingAs($user)->get(
            route('filament.admin.collection-item.appearance', [
                'collection' => $collection->id,
                'item' => $item->id,
            ])
        );

        $response->assertNotFound();
    }

    public function test_appearance_detail_page_requires_view_data_permission(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo([Permission::ACCESS_ADMIN_PANEL->value]);

        $collection = Collection::factory()->create();
        $item = Item::factory()->Object()->create();
        $collection->attachedItems()->attach($item->id);

        $this->setCurrentPanel();

        $response = $this->actingAs($user)->get(
            route('filament.admin.collection-item.appearance', [
                'collection' => $collection->id,
                'item' => $item->id,
            ])
        );

        $response->assertForbidden();
    }

    // -------------------------------------------------------------------------
    // Appearance detail page — the placement's texts
    // -------------------------------------------------------------------------

    public function test_appearance_page_adds_edits_and_deletes_a_language(): void
    {
        $user = $this->createCrudUser();
        $collection = Collection::factory()->create();
        $item = Item::factory()->Object()->create();
        $collection->attachedItems()->attach($item->id);
        $placement = CollectionItem::query()->where('collection_id', $collection->id)->firstOrFail();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);

        $this->setCurrentPanel();

        $page = Livewire::actingAs($user)
            ->test(ViewCollectionItemAppearance::class, ['collection' => $collection, 'item' => $item])
            ->callTableAction('create', data: [
                'language_id' => $language->id,
                'description' => 'The fountain on this page.',
                'item_name' => 'The Hercules fountain',
                'curator_justification' => 'Chosen by the curator.',
            ])
            ->assertHasNoTableActionErrors();

        $translation = CollectionItemTranslation::query()->where('collection_item_id', $placement->id)->firstOrFail();
        $this->assertSame('The Hercules fountain', $translation->item_name);
        $this->assertSame('Chosen by the curator.', $translation->curator_justification);
        $this->assertNull($translation->partner_justification);

        $page->callTableAction('create', data: ['language_id' => $language->id])
            ->assertHasTableActionErrors(['language_id' => 'unique']);

        $page = Livewire::actingAs($user)
            ->test(ViewCollectionItemAppearance::class, ['collection' => $collection, 'item' => $item]);
        $page->callTableAction('edit', $translation, data: ['caption' => 'Orientalist painting (detail)'])
            ->assertHasNoTableActionErrors();
        $this->assertSame('Orientalist painting (detail)', $translation->refresh()->caption);
        $this->assertSame('The Hercules fountain', $translation->item_name);

        $page->callTableAction('delete', $translation);
        $this->assertDatabaseMissing('collection_item_translations', ['id' => $translation->id]);
    }

    public function test_appearance_page_texts_are_read_only_without_update_on_the_collection(): void
    {
        $user = $this->createViewOnlyUser();
        $collection = Collection::factory()->create();
        $item = Item::factory()->Object()->create();
        $this->attachWithTexts($collection, $item, [], ['eng' => 'English description.']);
        $translation = CollectionItemTranslation::query()->firstOrFail();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ViewCollectionItemAppearance::class, ['collection' => $collection, 'item' => $item])
            ->assertCanSeeTableRecords([$translation])
            ->assertTableActionHidden('create')
            ->assertTableActionHidden('edit', $translation)
            ->assertTableActionHidden('delete', $translation)
            ->assertTableActionVisible('view', $translation)
            ->assertActionHidden('exploreMonuments');
    }

    // -------------------------------------------------------------------------
    // Appearance detail page — the Explore monuments (M16 C4)
    // -------------------------------------------------------------------------

    public function test_appearance_page_lists_and_edits_the_explore_monuments(): void
    {
        $user = $this->createCrudUser();
        $collection = Collection::factory()->create();
        $item = Item::factory()->Object()->create();
        $collection->attachedItems()->attach($item->id);
        $placement = CollectionItem::query()->where('collection_id', $collection->id)->firstOrFail();
        $monument = CollectionItemExploreMonument::factory()->forPlacement($placement)->create([
            'backward_compatibility' => 'mwnf3_explore:monument:1275',
            'latitude' => 34.030727,
            'longitude' => -6.835677,
        ]);

        $this->setCurrentPanel();

        $this->actingAs($user)
            ->get(ViewCollectionItemAppearance::getAppearanceUrl($collection, $item))
            ->assertSuccessful()
            ->assertSee('mwnf3_explore:monument:1275 · 34.030727, -6.835677');

        Livewire::actingAs($user)
            ->test(ViewCollectionItemAppearance::class, ['collection' => $collection, 'item' => $item])
            ->assertActionVisible('exploreMonuments')
            ->callAction('exploreMonuments', data: [
                'exploreMonuments' => [
                    'record-'.$monument->id => [
                        'backward_compatibility' => 'mwnf3_explore:monument:1275',
                        'latitude' => 34.5,
                        'longitude' => -6.835677,
                        'map_zoom' => 15,
                        'location_collection_id' => null,
                        'partners' => [],
                    ],
                ],
            ])
            ->assertHasNoActionErrors();

        $this->assertSame(34.5, $monument->refresh()->latitude);
        $this->assertSame(15, $monument->map_zoom);
    }

    /**
     * Attaches the item and gives the placement a description, and a legacy
     * key, per language.
     *
     * @param  array<string, mixed>  $pivot
     * @param  array<string, string>  $descriptions  language id → description
     * @param  array<string, string>  $keys  language id → legacy key
     */
    private function attachWithTexts(Collection $collection, Item $item, array $pivot, array $descriptions, array $keys = []): void
    {
        $collection->attachedItems()->attach($item->id, $pivot);
        $placement = CollectionItem::query()
            ->where('collection_id', $collection->id)
            ->where('item_id', $item->id)
            ->firstOrFail();
        foreach (array_unique([...array_keys($descriptions), ...array_keys($keys)]) as $languageId) {
            if (! Language::query()->whereKey($languageId)->exists()) {
                Language::factory()->create(['id' => $languageId]);
            }
            CollectionItemTranslation::factory()->forPlacement($placement)->create([
                'language_id' => $languageId,
                'description' => $descriptions[$languageId] ?? null,
                'item_name' => null,
                'backward_compatibility' => $keys[$languageId] ?? null,
            ]);
        }
    }
}
