<?php

namespace Tests\Configuration;

use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * M7 Story A4.2 (#1906): `localstorage.documents.disk` moves off `public`
 * onto this new private disk before any real document upload ships.
 */
class DocumentOriginalsDiskConfigurationTest extends TestCase
{
    public function test_document_originals_disk_is_configured(): void
    {
        $this->assertSame('local', config('filesystems.disks.document-originals.driver'));
    }

    public function test_document_originals_disk_has_no_public_url(): void
    {
        // Nothing about a document original should ever be web-reachable.
        $this->assertArrayNotHasKey('url', config('filesystems.disks.document-originals'));
        $this->assertNotSame('public', config('filesystems.disks.document-originals.visibility'));
    }

    public function test_document_originals_disk_root_is_distinct_from_public_and_local(): void
    {
        $root = config('filesystems.disks.document-originals.root');

        $this->assertNotSame(config('filesystems.disks.local.root'), $root);
        $this->assertNotSame(config('filesystems.disks.public.root'), $root);
        $this->assertStringStartsNotWith(config('filesystems.disks.public.root'), $root, 'Never under storage/app/public');
    }

    public function test_localstorage_documents_disk_defaults_to_the_private_disk(): void
    {
        $this->assertSame('document-originals', config('localstorage.documents.disk'));
        $this->assertNotSame('public', config('localstorage.documents.disk'));
    }

    public function test_document_originals_disk_is_writable(): void
    {
        Storage::fake('document-originals');

        Storage::disk('document-originals')->put('probe.txt', 'ok');

        Storage::disk('document-originals')->assertExists('probe.txt');
    }
}
