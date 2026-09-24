<?php

namespace App\Support\Images;

/**
 * The bytes of an image's public rendition, with the ETag they were
 * produced for - or null when nothing records what they are, and no client
 * may keep them.
 */
final readonly class PublicRendition
{
    public function __construct(
        public string $contents,
        public ?string $etag,
    ) {}
}
