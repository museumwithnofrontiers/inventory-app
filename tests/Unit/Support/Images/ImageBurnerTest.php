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

    /**
     * @return array<string, array{int, int, string}>
     */
    public static function burnedTextProvider(): array
    {
        return [
            'global fallback' => [320, 240, ItemImage::GLOBAL_FALLBACK],
            'short credit' => [640, 480, '© Rights Holder'],
            'long credit, wrapped' => [400, 300, '© '.str_repeat('A very long rights holder name ', 5).'2026'],
            'long credit on a narrow image' => [178, 489, self::LONG_CREDIT],
        ];
    }

    /**
     * Proves the notice is really drawn: a plain re-encode of the input
     * fails from the bar assertions on.
     */
    #[DataProvider('burnedTextProvider')]
    public function test_burn_draws_a_dark_bar_with_light_text_and_nothing_outside_it(int $width, int $height, string $credit): void
    {
        $burner = new ImageBurner;
        $layout = $burner->layout($width, $height, $credit);

        $pixels = $this->burnedPixels($burner->burn($this->makeTestImage($width, $height, self::GREY), $credit), $layout);

        $this->assertSame(0, $pixels['changedAboveBar'], 'The image above the bar is unchanged');
        $this->assertSame($width * $layout->barHeight, $pixels['barPixels']);
        $this->assertGreaterThan(0.5 * $pixels['barPixels'], $pixels['darkerInBar'], 'The bar darkens the image');
        $this->assertGreaterThan(0, $pixels['whiteInBar'], 'The bar holds white text');
        $this->assertGreaterThanOrEqual($layout->barTop, $pixels['top'], 'No text above the bar');
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

        $text = $this->burnedPixels($burner->burn($this->makeTestImage(178, 489, self::GREY), self::LONG_CREDIT), $layout);

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

        $text = $this->burnedPixels($burner->burn($this->makeTestImage(211, 115, self::GREY), ItemImage::GLOBAL_FALLBACK), $layout);

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

        $text = $this->burnedPixels($burner->burn($this->makeTestImage(211, 115, self::GREY), $credit), $layout);

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

        $text = $this->burnedPixels($burner->burn($this->makeTestImage(120, 200, self::GREY), $credit), $layout);

        $this->assertLessThan(120 - intdiv($layout->padding, 2), $text['right']);
    }

    private function makeTestImage(int $width, int $height, string $colour = 'cccccc'): string
    {
        $manager = new ImageManager(new Driver);

        return $manager->create($width, $height)->fill($colour)->encode(new PngEncoder)->toString();
    }

    /**
     * What the burner did to a GREY image, taking the bar geometry from
     * layout(): the bounds of the pixels lighter than the grey (the text),
     * how many pixels changed above the bar, and how many in the bar are
     * darker than the grey or white.
     *
     * @return array{top: int, bottom: int, left: int, right: int, changedAboveBar: int, barPixels: int, darkerInBar: int, whiteInBar: int}
     */
    private function burnedPixels(string $burned, BurnLayout $layout): array
    {
        $image = imagecreatefromstring($burned);
        $this->assertNotFalse($image);
        $grey = hexdec(self::GREY) & 0xFF;
        $pixels = ['top' => PHP_INT_MAX, 'bottom' => -1, 'left' => PHP_INT_MAX, 'right' => -1, 'changedAboveBar' => 0, 'barPixels' => 0, 'darkerInBar' => 0, 'whiteInBar' => 0];

        for ($y = 0; $y < imagesy($image); $y++) {
            for ($x = 0; $x < imagesx($image); $x++) {
                $red = (imagecolorat($image, $x, $y) >> 16) & 0xFF;

                if ($y < $layout->barTop) {
                    $pixels['changedAboveBar'] += $red === $grey ? 0 : 1;
                } else {
                    $pixels['barPixels']++;
                    $pixels['darkerInBar'] += $red < $grey ? 1 : 0;
                    $pixels['whiteInBar'] += $red > 0xF0 ? 1 : 0;
                }

                if ($red > $grey) {
                    $pixels['top'] = min($pixels['top'], $y);
                    $pixels['bottom'] = max($pixels['bottom'], $y);
                    $pixels['left'] = min($pixels['left'], $x);
                    $pixels['right'] = max($pixels['right'], $x);
                }
            }
        }

        return $pixels;
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
