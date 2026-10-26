<?php

namespace Tests\Api\Resources;

use App\Models\ItemTranslation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Api\Traits\AuthenticatesApiRequests;
use Tests\Api\Traits\TestsApiCrud;
use Tests\TestCase;

class ItemTranslationTest extends TestCase
{
    use AuthenticatesApiRequests;
    use RefreshDatabase;
    use TestsApiCrud;

    protected function getResourceName(): string
    {
        return 'item-translation';
    }

    protected function getModelClass(): string
    {
        return ItemTranslation::class;
    }

    /**
     * Override to exclude JSON fields that get double-encoded
     */
    public function test_can_create_resource(): void
    {
        $modelClass = $this->getModelClass();
        $data = $modelClass::factory()->make($this->getFactoryData())->toArray();

        // Remove id, timestamps, system-managed fields, and JSON fields
        $data = array_diff_key($data, array_flip(['id', 'created_at', 'updated_at', 'deleted_at', 'is_default', 'extra']));

        $response = $this->postJson(route($this->getResourceName().'.store'), $data);
        $response->assertCreated()
            ->assertJsonStructure(['data' => ['id']]);

        $this->assertDatabaseHas($modelClass::make()->getTable(),
            array_intersect_key($data, array_flip($modelClass::make()->getFillable()))
        );
    }

    /**
     * Override to exclude JSON fields that get double-encoded
     */
    public function test_can_update_resource(): void
    {
        $modelClass = $this->getModelClass();
        $resource = $modelClass::factory()->create($this->getFactoryData());
        $updateData = $modelClass::factory()->make($this->getFactoryData())->toArray();

        // Remove id, timestamps, system-managed fields, and JSON fields
        $updateData = array_diff_key($updateData, array_flip(['id', 'created_at', 'updated_at', 'deleted_at', 'is_default', 'extra']));

        $response = $this->putJson(route($this->getResourceName().'.update', $resource), $updateData);
        $response->assertOk()
            ->assertJsonPath('data.id', $resource->id);

        $this->assertDatabaseHas($modelClass::make()->getTable(),
            ['id' => $resource->id] + array_intersect_key($updateData, array_flip($modelClass::make()->getFillable()))
        );
    }

    /**
     * Legacy writes alternate names and types longer than 255 characters; both
     * are kept whole.
     */
    public function test_keeps_a_long_alternate_name_and_type_whole(): void
    {
        $resource = ItemTranslation::factory()->create();
        $long = rtrim(str_repeat('Wax statue of a man showing deep muscles; ', 10));

        $this->putJson(route('item-translation.update', $resource), [
            'alternate_name' => $long,
            'type' => $long,
        ])->assertOk();

        $resource->refresh();
        $this->assertSame($long, $resource->alternate_name);
        $this->assertSame($long, $resource->type);
    }
}
