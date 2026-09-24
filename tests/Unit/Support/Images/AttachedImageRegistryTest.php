<?php

namespace Tests\Unit\Support\Images;

use App\Contracts\BurnsCopyright;
use App\Contracts\HasCopyright;
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
use App\Traits\DeletesImageFilesOnDelete;
use Closure;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
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

    public function test_every_registered_model_has_a_copyright_and_deletes_its_files(): void
    {
        foreach (AttachedImageRegistry::modelClasses() as $class) {
            $this->assertTrue(is_subclass_of($class, HasCopyright::class), "{$class} must implement HasCopyright");
            $this->assertContains(DeletesImageFilesOnDelete::class, class_uses_recursive($class), "{$class} must use DeletesImageFilesOnDelete");
        }
    }

    public function test_every_image_model_is_burned_and_the_partner_logo_is_not(): void
    {
        foreach (AttachedImageRegistry::modelClasses() as $class) {
            $this->assertSame(
                $class !== PartnerLogo::class,
                is_subclass_of($class, BurnsCopyright::class),
                "{$class}: every *Image model is burned, a PartnerLogo never is"
            );
        }
    }

    public function test_validation_accepts_a_class_meeting_the_whole_contract(): void
    {
        AttachedImageRegistry::validateClass(ItemImage::class);
        AttachedImageRegistry::validateClass(PartnerLogo::class);

        $this->addToAssertionCount(2);
    }

    /**
     * @return array<string, array{Closure(): string, string}>
     */
    public static function incompleteClassProvider(): array
    {
        return [
            'missing class' => [fn (): string => 'App\\Models\\NoSuchImage', 'class does not exist'],
            'not a model' => [fn (): string => (new class {})::class, 'must extend '.Model::class],
            'no StreamableImageFile' => [
                fn (): string => (new class extends Model implements HasCopyright
                {
                    use DeletesImageFilesOnDelete;

                    public function resolveCopyright(): string
                    {
                        return '';
                    }
                })::class,
                'must implement '.StreamableImageFile::class,
            ],
            // AvailableImage: a model that streams its file, and nothing more
            'no HasCopyright' => [
                fn (): string => (new class extends AvailableImage
                {
                    use DeletesImageFilesOnDelete;
                })::class,
                'must implement '.HasCopyright::class,
            ],
            'no DeletesImageFilesOnDelete' => [
                fn (): string => (new class extends AvailableImage implements HasCopyright
                {
                    public function resolveCopyright(): string
                    {
                        return '';
                    }
                })::class,
                'must use '.DeletesImageFilesOnDelete::class,
            ],
        ];
    }

    /**
     * @param  Closure(): string  $class
     */
    #[DataProvider('incompleteClassProvider')]
    public function test_validation_fails_fast_on_a_class_missing_part_of_the_contract(Closure $class, string $message): void
    {
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage($message);

        AttachedImageRegistry::validateClass($class());
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

    public function test_find_by_path_returns_the_owning_model_instance(): void
    {
        $image = CollectionImage::factory()->create(['path' => 'find-me.jpg']);

        $found = AttachedImageRegistry::findByPath('find-me.jpg');

        $this->assertInstanceOf(CollectionImage::class, $found);
        $this->assertSame($image->id, $found->id);
    }

    public function test_find_by_path_returns_null_when_no_model_owns_the_path(): void
    {
        $this->assertNull(AttachedImageRegistry::findByPath('does-not-exist.jpg'));
    }
}
