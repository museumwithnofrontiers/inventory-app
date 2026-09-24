<?php

namespace App\Support\Images;

use Intervention\Image\Drivers\Gd\Driver;
use Intervention\Image\Encoders\AutoEncoder;
use Intervention\Image\Geometry\Factories\RectangleFactory;
use Intervention\Image\ImageManager;
use Intervention\Image\Typography\FontFactory;

/**
 * Burns a copyright notice onto an image: a semi-opaque dark bar along the
 * bottom edge, with the text in white, auto-sized and wrapped to the image's
 * own dimensions. One operation, reused by every trigger that needs a public
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
    public const int VERSION = 2;

    /** Output quality of lossy formats (JPEG, WebP); lossless ones ignore it. */
    public const int QUALITY = 90;

    private const string FONT_PATH = 'fonts/Roboto-Regular.ttf';

    public function burn(string $originalContents, string $copyrightText): string
    {
        $manager = new ImageManager(new Driver);
        $image = $manager->read($originalContents);

        $width = $image->width();
        $height = $image->height();

        $fontSize = max(14, (int) round($height / 40));
        $padding = (int) round($fontSize * 0.6);
        $barHeight = (int) round($fontSize * 3.2);

        $image->drawRectangle(0, $height - $barHeight, function (RectangleFactory $rectangle) use ($width, $barHeight): void {
            $rectangle->size($width, $barHeight);
            $rectangle->background('000000b3');
        });

        $image->text($copyrightText, $padding, $height - (int) round($barHeight / 2), function (FontFactory $font) use ($fontSize, $width, $padding): void {
            $font->filename(resource_path(self::FONT_PATH));
            $font->size($fontSize);
            $font->color('ffffff');
            $font->align('left');
            $font->valign('middle');
            $font->wrap($width - (2 * $padding));
        });

        // Encodes in the original's format; the quality only reaches the
        // encoders that take one
        return $image->encode(new AutoEncoder(quality: self::QUALITY))->toString();
    }
}
