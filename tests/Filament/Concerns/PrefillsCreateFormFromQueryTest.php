<?php

namespace Tests\Filament\Concerns;

use App\Filament\Resources\CollectionResource\Pages\CreateCollection;
use App\Filament\Resources\CollectionTranslationResource\Pages\CreateCollectionTranslation;
use App\Filament\Resources\ItemResource\Pages\CreateItem;
use App\Filament\Resources\ItemTranslationResource\Pages\CreateItemTranslation;
use App\Filament\Resources\PartnerTranslationResource\Pages\CreatePartnerTranslation;
use App\Models\Collection;
use App\Models\Item;
use App\Models\Partner;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Livewire\Livewire;
use Tests\TestCase;

/**
 * M7 story A0.3: PrefillsCreateFormFromQuery, applied to the five Create
 * pages that accept a whitelisted query-string prefill.
 *
 * Each page is exercised once for its own happy path (the query value shows
 * up in the filled form), and CreateItem — the only page with two whitelisted
 * keys, one Model-backed and one enum-backed — carries the shared edge
 * cases: no query at all, an unknown id, a non-viewable id, and an invalid
 * enum value. Those code paths are identical across pages (the trait is the
 * same), so re-running all four elsewhere would only re-test the trait, not
 * the page wiring.
 */
class PrefillsCreateFormFromQueryTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    // ── CreateItem: parent_id (Item) + type (ItemType enum) ─────────────────

    public function test_create_item_prefills_parent_and_type_from_query(): void
    {
        $parent = Item::factory()->Object()->create();
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->withQueryParams(['parent_id' => $parent->id, 'type' => 'picture'])
            ->test(CreateItem::class)
            ->assertFormSet([
                'parent_id' => $parent->id,
                'type' => 'picture',
            ]);
    }

    public function test_create_item_form_is_clean_without_query_params(): void
    {
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CreateItem::class)
            ->assertFormSet([
                'parent_id' => null,
                'type' => null,
            ]);
    }

    public function test_create_item_falls_back_to_clean_form_for_unknown_parent_id(): void
    {
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->withQueryParams(['parent_id' => (string) Str::uuid(), 'type' => 'picture'])
            ->test(CreateItem::class)
            ->assertFormSet([
                'parent_id' => null,
                'type' => 'picture',
            ]);
    }

    /**
     * ItemPolicy::view() mirrors viewAny() (VIEW_DATA), and the create page
     * itself requires viewAny(), so no permission set opens the page while
     * failing `view` on one Item. A gate hook that denies only `view` on this
     * record stands in for that case; every other ability still goes through
     * the real ItemPolicy.
     */
    public function test_create_item_falls_back_to_clean_form_for_non_viewable_parent(): void
    {
        $parent = Item::factory()->Object()->create();
        Gate::before(fn (User $user, string $ability, array $arguments) => $ability === 'view' && ($arguments[0] ?? null) instanceof Item && $arguments[0]->is($parent) ? false : null);

        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->withQueryParams(['parent_id' => $parent->id])
            ->test(CreateItem::class)
            ->assertFormSet([
                'parent_id' => null,
            ]);
    }

    public function test_create_item_ignores_invalid_type_value(): void
    {
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->withQueryParams(['type' => 'not-a-real-type'])
            ->test(CreateItem::class)
            ->assertFormSet([
                'type' => null,
            ]);
    }

    // ── CreateCollection: parent_id (Collection) ────────────────────────────

    public function test_create_collection_prefills_parent_from_query(): void
    {
        $parent = Collection::factory()->create();
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->withQueryParams(['parent_id' => $parent->id])
            ->test(CreateCollection::class)
            ->assertFormSet(['parent_id' => $parent->id]);
    }

    // ── CreateItemTranslation: item_id (Item) ───────────────────────────────

    public function test_create_item_translation_prefills_item_from_query(): void
    {
        $item = Item::factory()->Object()->create();
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->withQueryParams(['item_id' => $item->id])
            ->test(CreateItemTranslation::class)
            ->assertFormSet(['item_id' => $item->id]);
    }

    // ── CreateCollectionTranslation: collection_id (Collection) ─────────────

    public function test_create_collection_translation_prefills_collection_from_query(): void
    {
        $collection = Collection::factory()->create();
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->withQueryParams(['collection_id' => $collection->id])
            ->test(CreateCollectionTranslation::class)
            ->assertFormSet(['collection_id' => $collection->id]);
    }

    // ── CreatePartnerTranslation: partner_id (Partner) ──────────────────────

    public function test_create_partner_translation_prefills_partner_from_query(): void
    {
        $partner = Partner::factory()->create();
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->withQueryParams(['partner_id' => $partner->id])
            ->test(CreatePartnerTranslation::class)
            ->assertFormSet(['partner_id' => $partner->id]);
    }
}
