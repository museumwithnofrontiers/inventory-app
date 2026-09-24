<?php

namespace Tests\Unit\Support\Images;

use App\Models\ItemImage;
use App\Support\Images\ImageBurner;
use finfo;
use Intervention\Image\Drivers\Gd\Driver;
use Intervention\Image\Encoders\PngEncoder;
use Intervention\Image\ImageManager;
use Tests\TestCase;

class ImageBurnerTest extends TestCase
{
    public function test_burn_produces_a_rendition_of_the_same_dimensions_that_differs_from_the_original(): void
    {
        $original = $this->makeTestImage(640, 480);

        $burned = (new ImageBurner)->burn($original, '© Museum With No Frontiers');

        $manager = new ImageManager(new Driver);
        $burnedImage = $manager->read($burned);

        $this->assertSame(640, $burnedImage->width());
        $this->assertSame(480, $burnedImage->height());
        $this->assertNotSame($original, $burned);
    }

    public function test_burn_with_the_global_fallback_copyright_string_produces_a_rendition_that_differs_from_the_original(): void
    {
        $original = $this->makeTestImage(320, 240);

        $burned = (new ImageBurner)->burn($original, ItemImage::GLOBAL_FALLBACK);

        $manager = new ImageManager(new Driver);
        $burnedImage = $manager->read($burned);

        $this->assertSame(320, $burnedImage->width());
        $this->assertSame(240, $burnedImage->height());
        $this->assertNotSame($original, $burned);
    }

    public function test_burn_with_a_long_copyright_string_still_produces_a_valid_rendition_of_the_same_dimensions(): void
    {
        $original = $this->makeTestImage(400, 300);
        $longCopyright = '© '.str_repeat('A very long rights holder name ', 5).'2026';

        $burned = (new ImageBurner)->burn($original, $longCopyright);

        $manager = new ImageManager(new Driver);
        $burnedImage = $manager->read($burned);

        $this->assertSame(400, $burnedImage->width());
        $this->assertSame(300, $burnedImage->height());
    }

    public function test_burn_preserves_the_original_image_format(): void
    {
        $manager = new ImageManager(new Driver);
        $original = $manager->create(200, 150)->fill('336699')->encode(new PngEncoder)->toString();

        $burned = (new ImageBurner)->burn($original, 'Test');

        $this->assertSame('image/png', (new finfo(FILEINFO_MIME_TYPE))->buffer($burned));
    }

    private function makeTestImage(int $width, int $height): string
    {
        $manager = new ImageManager(new Driver);

        return $manager->create($width, $height)->fill('cccccc')->encode(new PngEncoder)->toString();
    }
}
