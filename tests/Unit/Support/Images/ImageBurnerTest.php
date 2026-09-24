<?php

namespace Tests\Unit\Support\Images;

use App\Models\ItemImage;
use App\Support\Images\ImageBurner;
use finfo;
use Intervention\Image\Drivers\Gd\Driver;
use Intervention\Image\Encoders\JpegEncoder;
use Intervention\Image\Encoders\PngEncoder;
use Intervention\Image\Encoders\WebpEncoder;
use Intervention\Image\ImageManager;
use Intervention\Image\Interfaces\EncoderInterface;
use PHPUnit\Framework\Attributes\DataProvider;
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

    /**
     * @return array<string, array{EncoderInterface, string}>
     */
    public static function formatProvider(): array
    {
        return [
            'jpg' => [new JpegEncoder(quality: 100), 'image/jpeg'],
            'png' => [new PngEncoder, 'image/png'],
            'webp' => [new WebpEncoder(quality: 100), 'image/webp'],
        ];
    }

    #[DataProvider('formatProvider')]
    public function test_burn_preserves_the_original_image_format(EncoderInterface $encoder, string $mimeType): void
    {
        $manager = new ImageManager(new Driver);
        $original = $manager->create(200, 150)->fill('336699')->encode($encoder)->toString();

        $burned = (new ImageBurner)->burn($original, 'Test');

        $this->assertSame($mimeType, (new finfo(FILEINFO_MIME_TYPE))->buffer($burned));
    }

    public function test_burn_encodes_jpeg_at_the_burner_quality(): void
    {
        $manager = new ImageManager(new Driver);
        $original = $manager->create(640, 480)->fill('cccccc')->encode(new JpegEncoder(quality: 100))->toString();

        $burned = (new ImageBurner)->burn($original, 'Test');

        // A JPEG's quantization tables are set by the quality it was encoded
        // at, whatever the picture, so compare them with reference encodes.
        $reference = fn (int $quality): array => $this->firstQuantizationTable(
            $manager->read($original)->encode(new JpegEncoder(quality: $quality))->toString()
        );

        $this->assertSame(90, ImageBurner::QUALITY);
        $this->assertSame($reference(ImageBurner::QUALITY), $this->firstQuantizationTable($burned));
        $this->assertNotSame($reference(75), $this->firstQuantizationTable($burned));
    }

    private function makeTestImage(int $width, int $height): string
    {
        $manager = new ImageManager(new Driver);

        return $manager->create($width, $height)->fill('cccccc')->encode(new PngEncoder)->toString();
    }

    /**
     * The values of the first quantization table (DQT segment) of a JPEG.
     *
     * @return list<int>
     */
    private function firstQuantizationTable(string $jpeg): array
    {
        // Walk the segments after SOI: each is 0xFF, a marker, and a
        // big-endian length that counts itself but not the marker
        $offset = 2;
        while ($offset + 4 <= strlen($jpeg)) {
            $this->assertSame(0xFF, ord($jpeg[$offset]), 'Malformed JPEG segment');

            if (ord($jpeg[$offset + 1]) === 0xDB) {
                // One byte of precision/table id, then 64 8-bit values
                return array_map('ord', str_split(substr($jpeg, $offset + 5, 64)));
            }

            $offset += 2 + ((ord($jpeg[$offset + 2]) << 8) | ord($jpeg[$offset + 3]));
        }

        $this->fail('The JPEG has no quantization table');
    }
}
