<?php

namespace Tests\Filament\Pages;

use App\Enums\Permission;
use App\Filament\Pages\BrowseCollectionTree;
use App\Filament\Resources\CollectionResource;
use App\Filament\Resources\ItemResource;
use App\Models\Collection;
use App\Models\Context;
use App\Models\Item;
use App\Models\Language;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

class BrowseCollectionTreePageTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    protected function createViewUser(): User
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo([
            Permission::ACCESS_ADMIN_PANEL->value,
            Permission::VIEW_DATA->value,
        ]);

        return $user;
    }

    /**
     * Bulk-insert root collections reusing a single language + context pair.
     */
    protected function seedRootCollections(int $count, string $prefix = 'Root'): void
    {
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);

        $timestamp = Carbon::now();
        $rows = [];

        for ($i = 1; $i <= $count; $i++) {
            $rows[] = [
                'id' => (string) Str::uuid(),
                'internal_name' => sprintf('%s Collection %04d', $prefix, $i),
                'backward_compatibility' => sprintf('%s-%04d', strtolower($prefix), $i),
                'type' => 'collection',
                'language_id' => $language->id,
                'context_id' => $context->id,
                'parent_id' => null,
                'display_order' => null,
                'latitude' => null,
                'longitude' => null,
                'map_zoom' => null,
                'country_id' => null,
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ];
        }

        foreach (array_chunk($rows, 500) as $chunk) {
            Collection::query()->insert($chunk);
        }
    }

    // -------------------------------------------------------------------------
    // Basic rendering
    // -------------------------------------------------------------------------

    public function test_page_renders_for_authorised_user(): void
    {
        $user = $this->createViewUser();

        $this->actingAs($user)->get('/admin/browse-collection-tree')->assertOk();
    }

    // -------------------------------------------------------------------------
    // Search by internal_name
    // -------------------------------------------------------------------------

    public function test_search_filters_roots_by_internal_name(): void
    {
        $user = $this->createViewUser();

        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);

        Collection::factory()->withLanguage($language->id)->withContext($context->id)->create([
            'internal_name' => 'Egyptian Gallery',
            'parent_id' => null,
        ]);
        Collection::factory()->withLanguage($language->id)->withContext($context->id)->create([
            'internal_name' => 'Bronze Age',
            'parent_id' => null,
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseCollectionTree::class)
            ->set('filterChildCollections', 'all')
            ->set('search', 'Egyptian')
            ->assertSee('Egyptian Gallery')
            ->assertDontSee('Bronze Age');
    }

    // -------------------------------------------------------------------------
    // Search by backward_compatibility
    // -------------------------------------------------------------------------

    public function test_search_filters_roots_by_backward_compatibility(): void
    {
        $user = $this->createViewUser();

        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);

        Collection::factory()->withLanguage($language->id)->withContext($context->id)->create([
            'internal_name' => 'Alpha Collection',
            'backward_compatibility' => 'leg-alpha',
            'parent_id' => null,
        ]);
        Collection::factory()->withLanguage($language->id)->withContext($context->id)->create([
            'internal_name' => 'Beta Collection',
            'backward_compatibility' => 'leg-beta',
            'parent_id' => null,
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseCollectionTree::class)
            ->set('filterChildCollections', 'all')
            ->set('search', 'leg-alpha')
            ->assertSee('Alpha Collection')
            ->assertDontSee('Beta Collection');
    }

    // -------------------------------------------------------------------------
    // Pagination: more roots than one page
    // -------------------------------------------------------------------------

    public function test_pagination_shows_first_page_when_roots_exceed_page_size(): void
    {
        $user = $this->createViewUser();

        // 51 roots → 2 pages.
        $this->seedRootCollections(51);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseCollectionTree::class)
            ->set('filterChildCollections', 'all')
            ->assertSee('Page 1 of 2');
    }

    public function test_next_page_advances_to_second_page(): void
    {
        $user = $this->createViewUser();

        $this->seedRootCollections(51);

        // Create an alphabetically-last item that lands on page 2.
        $language = Language::factory()->create(['id' => 'fra', 'internal_name' => 'French', 'is_default' => false]);
        $context = Context::factory()->create(['internal_name' => 'Other', 'is_default' => false]);
        Collection::factory()->withLanguage($language->id)->withContext($context->id)->create([
            'internal_name' => 'Zzz Unique Last Collection',
            'parent_id' => null,
        ]);
        // 52 roots → page 2 has 2 items.

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseCollectionTree::class)
            ->set('filterChildCollections', 'all')
            ->assertDontSee('Zzz Unique Last Collection')
            ->call('nextPage')
            ->assertSee('Page 2 of 2')
            ->assertSee('Zzz Unique Last Collection');
    }

    public function test_previous_page_returns_to_first_page(): void
    {
        $user = $this->createViewUser();

        $this->seedRootCollections(51);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseCollectionTree::class)
            ->set('filterChildCollections', 'all')
            ->call('nextPage')
            ->assertSee('Page 2 of 2')
            ->call('previousPage')
            ->assertSee('Page 1 of 2');
    }

    public function test_search_resets_page_to_first(): void
    {
        $user = $this->createViewUser();

        $this->seedRootCollections(51);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseCollectionTree::class)
            ->set('filterChildCollections', 'all')
            ->call('nextPage')
            ->assertSet('page', 2)
            ->set('search', 'something')
            ->assertSet('page', 1);
    }

    // -------------------------------------------------------------------------
    // Count / subset messaging
    // -------------------------------------------------------------------------

    public function test_root_count_messaging_is_shown(): void
    {
        $user = $this->createViewUser();

        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);

        Collection::factory()->withLanguage($language->id)->withContext($context->id)->create([
            'internal_name' => 'Visible Root',
            'parent_id' => null,
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseCollectionTree::class)
            ->set('filterChildCollections', 'all')
            ->assertSee('1 root collection');
    }

    public function test_search_result_count_is_shown(): void
    {
        $user = $this->createViewUser();

        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);

        Collection::factory()->withLanguage($language->id)->withContext($context->id)
            ->create(['internal_name' => 'Temple Gallery', 'parent_id' => null]);
        Collection::factory()->withLanguage($language->id)->withContext($context->id)
            ->create(['internal_name' => 'Temple Trail', 'parent_id' => null]);
        Collection::factory()->withLanguage($language->id)->withContext($context->id)
            ->create(['internal_name' => 'Bronze Age', 'parent_id' => null]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseCollectionTree::class)
            ->set('filterChildCollections', 'all')
            ->set('search', 'Temple')
            ->assertSee('2 results');
    }

    // -------------------------------------------------------------------------
    // Node links
    // -------------------------------------------------------------------------

    public function test_tree_node_label_links_to_collection_resource_view_page(): void
    {
        $user = $this->createViewUser();

        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);

        $collection = Collection::factory()->withLanguage($language->id)->withContext($context->id)->create([
            'internal_name' => 'Linked Collection',
            'parent_id' => null,
        ]);

        $this->setCurrentPanel();

        $viewUrl = CollectionResource::getUrl('view', ['record' => $collection->getKey()]);

        Livewire::actingAs($user)
            ->test(BrowseCollectionTree::class)
            ->set('filterChildCollections', 'all')
            ->assertSee($viewUrl, false);
    }

    // -------------------------------------------------------------------------
    // Collection item membership (collection_item pivot)
    // -------------------------------------------------------------------------

    public function test_collection_with_attached_items_shows_item_count(): void
    {
        $user = $this->createViewUser();

        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);

        $gallery = Collection::factory()->gallery()->withLanguage($language->id)->withContext($context->id)->create([
            'internal_name' => 'Amulets Gallery',
            'parent_id' => null,
        ]);

        $items = Item::factory()->Object()->count(3)->create(['parent_id' => null]);
        $gallery->attachedItems()->attach($items->pluck('id'));

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseCollectionTree::class)
            ->set('filterChildCollections', 'all')
            ->assertSee('3 items');
    }

    public function test_collection_with_no_attached_items_shows_no_item_count(): void
    {
        $user = $this->createViewUser();

        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);

        Collection::factory()->gallery()->withLanguage($language->id)->withContext($context->id)->create([
            'internal_name' => 'Empty Gallery',
            'parent_id' => null,
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseCollectionTree::class)
            ->set('filterChildCollections', 'all')
            ->assertDontSeeText('0 items');
    }

    public function test_expanding_collection_node_reveals_attached_items(): void
    {
        $user = $this->createViewUser();

        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);

        $gallery = Collection::factory()->gallery()->withLanguage($language->id)->withContext($context->id)->create([
            'internal_name' => 'Amulets Gallery',
            'parent_id' => null,
        ]);

        $item = Item::factory()->Object()->create([
            'internal_name' => 'Amulet Item',
            'parent_id' => null,
        ]);
        $gallery->attachedItems()->attach($item->id);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseCollectionTree::class)
            ->set('filterChildCollections', 'all')
            ->assertDontSee('Amulet Item')
            ->call('expand', $gallery->id)
            ->assertSee('Amulet Item');
    }

    public function test_expanded_collection_node_shows_item_link_to_item_resource_view(): void
    {
        $user = $this->createViewUser();

        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);

        $gallery = Collection::factory()->gallery()->withLanguage($language->id)->withContext($context->id)->create([
            'internal_name' => 'Linked Gallery',
            'parent_id' => null,
        ]);

        $item = Item::factory()->Object()->create([
            'internal_name' => 'Member Item',
            'parent_id' => null,
        ]);
        $gallery->attachedItems()->attach($item->id);

        $this->setCurrentPanel();

        $itemViewUrl = ItemResource::getUrl('view', ['record' => $item->getKey()]);

        Livewire::actingAs($user)
            ->test(BrowseCollectionTree::class)
            ->set('filterChildCollections', 'all')
            ->call('expand', $gallery->id)
            ->assertSee($itemViewUrl, false);
    }

    public function test_items_appear_under_their_collection_not_under_sibling(): void
    {
        $user = $this->createViewUser();

        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);

        $galleryA = Collection::factory()->gallery()->withLanguage($language->id)->withContext($context->id)->create([
            'internal_name' => 'Gallery A',
            'parent_id' => null,
        ]);
        $galleryB = Collection::factory()->gallery()->withLanguage($language->id)->withContext($context->id)->create([
            'internal_name' => 'Gallery B',
            'parent_id' => null,
        ]);

        $item = Item::factory()->Object()->create([
            'internal_name' => 'Exclusive Item',
            'parent_id' => null,
        ]);
        $galleryA->attachedItems()->attach($item->id);

        $this->setCurrentPanel();

        // Expanding gallery A reveals the item; gallery B does not show it.
        Livewire::actingAs($user)
            ->test(BrowseCollectionTree::class)
            ->set('filterChildCollections', 'all')
            ->call('expand', $galleryA->id)
            ->assertSee('Exclusive Item');

        Livewire::actingAs($user)
            ->test(BrowseCollectionTree::class)
            ->set('filterChildCollections', 'all')
            ->call('expand', $galleryB->id)
            ->assertDontSee('Exclusive Item');
    }

    public function test_item_membership_reads_from_collection_item_not_from_parent_id(): void
    {
        $user = $this->createViewUser();

        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);

        $gallery = Collection::factory()->gallery()->withLanguage($language->id)->withContext($context->id)->create([
            'internal_name' => 'Pivot Gallery',
            'parent_id' => null,
        ]);

        // Item has no parent_id (standalone), membership is only via pivot.
        $item = Item::factory()->Object()->create([
            'internal_name' => 'Pivot-Only Item',
            'parent_id' => null,
        ]);
        $gallery->attachedItems()->attach($item->id);

        $this->setCurrentPanel();

        // The item is visible in the gallery node when expanded, even though parent_id IS NULL.
        Livewire::actingAs($user)
            ->test(BrowseCollectionTree::class)
            ->set('filterChildCollections', 'all')
            ->call('expand', $gallery->id)
            ->assertSee('Pivot-Only Item');
    }

    public function test_amulets_style_fixture_45_items_shows_gallery_as_containing_member_items(): void
    {
        $user = $this->createViewUser();

        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);

        $gallery = Collection::factory()->gallery()->withLanguage($language->id)->withContext($context->id)->create([
            'internal_name' => 'gallery_amulets_and_talismans',
            'backward_compatibility' => 'mwnf3_thematic_gallery:thg_gallery:4',
            'parent_id' => null,
        ]);

        // Simulate 45 direct collection_item membership rows (no parent_id set on any item).
        $items = Item::factory()->Object()->count(45)->create(['parent_id' => null]);
        $gallery->attachedItems()->attach($items->pluck('id'));

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseCollectionTree::class)
            ->set('filterChildCollections', 'all')
            ->assertSee('gallery_amulets_and_talismans')
            ->assertSee('45 items');
    }

    public function test_root_collection_with_no_collection_item_rows_does_not_show_member_items(): void
    {
        $user = $this->createViewUser();

        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);

        $root = Collection::factory()->gallery()->withLanguage($language->id)->withContext($context->id)->create([
            'internal_name' => 'thg_galleries_root',
            'parent_id' => null,
        ]);

        $gallery = Collection::factory()->gallery()->withLanguage($language->id)->withContext($context->id)->create([
            'internal_name' => 'gallery_amulets_and_talismans',
            'parent_id' => $root->id,
        ]);

        // Attach items only to the child gallery, not to the root.
        $item = Item::factory()->Object()->create([
            'internal_name' => 'unique_amulet_member_item',
            'parent_id' => null,
        ]);
        $gallery->attachedItems()->attach($item->id);

        $this->setCurrentPanel();

        // Expanding the root shows the child collection but not the items (items are under the child gallery).
        Livewire::actingAs($user)
            ->test(BrowseCollectionTree::class)
            ->call('expand', $root->id)
            ->assertSee('gallery_amulets_and_talismans')
            ->assertDontSee('unique_amulet_member_item');
    }

    // -------------------------------------------------------------------------
    // Default filter: filterChildCollections defaults to 'with'
    // -------------------------------------------------------------------------

    public function test_default_filter_child_collections_is_with(): void
    {
        $user = $this->createViewUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseCollectionTree::class)
            ->assertSet('filterChildCollections', 'with');
    }

    public function test_collections_without_children_are_hidden_by_default(): void
    {
        $user = $this->createViewUser();

        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);

        // A root collection with no children.
        Collection::factory()->withLanguage($language->id)->withContext($context->id)->create([
            'internal_name' => 'Childless Collection',
            'parent_id' => null,
        ]);

        // A root collection that has a child.
        $parent = Collection::factory()->withLanguage($language->id)->withContext($context->id)->create([
            'internal_name' => 'Parent Collection',
            'parent_id' => null,
        ]);
        Collection::factory()->withLanguage($language->id)->withContext($context->id)->create([
            'internal_name' => 'Child Collection',
            'parent_id' => $parent->id,
        ]);

        $this->setCurrentPanel();

        // Default filterChildCollections='with' → only Parent Collection is visible at root level.
        Livewire::actingAs($user)
            ->test(BrowseCollectionTree::class)
            ->assertDontSee('Childless Collection')
            ->assertSee('Parent Collection');
    }

    public function test_filter_child_collections_all_shows_collections_without_children(): void
    {
        $user = $this->createViewUser();

        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);

        Collection::factory()->withLanguage($language->id)->withContext($context->id)->create([
            'internal_name' => 'Leaf Collection',
            'parent_id' => null,
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseCollectionTree::class)
            ->set('filterChildCollections', 'all')
            ->assertSee('Leaf Collection');
    }

    public function test_filter_child_collections_resets_page_to_first(): void
    {
        $user = $this->createViewUser();

        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);

        // Create 52 collections each with a child so they pass the 'with' filter and page=2 is reachable.
        for ($i = 1; $i <= 52; $i++) {
            $parent = Collection::factory()->withLanguage($language->id)->withContext($context->id)->create([
                'internal_name' => sprintf('Parent Col %04d', $i),
                'parent_id' => null,
            ]);
            Collection::factory()->withLanguage($language->id)->withContext($context->id)->create([
                'internal_name' => sprintf('Child Col %04d', $i),
                'parent_id' => $parent->id,
            ]);
        }

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseCollectionTree::class)
            ->call('nextPage')
            ->assertSet('page', 2)
            ->set('filterChildCollections', 'all')
            ->assertSet('page', 1);
    }

    // -------------------------------------------------------------------------
    // Centralized item display label (Story #1298)
    // -------------------------------------------------------------------------

    public function test_expanded_collection_item_row_uses_centralized_display_label_as_primary(): void
    {
        $user = $this->createViewUser();

        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);

        $gallery = Collection::factory()->gallery()->withLanguage($language->id)->withContext($context->id)->create([
            'internal_name' => 'Label Gallery',
            'parent_id' => null,
        ]);

        $item = Item::factory()->Object()->create([
            'internal_name' => 'raw_internal_object_name',
            'parent_id' => null,
        ]);
        $item->translations()->create([
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Resolved Object Title',
        ]);
        $gallery->attachedItems()->attach($item->id);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseCollectionTree::class)
            ->set('filterChildCollections', 'all')
            ->call('expand', $gallery->id)
            ->assertSee('Resolved Object Title')
            ->assertSee('raw_internal_object_name');
    }

    public function test_expanded_collection_item_row_shows_internal_name_when_no_translation_exists(): void
    {
        $user = $this->createViewUser();

        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);

        $gallery = Collection::factory()->gallery()->withLanguage($language->id)->withContext($context->id)->create([
            'internal_name' => 'Untranslated Gallery',
            'parent_id' => null,
        ]);

        $item = Item::factory()->Object()->create([
            'internal_name' => 'Picture 1 for bar:Mon11:30',
            'parent_id' => null,
        ]);
        $gallery->attachedItems()->attach($item->id);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseCollectionTree::class)
            ->set('filterChildCollections', 'all')
            ->call('expand', $gallery->id)
            ->assertSee('Picture 1 for bar:Mon11:30');
    }

    public function test_expanded_collection_picture_item_display_label_differs_from_internal_name(): void
    {
        $user = $this->createViewUser();

        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);

        $gallery = Collection::factory()->gallery()->withLanguage($language->id)->withContext($context->id)->create([
            'internal_name' => 'Picture Gallery',
            'parent_id' => null,
        ]);

        // Simulate a legacy-imported picture with technical internal_name but a human-readable translation.
        $picture = Item::factory()->Picture()->create([
            'internal_name' => 'Picture 10 for isl:Mon01:1',
            'parent_id' => null,
        ]);
        $picture->translations()->create([
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Mosque of Cordoba (10)',
        ]);
        $gallery->attachedItems()->attach($picture->id);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseCollectionTree::class)
            ->set('filterChildCollections', 'all')
            ->call('expand', $gallery->id)
            // Primary: resolved translation
            ->assertSee('Mosque of Cordoba (10)')
            // Secondary: technical internal_name shown because it differs
            ->assertSee('Picture 10 for isl:Mon01:1');
    }
}
