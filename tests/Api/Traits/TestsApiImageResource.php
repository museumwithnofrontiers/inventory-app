<?php

namespace Tests\Api\Traits;

use Illuminate\Support\Facades\Storage;

/**
 * Tests for Image Resource Operations (ItemImage, CollectionImage, PartnerImage, etc.)
 *
 * NOT for AvailableImage (which is read-only and created by queue jobs)
 *
 * Provides tests for:
 * - Image CRUD (with proper nested/direct route handling)
 * - Display order management (move up/down, tighten ordering)
 */
trait TestsApiImageResource
{
    abstract protected function getResourceName(): string;

    abstract protected function getModelClass(): string;

    // ========== CRUD Tests ==========

    public function test_can_list_images(): void
    {
        $modelClass = $this->getModelClass();

        // Create parent if needed for nested routes
        $parent = $this->getParentModel();

        if ($parent && $this->usesNestedRoutes()) {
            // Create images for the parent (ItemImage, CollectionImage)
            $modelClass::factory()->for($parent, $this->getParentRelation())->count(3)->create();

            $response = $this->getJson($this->getIndexRoute($parent));
        } else {
            // Direct route (PartnerImage, PartnerTranslationImage)
            $modelClass::factory()->count(3)->create($this->getFactoryData());

            $response = $this->getJson(route($this->getResourceName().'.index'));
        }

        $response->assertOk()
            ->assertJsonCount(3, 'data');
    }

