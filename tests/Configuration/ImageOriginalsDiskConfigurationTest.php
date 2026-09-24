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
        $this->assertStringStartsNotWith(config('filesystems.disks.public.root'), $root, 'Never under storage/app/public');
    }

    public function test_image_originals_are_shared_with_the_group_and_never_with_others(): void
    {
        // deploy (CLI) and www-data (PHP-FPM, the queue) share this disk
        $this->assertSame('private', config('filesystems.disks.image-originals.visibility'));
        $this->assertSame('private', config('filesystems.disks.image-originals.directory_visibility'));
        $this->assertSame([
            'file' => ['public' => 0660, 'private' => 0660],
            'dir' => ['public' => 0770, 'private' => 0770],
        ], config('filesystems.disks.image-originals.permissions'));
    }

    public function test_a_file_written_through_the_disk_gets_group_read_write_and_nothing_for_others(): void
    {
        // The real disk configuration, on a scratch root
        $root = sys_get_temp_dir().'/image-originals-'.uniqid();
        $disk = Storage::build(['root' => $root] + config('filesystems.disks.image-originals'));

        try {
            $disk->put('images/probe.jpg', 'original');

            // Flysystem chmods the file after writing it: the umask plays no part
            $this->assertSame(0660, fileperms($root.'/images/probe.jpg') & 0777);
            // A directory it creates gets 0770 narrowed by the umask: never more
            $this->assertSame(0, fileperms($root.'/images') & 0007);
        } finally {
            $disk->deleteDirectory('images');
            @rmdir($root);
        }
    }

    public function test_image_originals_disk_is_writable(): void
    {
        Storage::fake('image-originals');

        Storage::disk('image-originals')->put('probe.txt', 'ok');

        Storage::disk('image-originals')->assertExists('probe.txt');
    }
}
