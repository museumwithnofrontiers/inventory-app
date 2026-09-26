<?php

namespace Tests\Filament\Pages;

use App\Enums\Permission;
use App\Filament\Pages\BrowseItemTree;
use App\Filament\Pages\BrowseTimelineTree;
use App\Filament\Resources\TimelineEventResource;
use App\Filament\Resources\TimelineResource;
use App\Models\Collection;
use App\Models\Context;
use App\Models\Country;
use App\Models\Language;
use App\Models\Timeline;
use App\Models\TimelineEvent;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

class BrowseTimelineTreePageTest extends TestCase
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

    // -------------------------------------------------------------------------
    // Basic rendering
    // -------------------------------------------------------------------------

    public function test_page_renders_for_authorised_user(): void
    {
        $user = $this->createViewUser();

        // Create a timeline with events so it passes the default 'with' filter.
        $timeline = Timeline::factory()->create(['internal_name' => 'Test Timeline', 'country_id' => null]);
        TimelineEvent::factory()->create(['timeline_id' => $timeline->id]);

        $this->actingAs($user)->get('/admin/browse-timeline-tree')->assertOk();
    }

    public function test_page_is_inaccessible_without_view_data_permission(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo([Permission::ACCESS_ADMIN_PANEL->value]);

        $this->actingAs($user)->get('/admin/browse-timeline-tree')->assertForbidden();
    }

    // -------------------------------------------------------------------------
    // Default filter: filterChildEvents defaults to 'with'
    // -------------------------------------------------------------------------

    public function test_default_filter_child_events_is_with(): void
    {
        $user = $this->createViewUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseTimelineTree::class)
            ->assertSet('filterChildEvents', 'with');
    }

    public function test_timelines_without_events_are_hidden_by_default(): void
    {
        $user = $this->createViewUser();

        Timeline::factory()->create(['internal_name' => 'Empty Timeline', 'country_id' => null, 'collection_id' => null]);

        $timeline = Timeline::factory()->create(['internal_name' => 'Timeline With Events', 'country_id' => null]);
        TimelineEvent::factory()->create(['timeline_id' => $timeline->id]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseTimelineTree::class)
            ->assertDontSee('Empty Timeline')
            ->assertSee('Timeline With Events');
    }

    public function test_filter_child_events_all_shows_timelines_without_events(): void
    {
        $user = $this->createViewUser();

        Timeline::factory()->create(['internal_name' => 'Empty Timeline', 'country_id' => null, 'collection_id' => null]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseTimelineTree::class)
            ->set('filterChildEvents', 'all')
            ->assertSee('Empty Timeline');
    }

    public function test_filter_child_events_without_shows_only_timelines_without_events(): void
    {
        $user = $this->createViewUser();

        Timeline::factory()->create(['internal_name' => 'Empty Timeline', 'country_id' => null, 'collection_id' => null]);

        $timeline = Timeline::factory()->create(['internal_name' => 'Timeline With Events', 'country_id' => null]);
        TimelineEvent::factory()->create(['timeline_id' => $timeline->id]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseTimelineTree::class)
            ->set('filterChildEvents', 'without')
            ->assertSee('Empty Timeline')
            ->assertDontSee('Timeline With Events');
    }

    public function test_filter_child_events_resets_page_to_first(): void
    {
        $user = $this->createViewUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseTimelineTree::class)
            ->assertSet('page', 1)
            ->set('filterChildEvents', 'all')
            ->assertSet('page', 1)
            ->set('filterChildEvents', 'with')
            ->assertSet('page', 1);
    }

    // -------------------------------------------------------------------------
    // Country filter
    // -------------------------------------------------------------------------

    public function test_filter_country_with_shows_only_timelines_with_country(): void
    {
        $user = $this->createViewUser();

        $country = Country::factory()->create(['internal_name' => 'Egypt']);

        $withCountry = Timeline::factory()->create([
            'internal_name' => 'Timeline With Country',
            'country_id' => $country->id,
        ]);
        TimelineEvent::factory()->create(['timeline_id' => $withCountry->id]);

        $withoutCountry = Timeline::factory()->create([
            'internal_name' => 'Timeline Without Country',
            'country_id' => null,
        ]);
        TimelineEvent::factory()->create(['timeline_id' => $withoutCountry->id]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseTimelineTree::class)
            ->set('filterCountry', 'with')
            ->assertSee('Timeline With Country')
            ->assertDontSee('Timeline Without Country');
    }

    public function test_filter_country_without_shows_only_timelines_without_country(): void
    {
        $user = $this->createViewUser();

        $country = Country::factory()->create(['internal_name' => 'Egypt']);

        $withCountry = Timeline::factory()->create([
            'internal_name' => 'Timeline With Country',
            'country_id' => $country->id,
        ]);
        TimelineEvent::factory()->create(['timeline_id' => $withCountry->id]);

        $withoutCountry = Timeline::factory()->create([
            'internal_name' => 'Timeline Without Country',
            'country_id' => null,
        ]);
        TimelineEvent::factory()->create(['timeline_id' => $withoutCountry->id]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseTimelineTree::class)
            ->set('filterCountry', 'without')
            ->assertDontSee('Timeline With Country')
            ->assertSee('Timeline Without Country');
    }

    public function test_filter_country_resets_page_to_first(): void
    {
        $user = $this->createViewUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseTimelineTree::class)
            ->assertSet('page', 1)
            ->set('filterCountry', 'with')
            ->assertSet('page', 1);
    }

    // -------------------------------------------------------------------------
    // Collection filter
    // -------------------------------------------------------------------------

    public function test_filter_collection_with_shows_only_timelines_with_collection(): void
    {
        $user = $this->createViewUser();

        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);
        $collection = Collection::factory()->withLanguage($language->id)->withContext($context->id)->create([
            'internal_name' => 'Test Collection',
            'parent_id' => null,
        ]);

        $withCollection = Timeline::factory()->create([
            'internal_name' => 'Timeline With Collection',
            'country_id' => null,
            'collection_id' => $collection->id,
        ]);
        TimelineEvent::factory()->create(['timeline_id' => $withCollection->id]);

        $withoutCollection = Timeline::factory()->create([
            'internal_name' => 'Timeline Without Collection',
            'country_id' => null,
            'collection_id' => null,
        ]);
        TimelineEvent::factory()->create(['timeline_id' => $withoutCollection->id]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseTimelineTree::class)
            ->set('filterCollection', 'with')
            ->assertSee('Timeline With Collection')
            ->assertDontSee('Timeline Without Collection');
    }

    public function test_filter_collection_without_shows_only_timelines_without_collection(): void
    {
        $user = $this->createViewUser();

        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);
        $collection = Collection::factory()->withLanguage($language->id)->withContext($context->id)->create([
            'internal_name' => 'Test Collection',
            'parent_id' => null,
        ]);

        $withCollection = Timeline::factory()->create([
            'internal_name' => 'Timeline With Collection',
            'country_id' => null,
            'collection_id' => $collection->id,
        ]);
        TimelineEvent::factory()->create(['timeline_id' => $withCollection->id]);

        $withoutCollection = Timeline::factory()->create([
            'internal_name' => 'Timeline Without Collection',
            'country_id' => null,
            'collection_id' => null,
        ]);
        TimelineEvent::factory()->create(['timeline_id' => $withoutCollection->id]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseTimelineTree::class)
            ->set('filterCollection', 'without')
            ->assertDontSee('Timeline With Collection')
            ->assertSee('Timeline Without Collection');
    }

    // -------------------------------------------------------------------------
    // Search
    // -------------------------------------------------------------------------

    public function test_search_filters_by_internal_name(): void
    {
        $user = $this->createViewUser();

        $alpha = Timeline::factory()->create(['internal_name' => 'alpha-timeline', 'country_id' => null]);
        TimelineEvent::factory()->create(['timeline_id' => $alpha->id]);

        $beta = Timeline::factory()->create(['internal_name' => 'beta-timeline', 'country_id' => null]);
        TimelineEvent::factory()->create(['timeline_id' => $beta->id]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseTimelineTree::class)
            ->set('search', 'alpha')
            ->assertSee('alpha-timeline')
            ->assertDontSee('beta-timeline');
    }

    public function test_search_filters_by_backward_compatibility(): void
    {
        $user = $this->createViewUser();

        $alpha = Timeline::factory()->create([
            'internal_name' => 'alpha-timeline',
            'backward_compatibility' => 'leg-alpha',
            'country_id' => null,
        ]);
        TimelineEvent::factory()->create(['timeline_id' => $alpha->id]);

        $beta = Timeline::factory()->create([
            'internal_name' => 'beta-timeline',
            'backward_compatibility' => 'leg-beta',
            'country_id' => null,
        ]);
        TimelineEvent::factory()->create(['timeline_id' => $beta->id]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseTimelineTree::class)
            ->set('search', 'leg-alpha')
            ->assertSee('alpha-timeline')
            ->assertDontSee('beta-timeline');
    }

    public function test_search_filters_by_id(): void
    {
        $user = $this->createViewUser();

        $timeline = Timeline::factory()->create(['internal_name' => 'unique-timeline', 'country_id' => null]);
        TimelineEvent::factory()->create(['timeline_id' => $timeline->id]);

        $other = Timeline::factory()->create(['internal_name' => 'other-timeline', 'country_id' => null]);
        TimelineEvent::factory()->create(['timeline_id' => $other->id]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseTimelineTree::class)
            ->set('search', $timeline->id)
            ->assertSee('unique-timeline')
            ->assertDontSee('other-timeline');
    }

    public function test_search_resets_page_to_first(): void
    {
        $user = $this->createViewUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseTimelineTree::class)
            ->assertSet('page', 1)
            ->set('search', 'something')
            ->assertSet('page', 1);
    }

    // -------------------------------------------------------------------------
    // Tree expand / collapse
    // -------------------------------------------------------------------------

    public function test_expanding_timeline_reveals_events(): void
    {
        $user = $this->createViewUser();

        $timeline = Timeline::factory()->create(['internal_name' => 'Islamic Timeline', 'country_id' => null]);
        $event = TimelineEvent::factory()->create([
            'timeline_id' => $timeline->id,
            'internal_name' => 'Umayyad Period',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseTimelineTree::class)
            ->assertDontSee('Umayyad Period')
            ->call('expand', $timeline->id)
            ->assertSee('Umayyad Period');
    }

    public function test_collapsing_timeline_hides_events(): void
    {
        $user = $this->createViewUser();

        $timeline = Timeline::factory()->create(['internal_name' => 'Islamic Timeline', 'country_id' => null]);
        TimelineEvent::factory()->create([
            'timeline_id' => $timeline->id,
            'internal_name' => 'Umayyad Period',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseTimelineTree::class)
            ->call('expand', $timeline->id)
            ->assertSee('Umayyad Period')
            ->call('collapse', $timeline->id)
            ->assertDontSee('Umayyad Period');
    }

    // -------------------------------------------------------------------------
    // Node links
    // -------------------------------------------------------------------------

    public function test_timeline_node_links_to_timeline_resource_view(): void
    {
        $user = $this->createViewUser();

        $timeline = Timeline::factory()->create(['internal_name' => 'Linked Timeline', 'country_id' => null]);
        TimelineEvent::factory()->create(['timeline_id' => $timeline->id]);

        $this->setCurrentPanel();

        $viewUrl = TimelineResource::getUrl('view', ['record' => $timeline->getKey()]);

        Livewire::actingAs($user)
            ->test(BrowseTimelineTree::class)
            ->assertSee($viewUrl, false);
    }

    public function test_event_node_links_to_timeline_event_resource_view(): void
    {
        $user = $this->createViewUser();

        $timeline = Timeline::factory()->create(['internal_name' => 'Event Host Timeline', 'country_id' => null]);
        $event = TimelineEvent::factory()->create([
            'timeline_id' => $timeline->id,
            'internal_name' => 'Linked Event',
        ]);

        $this->setCurrentPanel();

        $eventViewUrl = TimelineEventResource::getUrl('view', ['record' => $event->getKey()]);

        Livewire::actingAs($user)
            ->test(BrowseTimelineTree::class)
            ->call('expand', $timeline->id)
            ->assertSee($eventViewUrl, false);
    }

    // -------------------------------------------------------------------------
    // Count messaging
    // -------------------------------------------------------------------------

    public function test_timeline_count_messaging_is_shown(): void
    {
        $user = $this->createViewUser();

        $timeline = Timeline::factory()->create(['internal_name' => 'Test Timeline', 'country_id' => null]);
        TimelineEvent::factory()->create(['timeline_id' => $timeline->id]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseTimelineTree::class)
            ->assertSee('1 timeline');
    }

    public function test_event_count_is_shown_on_timeline_node(): void
    {
        $user = $this->createViewUser();

        $timeline = Timeline::factory()->create(['internal_name' => 'Multi-Event Timeline', 'country_id' => null]);
        TimelineEvent::factory()->count(3)->create(['timeline_id' => $timeline->id]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseTimelineTree::class)
            ->assertSee('3 events');
    }

    // -------------------------------------------------------------------------
    // Navigation registration
    // -------------------------------------------------------------------------

    public function test_page_registers_navigation_in_inventory_group(): void
    {
        $this->assertEquals('Inventory', BrowseTimelineTree::getNavigationGroup());
    }

    public function test_page_navigation_sort_is_between_timelines_and_browse_item_tree(): void
    {
        $this->assertGreaterThan(
            TimelineEventResource::getNavigationSort(),
            BrowseTimelineTree::getNavigationSort(),
            'BrowseTimelineTree must appear after TimelineEventResource in navigation.'
        );

        $this->assertLessThan(
            BrowseItemTree::getNavigationSort(),
            BrowseTimelineTree::getNavigationSort(),
            'BrowseTimelineTree must appear before BrowseItemTree in navigation.'
        );
    }
}
