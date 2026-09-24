<?php

namespace App\Support\Images;

use Intervention\Image\Drivers\Gd\Driver;
use Intervention\Image\Drivers\Gd\FontProcessor;
use Intervention\Image\Encoders\AutoEncoder;
use Intervention\Image\Geometry\Factories\RectangleFactory;
use Intervention\Image\Geometry\Point;
use Intervention\Image\ImageManager;
use Intervention\Image\Interfaces\FontInterface;
use Intervention\Image\Typography\Font;
use Intervention\Image\Typography\FontFactory;

/**
 * Burns a copyright notice onto an image: a semi-opaque dark bar along the
 * bottom edge, with the text in white, sized to the image and wrapped to its
 * width. One operation, reused by every trigger that needs a public
 * rendition - attach, a copyright edit, or a cache-miss request (M9 epic A3)
 * - so burn behavior can never drift between "first burn" and "re-burn".
 */
class ImageBurner
{
    /**
     * Part of every burned image's ETag. Bump it whenever burn() gives
     * different bytes for the same input, or clients keep the old rendition
     * and the pictures cache is never refreshed.
     */
    public const int VERSION = 3;

    /** Output quality of lossy formats (JPEG, WebP); lossless ones ignore it. */
    public const int QUALITY = 90;

    /** The bar takes at most this share of the image height... */
    public const float MAX_BAR_SHARE = 0.15;

    /** ...unless even one line at this size doesn't fit in it. */
    public const int MIN_FONT_SIZE = 8;

    private const string FONT_PATH = 'fonts/Roboto-Regular.ttf';

    private const string ELLIPSIS = '…';

    public function burn(string $originalContents, string $copyrightText): string
    {
        $manager = new ImageManager(new Driver);
        $image = $manager->read($originalContents);
        $layout = $this->layout($image->width(), $image->height(), $copyrightText);

        $image->drawRectangle(0, $layout->barTop, function (RectangleFactory $rectangle) use ($image, $layout): void {
            $rectangle->size($image->width(), $layout->barHeight);
            $rectangle->background('000000b3');
        });

        // The lines are already wrapped to the bar, so the font gets no wrap
        // width: the text is drawn exactly as layout() measured it
        $image->text(implode("\n", $layout->lines), $layout->padding, $layout->barTop + $layout->padding, function (FontFactory $font) use ($layout): void {
            $font->filename(resource_path(self::FONT_PATH));
            $font->size($layout->fontSize);
            $font->color('ffffff');
            $font->align('left');
            $font->valign('top');
        });

        // Encodes in the original's format; the quality only reaches the
        // encoders that take one
        return $image->encode(new AutoEncoder(quality: self::QUALITY))->toString();
    }

    /**
     * Where the bar and the text go on an image of this size. The font
     * starts at a size proportional to the image height and shrinks until
     * the wrapped text fits the image width and a bar of at most
     * MAX_BAR_SHARE of the height. If it still doesn't fit at MIN_FONT_SIZE,
     * the text is cut, and the cut shown by an ellipsis: lines that don't fit
     * the bar are dropped (at least one is kept) and a word too long for the
     * width is shortened.
     */
    public function layout(int $width, int $height, string $text): BurnLayout
    {
        $metrics = new FontProcessor;
        $maxBarHeight = (int) floor($height * self::MAX_BAR_SHARE);
        $fontSize = max(self::MIN_FONT_SIZE, (int) round($height / 40));

        while (true) {
            $padding = max(2, (int) round($fontSize * 0.5));
            $font = (new Font(resource_path(self::FONT_PATH)))
                ->setSize($fontSize)
                ->setWrapWidth(max(1, $width - (2 * $padding)));
            $lines = array_map('strval', iterator_to_array($metrics->textBlock($text, $font, new Point(0, 0)), false));
            $leading = $metrics->leading($font);
            $lineHeight = $metrics->typographicalSize($font);

            $fits = $this->barHeight(count($lines), $leading, $lineHeight, $padding) <= $maxBarHeight
                && $this->widest($lines, $font, $metrics) <= $font->wrapWidth();

            if ($fits || $fontSize === self::MIN_FONT_SIZE) {
                break;
            }

            $fontSize--;
        }

        if (! $fits) {
            $lines = $this->truncate($lines, $maxBarHeight, $leading, $lineHeight, $padding, $font, $metrics);
        }

        $barHeight = min($height, $this->barHeight(count($lines), $leading, $lineHeight, $padding));

        return new BurnLayout($fontSize, $padding, $height - $barHeight, $barHeight, $lines);
    }

    /**
     * The first line's full height (ascender to descender), one leading per
     * further line, and the padding above and below.
     */
    private function barHeight(int $lineCount, int $leading, int $lineHeight, int $padding): int
    {
        return ($leading * ($lineCount - 1)) + $lineHeight + (2 * $padding);
    }

    /**
     * @param  list<string>  $lines
     */
    private function widest(array $lines, FontInterface $font, FontProcessor $metrics): int
    {
        return max(array_map(fn (string $line): int => $metrics->boxSize($line, $font)->width(), $lines));
    }

    /**
     * @param  list<string>  $lines
     * @return list<string>
     */
    private function truncate(array $lines, int $maxBarHeight, int $leading, int $lineHeight, int $padding, FontInterface $font, FontProcessor $metrics): array
    {
        $kept = max(1, intdiv(max(0, $maxBarHeight - $lineHeight - (2 * $padding)), $leading) + 1);

        if ($kept < count($lines)) {
            $lines = array_slice($lines, 0, $kept);
            $lines[$kept - 1] = $this->withEllipsis($lines[$kept - 1], $font, $metrics);
        }

        return array_map(
            fn (string $line): string => $metrics->boxSize($line, $font)->width() > $font->wrapWidth()
                ? $this->withEllipsis($line, $font, $metrics)
                : $line,
            $lines
        );
    }

    /**
     * The line, shortened as needed so that it still fits the width once it
     * ends with an ellipsis.
     */
    private function withEllipsis(string $line, FontInterface $font, FontProcessor $metrics): string
    {
        for ($kept = rtrim($line); $kept !== ''; $kept = rtrim(mb_substr($kept, 0, -1))) {
            if ($metrics->boxSize($kept.self::ELLIPSIS, $font)->width() <= $font->wrapWidth()) {
                return $kept.self::ELLIPSIS;
            }
        }

        return self::ELLIPSIS;
    }
}
