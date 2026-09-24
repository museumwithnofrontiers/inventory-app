<?php

namespace Tests\Api\Traits;

use Illuminate\Support\Facades\Storage;

/**
 * Tests for Image Viewing Operations (download, view)
 *
 * Used by ALL image resources including AvailableImage
 * Provides tests for:
 * - Download endpoint
 * - View endpoint
 */
trait TestsApiImageViewing
{
    abstract protected function getResourceName(): string;

    abstract protected function getModelClass(): string;

    protected function setUpImageStorage(): void
    {
        // Set up fake storage for image tests
        Storage::fake('local');
        Storage::fake('public');

        // Since M9, imageDisk()/imageStoragePath() for every image model -
        // AvailableImage and the 7 attached-image models alike - resolve via
        // localstorage.available.images config (the pristine private
        // original), not localstorage.pictures (the public burned cache).
        config(['localstorage.available.images.disk' => 'local']);
        config(['localstorage.available.images.directory' => 'images']);
    }

    protected function createTestImageFile(string $path): void
    {
        // Create a test image file in the fake storage
        $fixtureImagePath = __DIR__.'/../../fixtures/test-image.jpg';

        if (file_exists($fixtureImagePath)) {
            Storage::disk('local')->put($path, file_get_contents($fixtureImagePath));
        } else {
            // Create a minimal valid JPEG if fixture doesn't exist
            $minimalJpeg = base64_decode('/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=');
            Storage::disk('local')->put($path, $minimalJpeg);
        }
    }

    // ========== Download/View Tests ==========

    public function test_can_download_image(): void
    {
        $this->setUpImageStorage();

        $modelClass = $this->getModelClass();

        // Store file under the configured available-images directory on disk
        $directory = trim(config('localstorage.available.images.directory'), '/');
        $storagePathOnDisk = $directory.'/test-download.jpg';
        // But database should store just filename
        $pathInDatabase = 'test-download.jpg';

        $this->createTestImageFile($storagePathOnDisk);

        // Create image with path and optional columns if the model supports them
        $attributes = ['path' => $pathInDatabase];

        if ($this->hasColumn('original_name')) {
            $attributes['original_name'] = 'test-download.jpg';
        }
        if ($this->hasColumn('mime_type')) {
            $attributes['mime_type'] = 'image/jpeg';
        }

        $image = $modelClass::factory()->create(array_merge($this->getFactoryData(), $attributes));

        $response = $this->get(route($this->getResourceName().'.download', $image));

        $response->assertOk();

        if ($this->hasColumn('original_name')) {
            $response->assertDownload('test-download.jpg');
        }
    }

    public function test_download_returns_404_for_nonexistent_image(): void
    {
        $response = $this->getJson(route($this->getResourceName().'.download', 'nonexistent-uuid'));

        $response->assertNotFound();
    }

    public function test_download_returns_404_when_file_missing(): void
    {
        $this->setUpImageStorage();

        $modelClass = $this->getModelClass();
        // Database stores just filename
        $image = $modelClass::factory()->create(array_merge($this->getFactoryData(), [
            'path' => 'non-existent-file.jpg',
        ]));

        $response = $this->get(route($this->getResourceName().'.download', $image));

        $response->assertNotFound();
    }

    public function test_can_view_image(): void
    {
        $this->setUpImageStorage();

        $modelClass = $this->getModelClass();

        // Store file under the configured available-images directory on disk
        $directory = trim(config('localstorage.available.images.directory'), '/');
        $storagePathOnDisk = $directory.'/test-view.jpg';
        // But database should store just filename
        $pathInDatabase = 'test-view.jpg';

        $this->createTestImageFile($storagePathOnDisk);

        // Create image with path and optional mime_type if the model supports it
        $attributes = ['path' => $pathInDatabase];

        if ($this->hasColumn('mime_type')) {
            $attributes['mime_type'] = 'image/jpeg';
        }

        $image = $modelClass::factory()->create(array_merge($this->getFactoryData(), $attributes));

        $response = $this->get(route($this->getResourceName().'.view', $image));

        $response->assertOk();

        if ($this->hasColumn('mime_type')) {
            $response->assertHeader('Content-Type', 'image/jpeg');
        }
    }

    public function test_view_returns_404_for_nonexistent_image(): void
    {
        $response = $this->getJson(route($this->getResourceName().'.view', 'nonexistent-uuid'));

        $response->assertNotFound();
    }

    public function test_view_returns_404_when_file_missing(): void
    {
        $this->setUpImageStorage();

        $modelClass = $this->getModelClass();
        $image = $modelClass::factory()->create(array_merge($this->getFactoryData(), [
            'path' => 'images/non-existent-file.jpg',
        ]));

        $response = $this->get(route($this->getResourceName().'.view', $image));

        $response->assertNotFound();
    }

    // ========== Helper Methods ==========

    /**
     * Get factory data for creating resources
     * Can be overridden in test classes or provided by TestsApiImageResource trait
     */
    protected function getFactoryData(): array
    {
        return method_exists($this, 'parentGetFactoryData') ? $this->parentGetFactoryData() : [];
    }

    /**
     * Check if the model has a specific column
     * Can be overridden in test classes or provided by TestsApiImageResource trait
     */
    protected function hasColumn(string $column): bool
    {
        if (method_exists($this, 'parentHasColumn')) {
            return $this->parentHasColumn($column);
        }

        $modelClass = $this->getModelClass();
        $model = $modelClass::make();

        return in_array($column, $model->getFillable()) ||
               array_key_exists($column, $model->getAttributes());
    }
}
