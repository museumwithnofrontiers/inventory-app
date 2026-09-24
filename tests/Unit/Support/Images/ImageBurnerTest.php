<?php

namespace Tests\Unit\Support\Images;

use App\Models\ItemImage;
use App\Support\Images\BurnLayout;
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
    private const string LONG_CREDIT = '© Photograph: Museum of Islamic Art, Doha, Qatar, courtesy of the Qatar Museums Authority 2026';

    /** A flat, mid-grey, lossless input: any change to a pixel is the burner's */
    private const string GREY = '808080';

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

    public function test_a_long_credit_on_a_narrow_image_wraps_inside_the_bar(): void
    {
        $burner = new ImageBurner;
        $layout = $burner->layout(178, 489, self::LONG_CREDIT);

        $this->assertGreaterThan(1, count($layout->lines));
        $this->assertSame(self::LONG_CREDIT, implode(' ', $layout->lines));

        $text = $this->textBounds($burner->burn($this->makeTestImage(178, 489, self::GREY), self::LONG_CREDIT), $layout);

        $this->assertSame(0, $text['changedAboveBar'], 'Nothing may be drawn above the bar');
        $this->assertGreaterThanOrEqual($layout->barTop, $text['top']);
        // Nothing cut off: the last line's descenders end before the bottom
        // edge, and every line before the right edge
        $this->assertLessThan(489 - intdiv($layout->padding, 2), $text['bottom']);
        $this->assertLessThan(178 - intdiv($layout->padding, 2), $text['right']);
    }

    public function test_the_bar_takes_at_most_its_share_of_a_small_image(): void
    {
        $burner = new ImageBurner;
        $layout = $burner->layout(211, 115, ItemImage::GLOBAL_FALLBACK);

        $this->assertLessThanOrEqual((int) floor(115 * ImageBurner::MAX_BAR_SHARE), $layout->barHeight);
        $this->assertSame([ItemImage::GLOBAL_FALLBACK], $layout->lines);

        $text = $this->textBounds($burner->burn($this->makeTestImage(211, 115, self::GREY), ItemImage::GLOBAL_FALLBACK), $layout);

        $this->assertSame(0, $text['changedAboveBar']);
        $this->assertLessThan(115, $text['bottom']);
    }

    public function test_a_large_image_keeps_its_proportional_font_on_a_bar_no_taller_than_before(): void
    {
        $layout = (new ImageBurner)->layout(1600, 1200, ItemImage::GLOBAL_FALLBACK);

        // The font size the burner has always used for this height...
        $this->assertSame((int) round(1200 / 40), $layout->fontSize);
        $this->assertSame([ItemImage::GLOBAL_FALLBACK], $layout->lines);
        // ...on a bar that fits one line instead of the fixed 3.2 font sizes
        $this->assertLessThanOrEqual((int) round($layout->fontSize * 3.2), $layout->barHeight);
        $this->assertSame(1200 - $layout->barHeight, $layout->barTop);
    }

    public function test_text_that_does_not_fit_at_the_smallest_size_is_cut_with_an_ellipsis(): void
    {
        $burner = new ImageBurner;
        $credit = str_repeat(self::LONG_CREDIT.' ', 3);
        $layout = $burner->layout(211, 115, $credit);

        $this->assertSame(ImageBurner::MIN_FONT_SIZE, $layout->fontSize);
        $this->assertLessThanOrEqual((int) floor(115 * ImageBurner::MAX_BAR_SHARE), $layout->barHeight);
        $this->assertStringEndsWith('…', $layout->lines[count($layout->lines) - 1]);

        $text = $this->textBounds($burner->burn($this->makeTestImage(211, 115, self::GREY), $credit), $layout);

        $this->assertSame(0, $text['changedAboveBar']);
        $this->assertLessThan(211 - intdiv($layout->padding, 2), $text['right']);
    }

    public function test_a_word_too_long_for_the_width_is_shortened_with_an_ellipsis(): void
    {
        $burner = new ImageBurner;
        $credit = '©'.str_repeat('Unbreakable', 8);
        $layout = $burner->layout(120, 200, $credit);

        $this->assertCount(1, $layout->lines);
        $this->assertStringEndsWith('…', $layout->lines[0]);

        $text = $this->textBounds($burner->burn($this->makeTestImage(120, 200, self::GREY), $credit), $layout);

        $this->assertLessThan(120 - intdiv($layout->padding, 2), $text['right']);
    }

    private function makeTestImage(int $width, int $height, string $colour = 'cccccc'): string
    {
        $manager = new ImageManager(new Driver);

        return $manager->create($width, $height)->fill($colour)->encode(new PngEncoder)->toString();
    }

    /**
     * Where the text landed on a burned GREY image: the bounds of the pixels
     * lighter than the grey, and how many pixels above the bar changed.
     *
     * @return array{top: int, bottom: int, left: int, right: int, changedAboveBar: int}
     */
    private function textBounds(string $burned, BurnLayout $layout): array
    {
        $image = imagecreatefromstring($burned);
        $this->assertNotFalse($image);
        $grey = hexdec(self::GREY) & 0xFF;
        $bounds = ['top' => PHP_INT_MAX, 'bottom' => -1, 'left' => PHP_INT_MAX, 'right' => -1, 'changedAboveBar' => 0];

        for ($y = 0; $y < imagesy($image); $y++) {
            for ($x = 0; $x < imagesx($image); $x++) {
                $red = (imagecolorat($image, $x, $y) >> 16) & 0xFF;

                if ($y < $layout->barTop && $red !== $grey) {
                    $bounds['changedAboveBar']++;
                }

                if ($red > $grey) {
                    $bounds['top'] = min($bounds['top'], $y);
                    $bounds['bottom'] = max($bounds['bottom'], $y);
                    $bounds['left'] = min($bounds['left'], $x);
                    $bounds['right'] = max($bounds['right'], $x);
                }
            }
        }

        $this->assertGreaterThan(-1, $bounds['bottom'], 'No text was drawn');

        return $bounds;
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
