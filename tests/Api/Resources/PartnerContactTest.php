<?php

namespace Tests\Api\Resources;

use App\Enums\PartnerCategory;
use App\Models\Partner;
use App\Models\PartnerContact;
use App\Models\PartnerTranslation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Api\Traits\AuthenticatesApiRequests;
use Tests\Api\Traits\TestsApiCrud;
use Tests\TestCase;

/**
 * M16 D2 (#2646): a partner's contact persons, and the partner's category,
 * featured flag, city and other name.
 */
class PartnerContactTest extends TestCase
{
    use AuthenticatesApiRequests;
    use RefreshDatabase;
    use TestsApiCrud;

    protected function getResourceName(): string
    {
        return 'partner-contact';
    }

    protected function getModelClass(): string
    {
        return PartnerContact::class;
    }

    /**
     * A contact stays with its partner, so an update never sends one.
     */
    public function test_can_update_resource(): void
    {
        $contact = PartnerContact::factory()->create();

        $this->putJson(route('partner-contact.update', $contact), [
            'name' => 'Dr. Leila Haddad',
            'email' => 'one@example.org; two@example.org',
        ])->assertOk()
            ->assertJsonPath('data.id', $contact->id)
            ->assertJsonPath('data.email', 'one@example.org; two@example.org');
    }

    public function test_the_fields_are_kept_as_written(): void
    {
        $partner = Partner::factory()->create();
        $fields = [
            'name' => 'Mohamed Ben Ali',
            'title' => 'Curator, Department of Islamic Art',
            'email' => 'a@example.org, b@example.org',
            'phone' => '+216 71 000 000',
            'fax' => 'fax@example.org',
        ];

        $this->postJson(route('partner-contact.store'), ['partner_id' => $partner->id, 'display_order' => 2] + $fields)
            ->assertCreated()
            ->assertJsonPath('data.display_order', 2);

        $this->assertDatabaseHas('partner_contacts', ['partner_id' => $partner->id, 'display_order' => 2] + $fields);
    }

    public function test_one_contact_per_partner_position(): void
    {
        $contact = PartnerContact::factory()->create(['display_order' => 1]);

        $this->postJson(route('partner-contact.store'), [
            'partner_id' => $contact->partner_id,
            'display_order' => 1,
            'name' => 'Another',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['display_order']);
    }

    public function test_the_partner_cannot_change(): void
    {
        $contact = PartnerContact::factory()->create();

        $this->patchJson(route('partner-contact.update', $contact), ['partner_id' => Partner::factory()->create()->id])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['partner_id']);
    }

    public function test_a_partner_lists_its_contacts_in_order(): void
    {
        $partner = Partner::factory()->create();
        PartnerContact::factory()->forPartner($partner, 2)->create(['name' => 'Second']);
        PartnerContact::factory()->forPartner($partner, 1)->create(['name' => 'First']);

        $this->assertSame(['First', 'Second'], $partner->contacts->pluck('name')->all());
    }

    public function test_the_partner_takes_its_category_featured_flag_and_city(): void
    {
        $partner = Partner::factory()->create();

        $this->patchJson(route('partner.update', $partner), [
            'internal_name' => $partner->internal_name,
            'type' => $partner->type,
            'category' => 'culturalheritageauthorities',
            'featured' => true,
            'city' => 'Roma',
        ])->assertOk()
            ->assertJsonPath('data.category', 'culturalheritageauthorities')
            ->assertJsonPath('data.featured', true)
            ->assertJsonPath('data.city', 'Roma');

        $this->assertSame(PartnerCategory::CULTURAL_HERITAGE_AUTHORITIES, $partner->fresh()?->category);

        $this->patchJson(route('partner.update', $partner), [
            'internal_name' => $partner->internal_name,
            'type' => $partner->type,
            'category' => 'shops',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['category']);
    }

    public function test_a_partner_translation_keeps_its_other_name(): void
    {
        $translation = PartnerTranslation::factory()->create();

        $this->patchJson(route('partner-translation.update', $translation), [
            'partner_id' => $translation->partner_id,
            'language_id' => $translation->language_id,
            'context_id' => $translation->context_id,
            'name' => $translation->name,
            'also_known_as' => 'Museo di Palazzo Venezia (formerly)',
        ])->assertOk()
            ->assertJsonPath('data.also_known_as', 'Museo di Palazzo Venezia (formerly)');
    }
}
