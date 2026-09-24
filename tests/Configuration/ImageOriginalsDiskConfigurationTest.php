<?php

namespace Tests\Configuration;

use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ImageOriginalsDiskConfigurationTest extends TestCase
{
    public function test_image_originals_disk_is_configured(): void
    {
        $this->assertSame('local', config('filesystems.disks.image-originals.driver'));
    }

    public function test_image_originals_disk_has_no_public_url(): void
    {
        // Nothing about a pristine original should ever be web-reachable.
        $this->assertArrayNotHasKey('url', config('filesystems.disks.image-originals'));
        $this->assertNotSame('public', config('filesystems.disks.image-originals.visibility'));
    }

    public function test_image_originals_disk_root_is_distinct_from_public_and_local(): void
    {
        $root = config('filesystems.disks.image-originals.root');

        $this->assertNotSame(config('filesystems.disks.local.root'), $root);
        $this->assertNotSame(config('filesystems.disks.public.root'), $root);
    }

    public function test_image_originals_disk_is_writable(): void
    {
        Storage::fake('image-originals');

        Storage::disk('image-originals')->put('probe.txt', 'ok');

        Storage::disk('image-originals')->assertExists('probe.txt');
    }
}
