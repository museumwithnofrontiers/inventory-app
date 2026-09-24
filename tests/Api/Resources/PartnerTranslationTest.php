<?php

namespace Tests\Api\Resources;

use App\Models\PartnerTranslation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Api\Traits\AuthenticatesApiRequests;
use Tests\Api\Traits\TestsApiCrud;
use Tests\TestCase;

class PartnerTranslationTest extends TestCase
{
    use AuthenticatesApiRequests;
    use RefreshDatabase;
    use TestsApiCrud;

    protected function getResourceName(): string
    {
        return 'partner-translation';
    }

    protected function getModelClass(): string
    {
        return PartnerTranslation::class;
    }

    /**
     * Override to handle JSON fields properly (extra, contact_phones, contact_emails are JSON in DB)
     */
    public function test_can_create_resource(): void
    {
        $modelClass = $this->getModelClass();
        $data = $modelClass::factory()->make($this->getFactoryData())->toArray();

        // Remove id, timestamps, system-managed fields, and JSON fields
        $data = array_diff_key($data, array_flip(['id', 'created_at', 'updated_at', 'deleted_at', 'is_default', 'extra', 'contact_phones', 'contact_emails']));

        $response = $this->postJson(route($this->getResourceName().'.store'), $data);
        $response->assertCreated()
            ->assertJsonStructure(['data' => ['id']]);

        $this->assertDatabaseHas($modelClass::make()->getTable(),
            array_intersect_key($data, array_flip($modelClass::make()->getFillable()))
        );
    }

    /**
     * Override to handle JSON fields properly (extra, contact_phones, contact_emails are JSON in DB)
     */
    public function test_can_update_resource(): void
    {
        $modelClass = $this->getModelClass();
        $resource = $modelClass::factory()->create($this->getFactoryData());
        $updateData = $modelClass::factory()->make($this->getFactoryData())->toArray();

        // Remove id, timestamps, system-managed fields, and JSON fields
        $updateData = array_diff_key($updateData, array_flip(['id', 'created_at', 'updated_at', 'deleted_at', 'is_default', 'extra', 'contact_phones', 'contact_emails']));

        $response = $this->putJson(route($this->getResourceName().'.update', $resource), $updateData);
        $response->assertOk()
            ->assertJsonPath('data.id', $resource->id);

        $this->assertDatabaseHas($modelClass::make()->getTable(),
            ['id' => $resource->id] + array_intersect_key($updateData, array_flip($modelClass::make()->getFillable()))
        );
    }

    public function test_the_partner_fax_is_returned_next_to_its_phone(): void
    {
        $translation = PartnerTranslation::factory()->create([
            'contact_phone' => '+34 91 577 79 12',
            'contact_fax' => '+34 91 431 68 40',
        ]);

        $this->getJson(route($this->getResourceName().'.show', $translation))
            ->assertOk()
            ->assertJsonPath('data.contact_phone', '+34 91 577 79 12')
            ->assertJsonPath('data.contact_fax', '+34 91 431 68 40');
    }

    public function test_a_fax_longer_than_a_phone_number_is_rejected(): void
    {
        $data = PartnerTranslation::factory()->make()->toArray();
        $data = array_diff_key($data, array_flip(['id', 'created_at', 'updated_at', 'deleted_at', 'is_default', 'extra', 'contact_phones', 'contact_emails']));

        $this->postJson(route($this->getResourceName().'.store'), ['contact_fax' => str_repeat('9', 51)] + $data)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('contact_fax');
    }
}
