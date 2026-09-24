<?php

namespace Tests\Unit\Support\Images;

use App\Contracts\StreamableImageFile;
use App\Models\AvailableImage;
use App\Models\CollectionImage;
use App\Models\ContributorImage;
use App\Models\ImageUpload;
use App\Models\ItemImage;
use App\Models\PartnerImage;
use App\Models\PartnerLogo;
use App\Models\PartnerTranslationImage;
use App\Models\TimelineEventImage;
use App\Support\Images\AttachedImageRegistry;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AttachedImageRegistryTest extends TestCase
{
    use RefreshDatabase;

    public function test_validate_passes_for_default_registry(): void
    {
        // Should not throw
        AttachedImageRegistry::validate();
        $this->addToAssertionCount(1);
    }

    public function test_model_classes_returns_all_seven_models(): void
    {
        $classes = AttachedImageRegistry::modelClasses();

        $this->assertCount(7, $classes);
        $this->assertContains(ItemImage::class, $classes);
        $this->assertContains(CollectionImage::class, $classes);
        $this->assertContains(PartnerImage::class, $classes);
        $this->assertContains(PartnerTranslationImage::class, $classes);
        $this->assertContains(ContributorImage::class, $classes);
        $this->assertContains(TimelineEventImage::class, $classes);
        $this->assertContains(PartnerLogo::class, $classes);
    }

    public function test_model_classes_excludes_available_image(): void
    {
        $classes = AttachedImageRegistry::modelClasses();

        $this->assertNotContains(AvailableImage::class, $classes);
    }

    public function test_model_classes_excludes_image_upload(): void
    {
        $classes = AttachedImageRegistry::modelClasses();

        $this->assertNotContains(ImageUpload::class, $classes);
    }

    public function test_every_registered_model_extends_eloquent_model(): void
    {
        foreach (AttachedImageRegistry::modelClasses() as $class) {
            $this->assertTrue(
                is_subclass_of($class, Model::class),
                "{$class} must extend Eloquent Model"
            );
        }
    }

    public function test_every_registered_model_implements_streamable_image_file(): void
    {
        foreach (AttachedImageRegistry::modelClasses() as $class) {
            $this->assertTrue(
                is_subclass_of($class, StreamableImageFile::class),
                "{$class} must implement StreamableImageFile"
            );
        }
    }

    public function test_table_names_returns_correct_tables(): void
    {
        $tables = AttachedImageRegistry::tableNames();

        $this->assertContains('item_images', $tables);
        $this->assertContains('collection_images', $tables);
        $this->assertContains('partner_images', $tables);
        $this->assertContains('partner_translation_images', $tables);
        $this->assertContains('contributor_images', $tables);
        $this->assertContains('timeline_event_images', $tables);
        $this->assertContains('partner_logos', $tables);
        $this->assertCount(7, $tables);
    }

    public function test_table_names_excludes_available_images_table(): void
    {
        $tables = AttachedImageRegistry::tableNames();

        $this->assertNotContains('available_images', $tables);
    }

    public function test_table_names_excludes_image_uploads_table(): void
    {
        $tables = AttachedImageRegistry::tableNames();

        $this->assertNotContains('image_uploads', $tables);
    }

    /**
     * Since M9 (#1974), imageStoragePath() resolves the private original
     * on the available-images disk, not the public pictures/cache disk.
     */
    public function test_referenced_paths_yields_storage_paths_from_database(): void
    {
        $item = ItemImage::factory()->create(['path' => 'test-item.jpg']);

        $paths = [];
        foreach (AttachedImageRegistry::referencedPaths() as $path) {
            $paths[] = $path;
        }

        $expectedPath = trim(config('localstorage.available.images.directory'), '/').'/test-item.jpg';
        $this->assertContains($expectedPath, $paths);
    }
}
