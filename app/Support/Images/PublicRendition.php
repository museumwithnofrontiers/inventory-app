<?php

namespace App\Support\Images;

/**
 * The bytes of an image's public rendition, with the ETag they were
 * produced for.
 */
final readonly class PublicRendition
{
    public function __construct(
        public string $contents,
        public string $etag,
    ) {}
}
