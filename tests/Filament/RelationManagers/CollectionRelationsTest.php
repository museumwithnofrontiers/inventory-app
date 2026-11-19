<?php

namespace Tests\Filament\RelationManagers;

use App\Filament\Resources\CollectionResource\Pages\EditCollection;
use App\Filament\Resources\CollectionResource\Pages\ViewCollection;
use App\Filament\Resources\CollectionResource\RelationManagers\CountriesRelationManager;
use App\Filament\Resources\CollectionResource\RelationManagers\RelatedCollectionsRelationManager;
use App\Filament\Resources\PartnerResource\Pages\ViewPartner;
use App\Filament\Resources\PartnerResource\RelationManagers\LogosRelationManager;
use App\Models\Collection;
use App\Models\Context;
use App\Models\Country;
use App\Models\Item;
use App\Models\Language;
use App\Models\Partner;
use App\Models\PartnerLogo;
use Filament\Tables\Actions\DetachAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * M16 E3 (#2649): a collection's other countries, its links to other
 * collections, its cover picture and days, and a partner's logos, in the panel.
 */
class CollectionRelationsTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_crud_user_attaches_orders_and_detaches_a_country(): void
    {
        $collection = $this->makeCollection();
        $country = Country::factory()->create();
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CountriesRelationManager::class, ['ownerRecord' => $collection, 'pageClass' => ViewCollection::class])
            ->mountTableAction('attach')
            ->setTableActionData(['recordId' => $country->id, 'display_order' => 2])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('collection_country', [
            'collection_id' => $collection->id,
            'country_id' => $country->id,
            'display_order' => 2,
        ]);

        Livewire::actingAs($user)
            ->test(CountriesRelationManager::class, ['ownerRecord' => $collection, 'pageClass' => ViewCollection::class])
            ->callTableAction(DetachAction::class, $collection->countries()->first())
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('collection_country', ['collection_id' => $collection->id]);
        $this->assertModelExists($country);
    }

    public function test_crud_user_links_a_collection_by_kind(): void
    {
        $collection = $this->makeCollection();
        $location = $this->makeCollection();
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(RelatedCollectionsRelationManager::class, ['ownerRecord' => $collection, 'pageClass' => ViewCollection::class])
            ->mountTableAction('attach')
            ->setTableActionData(['recordId' => $location->id, 'kind' => 'location', 'display_order' => 1])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('collection_collection', [
            'collection_id' => $collection->id,
            'related_collection_id' => $location->id,
            'kind' => 'location',
            'display_order' => 1,
        ]);
        $this->assertSame([$collection->id], $location->relatingCollections()->pluck('collections.id')->all());
    }

    public function test_view_only_user_sees_no_relation_mutations(): void
    {
        $collection = $this->makeCollection();
        $user = $this->createViewOnlyUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CountriesRelationManager::class, ['ownerRecord' => $collection, 'pageClass' => ViewCollection::class])
            ->assertTableActionHidden('attach');
        Livewire::actingAs($user)
            ->test(RelatedCollectionsRelationManager::class, ['ownerRecord' => $collection, 'pageClass' => ViewCollection::class])
            ->assertTableActionHidden('attach');
    }

    public function test_the_collection_form_sets_the_cover_picture_and_days(): void
    {
        $collection = $this->makeCollection();
        $picture = Item::factory()->create();
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(EditCollection::class, ['record' => $collection->getRouteKey()])
            ->fillForm(['cover_item_id' => $picture->id, 'days' => 3])
            ->call('save')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('collections', [
            'id' => $collection->id,
            'cover_item_id' => $picture->id,
            'days' => 3,
        ]);
    }

    public function test_a_partner_lists_and_edits_its_logos(): void
    {
        $partner = Partner::factory()->create();
        $logo = PartnerLogo::factory()->create(['partner_id' => $partner->id, 'alt_text' => null]);
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(LogosRelationManager::class, ['ownerRecord' => $partner, 'pageClass' => ViewPartner::class])
            ->assertCanSeeTableRecords([$logo])
            ->assertTableActionDoesNotExist('attach')
            ->mountTableAction('edit', $logo)
            ->setTableActionData(['logo_type' => 'primary', 'alt_text' => 'The museum', 'display_order' => 1])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('partner_logos', ['id' => $logo->id, 'alt_text' => 'The museum']);
    }

    public function test_the_panel_serves_a_logo_only_under_its_partner(): void
    {
        $partner = Partner::factory()->create();
        $other = Partner::factory()->create();
        $logo = PartnerLogo::factory()->create(['partner_id' => $partner->id]);

        $this->actingAs($this->createCrudUser())
            ->get(route('filament.admin.partner-logo.view', ['partner' => $other->id, 'partnerLogo' => $logo->id]))
            ->assertNotFound();
    }

    private function makeCollection(): Collection
    {
        $context = Context::factory()->create();
        $language = Language::query()->find('eng') ?? Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);

        return Collection::factory()->collection()->create([
            'context_id' => $context->id,
            'language_id' => $language->id,
        ]);
    }
}
