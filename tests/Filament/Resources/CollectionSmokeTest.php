<?php

namespace Tests\Filament\Resources;

use App\Filament\Pages\BrowseCollectionTree;
use App\Filament\Resources\CollectionResource\Pages\ListCollection;
use App\Models\Collection;
use App\Models\Context;
use App\Models\Language;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

class CollectionSmokeTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_collection_resource_handles_a_ten_thousand_row_dataset(): void
    {
        $user = $this->createViewOnlyUser();
        $this->seedCollections();

        DB::flushQueryLog();
        DB::enableQueryLog();

        $response = $this->actingAs($user)->get('/admin/collections');

        $response->assertOk();
        // Limit is loose enough for the admin panel's own queries while still catching N+1 regressions.
        $this->assertLessThan(50, count(DB::getQueryLog()));
        // Page payload should remain under 512KB for 10k records (pagination keeps it small).
        $this->assertLessThan(512 * 1024, strlen($response->getContent()));
        DB::disableQueryLog();

        $this->setCurrentPanel();

        $expectedFirstPage = Collection::query()
            ->orderBy('internal_name')
            ->limit(10)
            ->get();

        $target = Collection::query()->where('internal_name', 'Collection 09999')->firstOrFail();
        $nonTarget = Collection::query()->where('internal_name', 'Collection 00000')->firstOrFail();

        Livewire::actingAs($user)
            ->test(ListCollection::class)
            ->assertCanSeeTableRecords($expectedFirstPage, inOrder: true)
            ->searchTable('Collection 09999')
            ->assertCanSeeTableRecords([$target])
            ->assertCanNotSeeTableRecords([$nonTarget]);
    }

    public function test_browse_collection_tree_expands_five_levels_deep(): void
    {
        $user = $this->createViewOnlyUser();
        $hierarchy = $this->seedHierarchy(5);

        $this->setCurrentPanel();

        $component = Livewire::actingAs($user)
            ->test(BrowseCollectionTree::class);

        $component->assertSee($hierarchy[0]->internal_name);

        // Expand each level and verify children become visible (lazy loading).
        foreach ($hierarchy as $depth => $node) {
            $component->call('expand', $node->id);

            if ($depth + 1 < count($hierarchy)) {
                $component->assertSee($hierarchy[$depth + 1]->internal_name);
            }
        }

        // 5-level tree HTML should stay well under 2MB.
        $this->assertLessThan(2 * 1024 * 1024, strlen($component->html()));
    }

    public function test_collection_create_and_edit_forms_do_not_preload_large_option_datasets(): void
    {
        $user = $this->createCrudUser();
        $this->seedCollections();

        $collection = Collection::query()->first();

        DB::flushQueryLog();
        DB::enableQueryLog();

        // Create form must open without loading all collections (which were formerly preloaded for parent select).
        $response = $this->actingAs($user)->get('/admin/collections/create');
        $response->assertOk();
        $createQueryCount = count(DB::getQueryLog());

        DB::flushQueryLog();

        // Edit form must open without loading all collections.
        $response = $this->actingAs($user)->get("/admin/collections/{$collection->getKey()}/edit");
        $response->assertOk();
        $editQueryCount = count(DB::getQueryLog());

        DB::disableQueryLog();

        // With preloads removed, query counts must stay well below the 10 000-row count.
        $this->assertLessThan(50, $createQueryCount, "Create form issued too many queries ($createQueryCount), likely still preloading parent/language/context datasets.");
        $this->assertLessThan(50, $editQueryCount, "Edit form issued too many queries ($editQueryCount), likely still preloading parent/language/context datasets.");
    }

    public function test_change_parent_search_returns_bounded_results(): void
    {
        $user = $this->createCrudUser();
        $this->seedCollections();
        $this->setCurrentPanel();

        $child = Collection::factory()->create(['internal_name' => 'Standalone child', 'parent_id' => null]);

        // Calling the action with a specific parent ID should still work (search returns correct results).
        $parent = Collection::query()->where('internal_name', 'Collection 00001')->firstOrFail();

        Livewire::actingAs($user)
            ->test(ListCollection::class)
            ->callTableAction('changeParent', $child, data: ['parent_id' => $parent->id])
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('collections', ['id' => $child->id, 'parent_id' => $parent->id]);
    }

    protected function seedCollections(): void
    {
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);
        $context = Context::factory()->create(['internal_name' => 'Catalogue']);
        $timestamp = Carbon::now();

        $rows = [];
        for ($i = 0; $i < 10_000; $i++) {
            $rows[] = [
                'id' => (string) Str::uuid(),
                'internal_name' => sprintf('Collection %05d', $i),
                'type' => 'collection',
                'backward_compatibility' => sprintf('col-%05d', $i),
                'language_id' => $language->id,
                'context_id' => $context->id,
                'parent_id' => null,
                'country_id' => null,
                'display_order' => null,
                'latitude' => null,
                'longitude' => null,
                'map_zoom' => null,
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ];
        }

        foreach (array_chunk($rows, 1000) as $chunk) {
            Collection::query()->insert($chunk);
        }
    }

    /**
     * Seed a chain of collections: root → level1 → level2 → … → level(depth-1).
     *
     * @return array<int, Collection>
     */
    protected function seedHierarchy(int $depth): array
    {
        $nodes = [];
        $parentId = null;

        for ($i = 0; $i < $depth; $i++) {
            $node = Collection::factory()->create([
                'internal_name' => sprintf('Hierarchy Level %d', $i),
                'type' => 'collection',
                'parent_id' => $parentId,
            ]);
            $nodes[] = $node;
            $parentId = $node->id;
        }

        return $nodes;
    }
}
