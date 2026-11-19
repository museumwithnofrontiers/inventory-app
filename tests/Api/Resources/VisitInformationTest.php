<?php

namespace Tests\Api\Resources;

use App\Models\Collection;
use App\Models\Context;
use App\Models\Item;
use App\Models\Language;
use App\Models\Partner;
use App\Models\VisitInformation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use InvalidArgumentException;
use Tests\Api\Traits\AuthenticatesApiRequests;
use Tests\Api\Traits\TestsApiCrud;
use Tests\TestCase;

/**
 * M16 D1 (#2645): visit information, owned by exactly one item, collection or
 * partner, per language and context, every text as written.
 */
class VisitInformationTest extends TestCase
{
    use AuthenticatesApiRequests;
    use RefreshDatabase;
    use TestsApiCrud;

    protected function getResourceName(): string
    {
        return 'visit-information';
    }

    protected function getModelClass(): string
    {
        return VisitInformation::class;
    }

    /**
     * The owner is set once, so an update never sends one.
     */
    public function test_can_update_resource(): void
    {
        $resource = VisitInformation::factory()->create();

        $this->putJson(route('visit-information.update', $resource), [
            'how_to_reach' => 'Bus 12 from the station, stop "Castle".',
            'phone' => '+39 06 123 45 67',
        ])->assertOk()
            ->assertJsonPath('data.id', $resource->id)
            ->assertJsonPath('data.how_to_reach', 'Bus 12 from the station, stop "Castle".')
            ->assertJsonPath('data.phone', '+39 06 123 45 67');
    }

    public function test_the_texts_are_kept_as_written(): void
    {
        $monument = Item::factory()->Monument()->create();
        $texts = [
            'how_to_reach' => 'From Amman, take the Desert Highway south for 90 km.',
            'opening_hours' => 'Daily 8.00-16.00',
            'contact' => 'Information: Visitor Centre, Tel: +962 3 215 6044',
            'address' => 'Wadi Musa, 71810',
            'institution' => 'Department of Antiquities',
            'practical_information' => 'Open daily. Entrance fee: 50 JD. Designated a National Monument in 1985.',
            'phone' => '+962 3 215 6044',
            'fax' => '+962 3 215 6045',
            'email' => 'info@example.org',
            'website' => 'https://example.org',
        ];

        $this->postJson(route('visit-information.store'), [
            'item_id' => $monument->id,
            'language_id' => Language::factory()->create()->id,
            'context_id' => Context::factory()->create()->id,
        ] + $texts)->assertCreated();

        $this->assertDatabaseHas('visit_information', ['item_id' => $monument->id] + $texts);
    }

    public function test_store_needs_exactly_one_owner(): void
    {
        $language = Language::factory()->create();
        $context = Context::factory()->create();

        $this->postJson(route('visit-information.store'), [
            'language_id' => $language->id,
            'context_id' => $context->id,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['item_id']);

        $this->postJson(route('visit-information.store'), [
            'item_id' => Item::factory()->Monument()->create()->id,
            'partner_id' => Partner::factory()->create()->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['item_id', 'partner_id']);

        $this->postJson(route('visit-information.store'), [
            'collection_id' => Collection::factory()->create()->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'how_to_reach' => 'Ferry from the old port.',
        ])->assertCreated()
            ->assertJsonPath('data.item_id', null)
            ->assertJsonPath('data.how_to_reach', 'Ferry from the old port.');
    }

    public function test_one_per_owner_language_and_context(): void
    {
        $existing = VisitInformation::factory()->create();

        $this->postJson(route('visit-information.store'), [
            'item_id' => $existing->item_id,
            'language_id' => $existing->language_id,
            'context_id' => $existing->context_id,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['language_id']);

        $this->postJson(route('visit-information.store'), [
            'item_id' => $existing->item_id,
            'language_id' => $existing->language_id,
            'context_id' => Context::factory()->create()->id,
        ])->assertCreated();
    }

    public function test_the_owner_cannot_change(): void
    {
        $visitInformation = VisitInformation::factory()->create();

        $this->patchJson(route('visit-information.update', $visitInformation), [
            'partner_id' => Partner::factory()->create()->id,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['partner_id']);
    }

    public function test_index_filters_by_owner_and_includes_it(): void
    {
        $partner = Partner::factory()->create();
        VisitInformation::factory()->forPartner($partner)->create();
        VisitInformation::factory()->create();

        $this->getJson(route('visit-information.index', ['partner_id' => $partner->id, 'include' => 'partner,language,context']))
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.partner.id', $partner->id);
    }

    public function test_the_model_refuses_no_owner_or_two(): void
    {
        $this->expectException(InvalidArgumentException::class);

        VisitInformation::factory()->create([
            'item_id' => Item::factory()->Monument()->create()->id,
            'partner_id' => Partner::factory()->create()->id,
        ]);
    }

    public function test_owners_reach_their_visit_information(): void
    {
        $monument = Item::factory()->Monument()->create();
        $collection = Collection::factory()->create();
        VisitInformation::factory()->forItem($monument)->create();
        VisitInformation::factory()->forCollection($collection)->create();

        $this->assertCount(1, $monument->visitInformation);
        $this->assertCount(1, $collection->visitInformation);
    }
}
