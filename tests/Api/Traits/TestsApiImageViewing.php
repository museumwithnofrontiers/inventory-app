<?php

namespace Tests\Api\Traits;

use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Intervention\Image\Drivers\Gd\Driver;
use Intervention\Image\Encoders\JpegEncoder;
use Intervention\Image\ImageManager;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Tests for Image Viewing Operations (download, view)
 *
 * Used by ALL image resources including AvailableImage
 * Provides tests for:
 * - Download endpoint
 * - View endpoint
 *
 * The attached *Image resources serve the public rendition - the bytes
 * /pub serves, copyright burned in - and declare it by overriding
 * servesBurnedImage(). The others (AvailableImage, PartnerLogo) serve the
 * original.
 */
trait TestsApiImageViewing
{
    abstract protected function getResourceName(): string;

    abstract protected function getModelClass(): string;

    protected function servesBurnedImage(): bool
    {
        return false;
    }

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
        config(['localstorage.pictures.disk' => 'public']);
        config(['localstorage.pictures.directory' => 'pictures']);
    }

    /**
     * Store a small, decodable JPEG - the burned rendition is made from it -
     * and return its bytes.
     */
    protected function createTestImageFile(string $path): string
    {
        $jpeg = (new ImageManager(new Driver))->create(120, 90)->fill('336699')->encode(new JpegEncoder)->toString();

        Storage::disk('local')->put($path, $jpeg);

        return $jpeg;
    }

    // ========== Download/View Tests ==========

    public function test_can_download_image(): void
    {
        $this->setUpImageStorage();

        $modelClass = $this->getModelClass();

        // Store file under the configured available-images directory on disk
        $directory = trim(config('localstorage.available.images.directory'), '/');
        // Database stores just the filename, a UUID like every public image's
        $pathInDatabase = Str::uuid()->toString().'.jpg';
        $storagePathOnDisk = $directory.'/'.$pathInDatabase;

        $original = $this->createTestImageFile($storagePathOnDisk);

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
        // imageDownloadFilename(): the stored filename
        $response->assertDownload($pathInDatabase);

        $this->assertServedBytes($response, $original, $pathInDatabase);
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
        // Database stores just the filename, a UUID like every public image's
        $pathInDatabase = Str::uuid()->toString().'.jpg';
        $storagePathOnDisk = $directory.'/'.$pathInDatabase;

        $original = $this->createTestImageFile($storagePathOnDisk);

        // Create image with path and optional mime_type if the model supports it
        $attributes = ['path' => $pathInDatabase];

        if ($this->hasColumn('mime_type')) {
            $attributes['mime_type'] = 'image/jpeg';
        }

        $image = $modelClass::factory()->create(array_merge($this->getFactoryData(), $attributes));

        $response = $this->get(route($this->getResourceName().'.view', $image));

        $response->assertOk();
        $this->assertStringContainsString('inline', (string) $response->headers->get('Content-Disposition'));

        if ($this->hasColumn('mime_type')) {
            $response->assertHeader('Content-Type', 'image/jpeg');
        }

        $this->assertServedBytes($response, $original, $pathInDatabase);
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
     * An attached *Image resource serves exactly what /pub serves for the
     * same file, which is not the original; the others serve the original.
     */
    protected function assertServedBytes(TestResponse $response, string $original, string $filename): void
    {
        $body = match (true) {
            $response->baseResponse instanceof BinaryFileResponse => $response->baseResponse->getFile()->getContent(),
            $response->baseResponse instanceof StreamedResponse => $response->streamedContent(),
            default => (string) $response->getContent(),
        };

        if (! $this->servesBurnedImage()) {
            $this->assertSame($original, $body, 'The original is served');

            return;
        }

        $this->assertNotSame($original, $body, 'The burned rendition is served, not the original');
        $this->assertSame($this->get(route('pub.picture', ['filename' => $filename]))->getContent(), $body, 'The API serves what /pub serves');
        $this->assertStringContainsString('private', (string) $response->headers->get('Cache-Control'));
        $this->assertStringContainsString('no-cache', (string) $response->headers->get('Cache-Control'));
        $this->assertNotEmpty($response->headers->get('ETag'));
    }

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
