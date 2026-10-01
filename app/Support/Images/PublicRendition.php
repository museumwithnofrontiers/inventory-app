<?php

namespace App\Support\Images;

/**
 * The bytes of an image's public rendition, with the ETag they were
 * produced for - or null when nothing records what they are, and no client
 * may keep them - and whether this request burned them, rather than finding
 * them cached.
 */
final readonly class PublicRendition
{
    public function __construct(
        public string $contents,
        public ?string $etag,
        public bool $burned = false,
    ) {}
}