    public function test_index_returns_empty_when_no_images(): void
    {
        $parent = $this->getParentModel();

        if ($parent && $this->usesNestedRoutes()) {
            $response = $this->getJson($this->getIndexRoute($parent));
        } else {
            $response = $this->getJson(route($this->getResourceName().'.index'));
        }

        $response->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_can_show_single_image(): void
    {
        $modelClass = $this->getModelClass();
        $image = $modelClass::factory()->create($this->getFactoryData());

        $response = $this->getJson(route($this->getResourceName().'.show', $image));

        $response->assertOk()
            ->assertJsonPath('data.id', $image->id);
    }

    public function test_show_returns_404_for_nonexistent_image(): void
    {
        $response = $this->getJson(route($this->getResourceName().'.show', 'nonexistent-uuid'));

        $response->assertNotFound();
    }

    public function test_can_create_image(): void
    {
        if (! $this->supportsCreate()) {
            $this->markTestSkipped('Resource does not support create');
        }

        $modelClass = $this->getModelClass();
        $parent = $this->getParentModel();

        $data = $modelClass::factory()->make($this->getFactoryData())->toArray();

        // Remove auto-generated and prohibited fields
        $data = array_diff_key($data, array_flip([
            'id', 'created_at', 'updated_at', 'deleted_at',
        ]));

        if ($parent && $this->usesNestedRoutes()) {
            // For nested routes, remove parent_id from data (it's in the URL)
            $parentIdField = $this->getParentRelation().'_id';
            unset($data[$parentIdField]);

            $response = $this->postJson($this->getStoreRoute($parent), $data);
        } else {
            // For direct routes (PartnerImage), keep parent_id in data
            $response = $this->postJson(route($this->getResourceName().'.store'), $data);
        }

        $response->assertCreated()
            ->assertJsonStructure(['data' => ['id']]);
    }

    public function test_can_update_image(): void
    {
        $modelClass = $this->getModelClass();
        $image = $modelClass::factory()->create($this->getFactoryData());

        // Use the original image data as base for update
        $updateData = $image->toArray();

        // Remove read-only fields
        unset($updateData['id'], $updateData['created_at'], $updateData['updated_at'], $updateData['deleted_at']);

        // Modify only the fields we want to test
        $updateData['alt_text'] = 'Updated alt text';

        if ($this->hasColumn('display_order')) {
            $updateData['display_order'] = 99;
        }

        $response = $this->patchJson(route($this->getResourceName().'.update', $image), $updateData);

        $response->assertOk()
            ->assertJsonPath('data.id', $image->id);

        if (isset($updateData['alt_text'])) {
            $response->assertJsonPath('data.alt_text', 'Updated alt text');
        }
    }

    public function test_update_returns_404_for_nonexistent_image(): void
    {
        $response = $this->patchJson(route($this->getResourceName().'.update', 'nonexistent-uuid'), [
            'alt_text' => 'Updated',
        ]);

        $response->assertNotFound();
    }

    public function test_can_delete_image(): void
    {
        Storage::fake('public');
        Storage::fake('image-originals');

        $modelClass = $this->getModelClass();
        $image = $modelClass::factory()->create(array_merge($this->getFactoryData(), ['path' => 'destroy-me.jpg']));

        $picturesDir = trim(config('localstorage.pictures.directory'), '/');
        Storage::disk(config('localstorage.pictures.disk'))->put($picturesDir.'/destroy-me.jpg', 'fake-data');

        $originalsDir = trim(config('localstorage.available.images.directory'), '/');
        Storage::disk(config('localstorage.available.images.disk'))->put($originalsDir.'/destroy-me.jpg', 'fake-data');

        $response = $this->deleteJson(route($this->getResourceName().'.destroy', $image));

        $response->assertNoContent();
        $this->assertDatabaseMissing($modelClass::make()->getTable(), ['id' => $image->id]);

        // destroy() has no explicit cleanup code of its own - this proves the
        // model-level DeletesImageFilesOnDelete trait covers this entry point too.
        Storage::disk(config('localstorage.pictures.disk'))->assertMissing($picturesDir.'/destroy-me.jpg');
        Storage::disk(config('localstorage.available.images.disk'))->assertMissing($originalsDir.'/destroy-me.jpg');
    }

    public function test_destroy_returns_404_for_nonexistent_image(): void
    {
        $response = $this->deleteJson(route($this->getResourceName().'.destroy', 'nonexistent-uuid'));

        $response->assertNotFound();
    }

    // ========== Ordering Tests ==========

    public function test_can_move_image_up(): void
    {
        if (! $this->supportsOrdering()) {
            $this->markTestSkipped('Resource does not support ordering');
        }

        $modelClass = $this->getModelClass();
        $parentModel = $this->getParentModel();

        $baseData = $this->getFactoryData();

        $image1 = $modelClass::factory()->for($parentModel, $this->getParentRelation())->withOrder(1)->create($baseData);
        $image2 = $modelClass::factory()->for($parentModel, $this->getParentRelation())->withOrder(2)->create($baseData);
        $image3 = $modelClass::factory()->for($parentModel, $this->getParentRelation())->withOrder(3)->create($baseData);

        $response = $this->patchJson(route($this->getResourceName().'.moveUp', $image3));

        $response->assertOk();

        $image2->refresh();
        $image3->refresh();

        $this->assertEquals(3, $image2->display_order);
        $this->assertEquals(2, $image3->display_order);
    }

    public function test_move_up_at_top_has_no_effect(): void
    {
        if (! $this->supportsOrdering()) {
            $this->markTestSkipped('Resource does not support ordering');
        }

        $modelClass = $this->getModelClass();
        $parentModel = $this->getParentModel();

        $baseData = $this->getFactoryData();

        $image1 = $modelClass::factory()->for($parentModel, $this->getParentRelation())->withOrder(1)->create($baseData);
        $image2 = $modelClass::factory()->for($parentModel, $this->getParentRelation())->withOrder(2)->create($baseData);

        $response = $this->patchJson(route($this->getResourceName().'.moveUp', $image1));

        $response->assertOk();

        $image1->refresh();
        $this->assertEquals(1, $image1->display_order);
    }

    public function test_can_move_image_down(): void
    {
        if (! $this->supportsOrdering()) {
            $this->markTestSkipped('Resource does not support ordering');
        }

        $modelClass = $this->getModelClass();
        $parentModel = $this->getParentModel();

        $baseData = $this->getFactoryData();

        $image1 = $modelClass::factory()->for($parentModel, $this->getParentRelation())->withOrder(1)->create($baseData);
        $image2 = $modelClass::factory()->for($parentModel, $this->getParentRelation())->withOrder(2)->create($baseData);
        $image3 = $modelClass::factory()->for($parentModel, $this->getParentRelation())->withOrder(3)->create($baseData);

        $response = $this->patchJson(route($this->getResourceName().'.moveDown', $image1));

        $response->assertOk();

        $image1->refresh();
        $image2->refresh();

        $this->assertEquals(2, $image1->display_order);
        $this->assertEquals(1, $image2->display_order);
    }

    public function test_move_down_at_bottom_has_no_effect(): void
    {
        if (! $this->supportsOrdering()) {
            $this->markTestSkipped('Resource does not support ordering');
        }

        $modelClass = $this->getModelClass();
        $parentModel = $this->getParentModel();

        $baseData = $this->getFactoryData();

        $image1 = $modelClass::factory()->for($parentModel, $this->getParentRelation())->withOrder(1)->create($baseData);
        $image2 = $modelClass::factory()->for($parentModel, $this->getParentRelation())->withOrder(2)->create($baseData);

        $response = $this->patchJson(route($this->getResourceName().'.moveDown', $image2));

        $response->assertOk();

        $image2->refresh();
        $this->assertEquals(2, $image2->display_order);
    }

    public function test_can_tighten_ordering(): void
    {
        if (! $this->supportsOrdering()) {
            $this->markTestSkipped('Resource does not support ordering');
        }

        $modelClass = $this->getModelClass();
        $parentModel = $this->getParentModel();

        $baseData = $this->getFactoryData();

        $image1 = $modelClass::factory()->for($parentModel, $this->getParentRelation())->withOrder(1)->create($baseData);
        $image5 = $modelClass::factory()->for($parentModel, $this->getParentRelation())->withOrder(5)->create($baseData);
        $image10 = $modelClass::factory()->for($parentModel, $this->getParentRelation())->withOrder(10)->create($baseData);

        $response = $this->patchJson(route($this->getResourceName().'.tightenOrdering', $image1));

        $response->assertOk();

        $image1->refresh();
        $image5->refresh();
        $image10->refresh();

        $this->assertEquals(1, $image1->display_order);
        $this->assertEquals(2, $image5->display_order);
        $this->assertEquals(3, $image10->display_order);
    }

    public function test_move_operations_return_404_for_nonexistent_image(): void
    {
        if (! $this->supportsOrdering()) {
            $this->markTestSkipped('Resource does not support ordering');
        }

        $response = $this->patchJson(route($this->getResourceName().'.moveUp', 'nonexistent-uuid'));
        $response->assertNotFound();

        $response = $this->patchJson(route($this->getResourceName().'.moveDown', 'nonexistent-uuid'));
        $response->assertNotFound();

        $response = $this->patchJson(route($this->getResourceName().'.tightenOrdering', 'nonexistent-uuid'));
        $response->assertNotFound();
    }

    // ========== Helper Methods ==========

    /**
     * Check if this resource uses nested routes (item.images.*, collection.images.*)
     * vs direct routes (partner-image.*, available-image.*)
     */
    protected function usesNestedRoutes(): bool
    {
        // By default, assume direct routes unless overridden
        return false;
    }

    /**
     * Check if this image resource supports create operation
     */
    protected function supportsCreate(): bool
    {
        // By default, image resources support creation unless overridden
        return true;
    }

    /**
     * Check if this image resource supports ordering operations
     */
    protected function supportsOrdering(): bool
    {
        // By default, image resources support ordering unless overridden
        return true;
    }

    /**
     * Get the parent model for nested image resources
     * Override this in tests that need it (ItemImage, CollectionImage, etc.)
     */
    protected function getParentModel()
    {
        return null;
    }

    /**
     * Get the parent relation name
     * Override this in tests that need it (e.g., 'item', 'collection', 'partner')
     */
    protected function getParentRelation(): string
    {
        return '';
    }

    /**
     * Get factory data for creating resources
     * Override this to provide specific data needed for factories
     */
    protected function getFactoryData(): array
    {
        return [];
    }

    /**
     * Get the index route for listing images
     */
    protected function getIndexRoute($parent = null): string
    {
        if ($parent) {
            // Nested route pattern: item.images.index, collection.images.index
            return route($this->getParentRelation().'.images.index', $parent);
        }

        return route($this->getResourceName().'.index');
    }

    /**
     * Get the store route for creating images
     */
    protected function getStoreRoute($parent = null): string
    {
        if ($parent) {
            // Nested route pattern: item.images.store, collection.images.store
            return route($this->getParentRelation().'.images.store', $parent);
        }

        return route($this->getResourceName().'.store');
    }

    /**
     * Check if the model has a specific column
     */
    protected function hasColumn(string $column): bool
    {
        $modelClass = $this->getModelClass();
        $model = $modelClass::make();

        return in_array($column, $model->getFillable()) ||
               array_key_exists($column, $model->getAttributes());
    }
}
