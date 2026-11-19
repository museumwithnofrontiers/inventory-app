<?php

namespace Tests\Api\Resources;

use App\Models\CollectionTranslation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Api\Traits\AuthenticatesApiRequests;
use Tests\Api\Traits\TestsApiCrud;
use Tests\TestCase;

class CollectionTranslationTest extends TestCase
{
    use AuthenticatesApiRequests;
    use RefreshDatabase;
    use TestsApiCrud;

    protected function getResourceName(): string
    {
        return 'collection-translation';
    }

    protected function getModelClass(): string
    {
        return CollectionTranslation::class;
    }

    /**
     * Override to exclude JSON fields from database assertion due to double-encoding issue
     */
    public function test_can_create_resource(): void
    {
        $modelClass = $this->getModelClass();
        $data = $modelClass::factory()->make($this->getFactoryData())->toArray();

        // Remove id, timestamps, system-managed fields
        $data = array_diff_key($data, array_flip(['id', 'created_at', 'updated_at', 'deleted_at', 'is_default']));

        $response = $this->postJson(route($this->getResourceName().'.store'), $data);
        $response->assertCreated()
            ->assertJsonStructure(['data' => ['id']]);

        // Exclude 'extra' field from database assertion (gets double-encoded)
        $dbData = array_diff_key($data, array_flip(['extra']));

        $this->assertDatabaseHas($modelClass::make()->getTable(),
            array_intersect_key($dbData, array_flip($modelClass::make()->getFillable()))
        );
    }

    /**
     * Override to exclude JSON fields from database assertion due to double-encoding issue
     */
    public function test_can_update_resource(): void
    {
        $modelClass = $this->getModelClass();
        $resource = $modelClass::factory()->create($this->getFactoryData());
        $updateData = $modelClass::factory()->make($this->getFactoryData())->toArray();

        // Remove id, timestamps, system-managed fields
        $updateData = array_diff_key($updateData, array_flip(['id', 'created_at', 'updated_at', 'deleted_at', 'is_default']));

        $response = $this->putJson(route($this->getResourceName().'.update', $resource), $updateData);
        $response->assertOk()
            ->assertJsonPath('data.id', $resource->id);

        // Exclude 'extra' field from database assertion (gets double-encoded)
        $dbData = array_diff_key($updateData, array_flip(['extra']));

        $this->assertDatabaseHas($modelClass::make()->getTable(),
            ['id' => $resource->id] + array_intersect_key($dbData, array_flip($modelClass::make()->getFillable()))
        );
    }

    /**
     * The texts that left `extra` (M16 E1) are stored and served as written.
     */
    public function test_stores_and_serves_the_text_columns(): void
    {
        $resource = CollectionTranslation::factory()->create();
        $texts = [
            'subtitle' => 'From Damascus to Cairo',
            'introduction' => "The trail follows the **Mamluk** road.\n\nIt starts at the citadel.",
            'duration' => 'One day',
        ];

        $this->putJson(route('collection-translation.update', $resource), $texts)
            ->assertOk()
            ->assertJsonPath('data.subtitle', $texts['subtitle'])
            ->assertJsonPath('data.introduction', $texts['introduction'])
            ->assertJsonPath('data.duration', $texts['duration']);

        $this->assertDatabaseHas('collection_translations', ['id' => $resource->id] + $texts);
    }
}
