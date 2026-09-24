<?php

namespace Tests\Unit\Models\Images;

use App\Contracts\StreamableImageFile;
use App\Models\CollectionImage;
use App\Models\ContributorImage;
use App\Models\ItemImage;
use App\Models\PartnerImage;
use App\Models\PartnerLogo;
use App\Models\PartnerTranslationImage;
use App\Models\TimelineEventImage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class StreamableImageContractTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return list<list<class-string<StreamableImageFile>>>
     */
    public static function picturesBackedModelProvider(): array
    {
        return [
            [ItemImage::class],
            [CollectionImage::class],
            [PartnerImage::class],
            [PartnerTranslationImage::class],
            [ContributorImage::class],
            [TimelineEventImage::class],
            [PartnerLogo::class],
        ];
    }

    #[DataProvider('picturesBackedModelProvider')]
    public function test_model_implements_streamable_image_file(string $class): void
    {
        $this->assertTrue(
            is_subclass_of($class, StreamableImageFile::class),
            "{$class} must implement StreamableImageFile"
        );
    }

    /**
     * `imageDisk()`/`imageStoragePath()` resolve the pristine private
     * original (M9 §10) - the same disk AvailableImage itself uses - not
     * the public pictures/cache disk. See CopyrightResolutionTest and
     * Pub\PictureControllerTest for the public-facing, burned rendition.
     */
    #[DataProvider('picturesBackedModelProvider')]
    public function test_image_disk_returns_available_images_disk(string $class): void
    {
        $instance = new $class;
        $this->assertSame(config('localstorage.available.images.disk'), $instance->imageDisk());
    }

    #[DataProvider('picturesBackedModelProvider')]
    public function test_image_storage_path_combines_directory_and_path(string $class): void
    {
        $instance = new $class;
        $instance->path = 'abc123.jpg';

        $expected = trim(config('localstorage.available.images.directory'), '/').'/abc123.jpg';
        $this->assertSame($expected, $instance->imageStoragePath());
    }

    #[DataProvider('picturesBackedModelProvider')]
    public function test_image_mime_type_returns_mime_type_attribute(string $class): void
    {
        $instance = new $class;
        $instance->mime_type = 'image/jpeg';

        $this->assertSame('image/jpeg', $instance->imageMimeType());
    }

    #[DataProvider('picturesBackedModelProvider')]
    public function test_image_mime_type_returns_null_when_not_set(string $class): void
    {
        $instance = new $class;
        $instance->mime_type = null;

        $this->assertNull($instance->imageMimeType());
    }

    #[DataProvider('picturesBackedModelProvider')]
    public function test_image_download_filename_uses_the_stored_path_not_original_name(string $class): void
    {
        $instance = new $class;
        $instance->original_name = 'my-photo.jpg';
        $instance->path = 'uuid123.jpg';

        $this->assertSame('uuid123.jpg', $instance->imageDownloadFilename());
    }

    #[DataProvider('picturesBackedModelProvider')]
    public function test_image_download_filename_falls_back_to_basename_of_path(string $class): void
    {
        $instance = new $class;
        $instance->original_name = null;
        $instance->path = 'subdir/uuid123.jpg';

        $this->assertSame('uuid123.jpg', $instance->imageDownloadFilename());
    }

    /**
     * The regression this contract exists to prevent.
     *
     * `original_name` carries provenance, not a filename: on imported records
     * it is the legacy source path. Returning it produced a header Symfony
     * refuses to build ("The filename and the fallback cannot contain the "/"
     * and "\" characters"), so every download of an imported image answered
     * 500 — 27,049 of 27,352 item_images rows in the real dataset.
     */
    #[DataProvider('picturesBackedModelProvider')]
    public function test_image_download_filename_is_never_a_path(string $class): void
    {
        $instance = new $class;
        $instance->original_name = 'monuments/bar/hu/11/4/10.jpg';
        $instance->path = '00011146-449a-53d0-b1dc-48dadc5565d4.jpg';

        $filename = $instance->imageDownloadFilename();

        $this->assertSame('00011146-449a-53d0-b1dc-48dadc5565d4.jpg', $filename);
        $this->assertStringNotContainsString('/', $filename);
        $this->assertStringNotContainsString('\\', $filename);
    }
}
