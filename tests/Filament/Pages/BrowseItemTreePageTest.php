<?php

namespace Tests\Filament\Pages;

use App\Enums\ItemType;
use App\Enums\Permission;
use App\Filament\Pages\BrowseItemTree;
use App\Filament\Resources\ItemResource;
use App\Models\Country;
use App\Models\Item;
use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

class BrowseItemTreePageTest extends TestCase
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
     * Bulk-insert root items without triggering all factory side-effects.
     */
    protected function seedRootItems(int $count, string $prefix = 'Root'): void
    {
        $timestamp = Carbon::now();
        $rows = [];

        for ($i = 1; $i <= $count; $i++) {
            $rows[] = [
                'id' => (string) Str::uuid(),
                'internal_name' => sprintf('%s Item %04d', $prefix, $i),
                'backward_compatibility' => sprintf('%s-%04d', strtolower($prefix), $i),
                'type' => ItemType::OBJECT->value,
                'partner_id' => null,
                'parent_id' => null,
                'project_id' => null,
                'country_id' => null,
                'display_order' => null,
                'owner_reference' => null,
                'mwnf_reference' => null,
                'start_date' => null,
                'end_date' => null,
                'latitude' => null,
                'longitude' => null,
                'map_zoom' => null,
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ];
        }

        foreach (array_chunk($rows, 500) as $chunk) {
            Item::query()->insert($chunk);
        }
    }

    // -------------------------------------------------------------------------
    // Basic rendering
    // -------------------------------------------------------------------------

    public function test_page_renders_for_authorised_user(): void
    {
        $user = $this->createViewUser();

        $this->actingAs($user)->get('/admin/browse-item-tree')->assertOk();
    }

    // -------------------------------------------------------------------------
    // Search by internal_name
    // -------------------------------------------------------------------------

    public function test_search_filters_roots_by_internal_name(): void
    {
        $user = $this->createViewUser();

        Item::factory()->Object()->create(['internal_name' => 'Temple Relief', 'parent_id' => null]);
        Item::factory()->Object()->create(['internal_name' => 'Bronze Statue', 'parent_id' => null]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseItemTree::class)
            ->set('search', 'Temple')
            ->assertSee('Temple Relief')
            ->assertDontSee('Bronze Statue');
    }

    // -------------------------------------------------------------------------
    // Search by backward_compatibility
    // -------------------------------------------------------------------------

    public function test_search_filters_roots_by_backward_compatibility(): void
    {
        $user = $this->createViewUser();

        Item::factory()->Object()->create([
            'internal_name' => 'Alpha Item',
            'backward_compatibility' => 'legacy-abc',
            'parent_id' => null,
        ]);
        Item::factory()->Object()->create([
            'internal_name' => 'Beta Item',
            'backward_compatibility' => 'legacy-xyz',
            'parent_id' => null,
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseItemTree::class)
            ->set('search', 'legacy-abc')
            ->assertSee('Alpha Item')
            ->assertDontSee('Beta Item');
    }

    // -------------------------------------------------------------------------
    // Pagination: more roots than one page
    // -------------------------------------------------------------------------

    public function test_pagination_shows_first_page_when_roots_exceed_page_size(): void
    {
        $user = $this->createViewUser();

        // Insert PAGE_SIZE+1 roots so that pagination is triggered.
        $this->seedRootItems(51);

        $this->setCurrentPanel();

        $component = Livewire::actingAs($user)
            ->test(BrowseItemTree::class);

        // Should show page 1 of 2 messaging in the rendered output.
        $component->assertSee('Page 1 of 2');
    }

    public function test_next_page_advances_to_second_page(): void
    {
        $user = $this->createViewUser();

        // 51 roots → 2 pages (50 + 1).  The single item on page 2 is alphabetically last.
        $this->seedRootItems(51);

        // Make last-page item distinguishable (alphabetically after "Root Item …").
        Item::factory()->Object()->create([
            'internal_name' => 'Zzz Unique Last Item',
            'parent_id' => null,
        ]);
        // Now we have 52 roots → still 2 pages (50 + 2).

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseItemTree::class)
            ->assertDontSee('Zzz Unique Last Item') // on page 1 by default
            ->call('nextPage')
            ->assertSee('Page 2 of 2')
            ->assertSee('Zzz Unique Last Item');
    }

    public function test_previous_page_returns_to_first_page(): void
    {
        $user = $this->createViewUser();

        $this->seedRootItems(51);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseItemTree::class)
            ->call('nextPage')
            ->assertSee('Page 2 of 2')
            ->call('previousPage')
            ->assertSee('Page 1 of 2');
    }

    public function test_search_resets_page_to_first(): void
    {
        $user = $this->createViewUser();

        $this->seedRootItems(51);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseItemTree::class)
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

        Item::factory()->Object()->create(['internal_name' => 'Visible Root', 'parent_id' => null]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseItemTree::class)
            ->assertSee('1 root item');
    }

    public function test_search_result_count_is_shown(): void
    {
        $user = $this->createViewUser();

        Item::factory()->Object()->create(['internal_name' => 'Temple Gate', 'parent_id' => null]);
        Item::factory()->Object()->create(['internal_name' => 'Temple Wall', 'parent_id' => null]);
        Item::factory()->Object()->create(['internal_name' => 'Bronze Vessel', 'parent_id' => null]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseItemTree::class)
            ->set('search', 'Temple')
            ->assertSee('2 results');
    }

    // -------------------------------------------------------------------------
    // Node links
    // -------------------------------------------------------------------------

    public function test_tree_node_label_links_to_item_resource_view_page(): void
    {
        $user = $this->createViewUser();

        $item = Item::factory()->Object()->create(['internal_name' => 'Linked Item', 'parent_id' => null]);

        $this->setCurrentPanel();

        $viewUrl = ItemResource::getUrl('view', ['record' => $item->getKey()]);

        Livewire::actingAs($user)
            ->test(BrowseItemTree::class)
            ->assertSee($viewUrl, false);
    }

    // -------------------------------------------------------------------------
    // Non-root items are not shown as roots
    // -------------------------------------------------------------------------

    public function test_child_items_do_not_appear_as_roots(): void
    {
        $user = $this->createViewUser();

        $parent = Item::factory()->Object()->create(['internal_name' => 'Parent Item', 'parent_id' => null]);
        Item::factory()->Object()->create([
            'internal_name' => 'Child Item',
            'parent_id' => $parent->getKey(),
            'type' => ItemType::DETAIL->value,
        ]);

        $this->setCurrentPanel();

        // Default (no expansion) → only root shown.
        Livewire::actingAs($user)
            ->test(BrowseItemTree::class)
            ->assertSee('Parent Item')
            ->assertDontSee('Child Item');
    }

    // -------------------------------------------------------------------------
    // Type filter
    // -------------------------------------------------------------------------

    public function test_filter_type_shows_only_matching_items(): void
    {
        $user = $this->createViewUser();

        Item::factory()->Object()->create(['internal_name' => 'Object Item', 'parent_id' => null]);
        Item::factory()->create([
            'internal_name' => 'Monument Item',
            'parent_id' => null,
            'type' => ItemType::MONUMENT->value,
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseItemTree::class)
            ->set('filterType', 'object')
            ->assertSee('Object Item')
            ->assertDontSee('Monument Item');
    }

    public function test_filter_type_all_shows_all_items(): void
    {
        $user = $this->createViewUser();

        Item::factory()->Object()->create(['internal_name' => 'Object Item', 'parent_id' => null]);
        Item::factory()->create([
            'internal_name' => 'Monument Item',
            'parent_id' => null,
            'type' => ItemType::MONUMENT->value,
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseItemTree::class)
            ->set('filterType', 'all')
            ->assertSee('Object Item')
            ->assertSee('Monument Item');
    }

    public function test_filter_type_resets_page_to_first(): void
    {
        $user = $this->createViewUser();

        $this->seedRootItems(51);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseItemTree::class)
            ->call('nextPage')
            ->assertSet('page', 2)
            ->set('filterType', 'object')
            ->assertSet('page', 1);
    }

    // -------------------------------------------------------------------------
    // Project filter
    // -------------------------------------------------------------------------

    public function test_filter_project_with_shows_only_items_with_project(): void
    {
        $user = $this->createViewUser();

        $project = Project::factory()->create(['internal_name' => 'Test Project']);

        Item::factory()->Object()->create([
            'internal_name' => 'Item With Project',
            'parent_id' => null,
            'project_id' => $project->id,
        ]);
        Item::factory()->Object()->create([
            'internal_name' => 'Item Without Project',
            'parent_id' => null,
            'project_id' => null,
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseItemTree::class)
            ->set('filterProject', 'with')
            ->assertSee('Item With Project')
            ->assertDontSee('Item Without Project');
    }

    public function test_filter_project_without_shows_only_items_without_project(): void
    {
        $user = $this->createViewUser();

        $project = Project::factory()->create(['internal_name' => 'Test Project']);

        Item::factory()->Object()->create([
            'internal_name' => 'Item With Project',
            'parent_id' => null,
            'project_id' => $project->id,
        ]);
        Item::factory()->Object()->create([
            'internal_name' => 'Item Without Project',
            'parent_id' => null,
            'project_id' => null,
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseItemTree::class)
            ->set('filterProject', 'without')
            ->assertDontSee('Item With Project')
            ->assertSee('Item Without Project');
    }

    public function test_filter_project_resets_page_to_first(): void
    {
        $user = $this->createViewUser();

        $this->seedRootItems(51);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseItemTree::class)
            ->call('nextPage')
            ->assertSet('page', 2)
            ->set('filterProject', 'without')
            ->assertSet('page', 1);
    }

    // -------------------------------------------------------------------------
    // Country filter
    // -------------------------------------------------------------------------

    public function test_filter_country_with_shows_only_items_with_country(): void
    {
        $user = $this->createViewUser();

        $country = Country::factory()->create(['internal_name' => 'Egypt']);

        Item::factory()->Object()->create([
            'internal_name' => 'Item With Country',
            'parent_id' => null,
            'country_id' => $country->id,
        ]);
        Item::factory()->Object()->create([
            'internal_name' => 'Item Without Country',
            'parent_id' => null,
            'country_id' => null,
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseItemTree::class)
            ->set('filterCountry', 'with')
            ->assertSee('Item With Country')
            ->assertDontSee('Item Without Country');
    }

    public function test_filter_country_without_shows_only_items_without_country(): void
    {
        $user = $this->createViewUser();

        $country = Country::factory()->create(['internal_name' => 'Egypt']);

        Item::factory()->Object()->create([
            'internal_name' => 'Item With Country',
            'parent_id' => null,
            'country_id' => $country->id,
        ]);
        Item::factory()->Object()->create([
            'internal_name' => 'Item Without Country',
            'parent_id' => null,
            'country_id' => null,
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseItemTree::class)
            ->set('filterCountry', 'without')
            ->assertDontSee('Item With Country')
            ->assertSee('Item Without Country');
    }

    public function test_filter_country_resets_page_to_first(): void
    {
        $user = $this->createViewUser();

        $this->seedRootItems(51);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseItemTree::class)
            ->call('nextPage')
            ->assertSet('page', 2)
            ->set('filterCountry', 'without')
            ->assertSet('page', 1);
    }
}
