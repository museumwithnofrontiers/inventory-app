<?php

namespace Tests\Console;

use App\Models\CollectionImage;
use App\Models\ItemImage;
use App\Models\PartnerImage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class SyncLegacyImagesCommandTest extends TestCase
{
    use RefreshDatabase;

    private string $privateDisk;

    private string $privateDirectory;

    private string $picturesDisk;

    private string $picturesDirectory;

    private string $sourceDir;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('image-originals');
        Storage::fake('public');

        config([
            'localstorage.available.images.disk' => 'image-originals',
            'localstorage.available.images.directory' => 'images',
            'localstorage.pictures.disk' => 'public',
            'localstorage.pictures.directory' => 'pictures',
        ]);

        $this->privateDisk = config('localstorage.available.images.disk');
        $this->privateDirectory = trim(config('localstorage.available.images.directory'), '/');
        $this->picturesDisk = config('localstorage.pictures.disk');
        $this->picturesDirectory = trim(config('localstorage.pictures.directory'), '/');

        // Create a temporary source directory for legacy images
        $this->sourceDir = sys_get_temp_dir().DIRECTORY_SEPARATOR.'legacy_images_test_'.uniqid();
        File::makeDirectory($this->sourceDir, 0755, true);
    }

    protected function tearDown(): void
    {
        // Clean up the temporary source directory
        if (File::isDirectory($this->sourceDir)) {
            File::deleteDirectory($this->sourceDir);
        }

        parent::tearDown();
    }

    public function test_command_fails_when_source_directory_does_not_exist(): void
    {
        $this->artisan('images:sync-legacy', [
            'source' => '/nonexistent/directory',
            '--force' => true,
        ])
            ->expectsOutput('Source directory does not exist: /nonexistent/directory')
            ->assertExitCode(1);
    }

    public function test_command_fails_with_invalid_table_option(): void
    {
        $this->artisan('images:sync-legacy', [
            'source' => $this->sourceDir,
            '--table' => ['invalid_table'],
            '--force' => true,
        ])
            ->assertExitCode(1);
    }

    public function test_command_succeeds_with_no_records_to_sync(): void
    {
        $this->artisan('images:sync-legacy', [
            'source' => $this->sourceDir,
            '--force' => true,
        ])
            ->assertExitCode(0);
    }

    public function test_command_syncs_item_images_to_the_private_originals_disk(): void
    {
        // Create a legacy image file
        $legacyRelative = 'objects/project1/image001.jpg';
        $legacyFullDir = $this->sourceDir.DIRECTORY_SEPARATOR.'objects'.DIRECTORY_SEPARATOR.'project1';
        File::makeDirectory($legacyFullDir, 0755, true);
        File::put($legacyFullDir.DIRECTORY_SEPARATOR.'image001.jpg', str_repeat('x', 1024));

        // Create an ItemImage record with size=1 (legacy placeholder)
        $image = ItemImage::factory()->create([
            'path' => $legacyRelative,
            'size' => 1,
            'original_name' => '',
        ]);

        $this->artisan('images:sync-legacy', [
            'source' => $this->sourceDir,
            '--table' => ['item_images'],
            '--force' => true,
        ])
            ->assertExitCode(0);

        $image->refresh();

        // Path should now be UUID-based filename
        $this->assertEquals($image->id.'.jpg', $image->path);
        // Size should be the actual file size
        $this->assertEquals(1024, $image->size);
        // Original name should be set to the legacy relative path
        $this->assertEquals($legacyRelative, $image->original_name);
        // File must land on the private image-originals disk, not the public one.
        Storage::disk($this->privateDisk)->assertExists($this->privateDirectory.'/'.$image->id.'.jpg');
        Storage::disk($this->picturesDisk)->assertMissing($this->picturesDirectory.'/'.$image->id.'.jpg');
    }

    public function test_command_syncs_partner_images_to_the_private_originals_disk(): void
    {
        // Create a legacy image file
        $legacyRelative = 'partners/logo.png';
        $legacyFullDir = $this->sourceDir.DIRECTORY_SEPARATOR.'partners';
        File::makeDirectory($legacyFullDir, 0755, true);
        File::put($legacyFullDir.DIRECTORY_SEPARATOR.'logo.png', str_repeat('y', 512));

        $image = PartnerImage::factory()->create([
            'path' => $legacyRelative,
            'size' => 1,
            'original_name' => '',
        ]);

        $this->artisan('images:sync-legacy', [
            'source' => $this->sourceDir,
            '--table' => ['partner_images'],
            '--force' => true,
        ])
            ->assertExitCode(0);

        $image->refresh();

        $this->assertEquals($image->id.'.png', $image->path);
        $this->assertEquals(512, $image->size);
        $this->assertEquals($legacyRelative, $image->original_name);
        Storage::disk($this->privateDisk)->assertExists($this->privateDirectory.'/'.$image->id.'.png');
        Storage::disk($this->picturesDisk)->assertMissing($this->picturesDirectory.'/'.$image->id.'.png');
    }

    public function test_command_syncs_collection_images_to_the_private_originals_disk(): void
    {
        // Create a legacy image file
        $legacyRelative = 'collections/cover.webp';
        $legacyFullDir = $this->sourceDir.DIRECTORY_SEPARATOR.'collections';
        File::makeDirectory($legacyFullDir, 0755, true);
        File::put($legacyFullDir.DIRECTORY_SEPARATOR.'cover.webp', str_repeat('z', 2048));

        $image = CollectionImage::factory()->create([
            'path' => $legacyRelative,
            'size' => 1,
            'original_name' => '',
        ]);

        $this->artisan('images:sync-legacy', [
            'source' => $this->sourceDir,
            '--table' => ['collection_images'],
            '--force' => true,
        ])
            ->assertExitCode(0);

        $image->refresh();

        $this->assertEquals($image->id.'.webp', $image->path);
        $this->assertEquals(2048, $image->size);
        $this->assertEquals($legacyRelative, $image->original_name);
        Storage::disk($this->privateDisk)->assertExists($this->privateDirectory.'/'.$image->id.'.webp');
        Storage::disk($this->picturesDisk)->assertMissing($this->picturesDirectory.'/'.$image->id.'.webp');
    }

    public function test_command_normalizes_leading_slashes_in_path(): void
    {
        // Legacy path with leading slash (common in legacy DB)
        $legacyRelative = '/objects/project1/image001.jpg';
        $legacyFullDir = $this->sourceDir.DIRECTORY_SEPARATOR.'objects'.DIRECTORY_SEPARATOR.'project1';
        File::makeDirectory($legacyFullDir, 0755, true);
        File::put($legacyFullDir.DIRECTORY_SEPARATOR.'image001.jpg', str_repeat('x', 256));

        $image = ItemImage::factory()->create([
            'path' => $legacyRelative,
            'size' => 1,
        ]);

        $this->artisan('images:sync-legacy', [
            'source' => $this->sourceDir,
            '--table' => ['item_images'],
            '--force' => true,
        ])
            ->assertExitCode(0);

        $image->refresh();
        $this->assertEquals($image->id.'.jpg', $image->path);
        $this->assertEquals(256, $image->size);
    }

    public function test_command_skips_records_with_size_not_equal_to_one(): void
    {
        // Create an ItemImage with size != 1 (already synced)
        ItemImage::factory()->create([
            'path' => 'already-synced.jpg',
            'size' => 50000,
        ]);

        $this->artisan('images:sync-legacy', [
            'source' => $this->sourceDir,
            '--table' => ['item_images'],
            '--force' => true,
        ])
            ->assertExitCode(0);
    }

    public function test_command_reports_error_when_legacy_file_missing(): void
    {
        // Create an ItemImage record pointing to a non-existent legacy file
        $image = ItemImage::factory()->create([
            'path' => 'nonexistent/image.jpg',
            'size' => 1,
        ]);

        $this->artisan('images:sync-legacy', [
            'source' => $this->sourceDir,
            '--table' => ['item_images'],
            '--force' => true,
        ])
            ->assertExitCode(1);

        // Record should not have been modified
        $image->refresh();
        $this->assertEquals(1, $image->size);
        $this->assertEquals('nonexistent/image.jpg', $image->path);
    }

    public function test_dry_run_does_not_modify_records(): void
    {
        // Create a legacy image file
        $legacyRelative = 'objects/dry-run-test.jpg';
        $legacyFullDir = $this->sourceDir.DIRECTORY_SEPARATOR.'objects';
        File::makeDirectory($legacyFullDir, 0755, true);
        File::put($legacyFullDir.DIRECTORY_SEPARATOR.'dry-run-test.jpg', str_repeat('d', 800));

        $image = ItemImage::factory()->create([
            'path' => $legacyRelative,
            'size' => 1,
            'original_name' => '',
        ]);

        $this->artisan('images:sync-legacy', [
            'source' => $this->sourceDir,
            '--table' => ['item_images'],
            '--dry-run' => true,
            '--force' => true,
        ])
            ->assertExitCode(0);

        // Record should NOT have been modified
        $image->refresh();
        $this->assertEquals(1, $image->size);
        $this->assertEquals($legacyRelative, $image->path);
        $this->assertEquals('', $image->original_name);
        // File should NOT exist in storage
        Storage::disk($this->privateDisk)->assertMissing($this->privateDirectory.'/'.$image->id.'.jpg');
    }

    public function test_command_handles_multiple_tables(): void
    {
        // Create legacy files
        $itemDir = $this->sourceDir.DIRECTORY_SEPARATOR.'items';
        File::makeDirectory($itemDir, 0755, true);
        File::put($itemDir.DIRECTORY_SEPARATOR.'item.jpg', str_repeat('i', 100));

        $partnerDir = $this->sourceDir.DIRECTORY_SEPARATOR.'partners';
        File::makeDirectory($partnerDir, 0755, true);
        File::put($partnerDir.DIRECTORY_SEPARATOR.'partner.png', str_repeat('p', 200));

        $itemImage = ItemImage::factory()->create([
            'path' => 'items/item.jpg',
            'size' => 1,
        ]);

        $partnerImage = PartnerImage::factory()->create([
            'path' => 'partners/partner.png',
            'size' => 1,
        ]);

        $this->artisan('images:sync-legacy', [
            'source' => $this->sourceDir,
            '--force' => true,
        ])
            ->assertExitCode(0);

        $itemImage->refresh();
        $partnerImage->refresh();

        $this->assertEquals($itemImage->id.'.jpg', $itemImage->path);
        $this->assertEquals(100, $itemImage->size);

        $this->assertEquals($partnerImage->id.'.png', $partnerImage->path);
        $this->assertEquals(200, $partnerImage->size);

        Storage::disk($this->privateDisk)->assertExists($this->privateDirectory.'/'.$itemImage->id.'.jpg');
        Storage::disk($this->privateDisk)->assertExists($this->privateDirectory.'/'.$partnerImage->id.'.png');
    }

    public function test_command_aborts_without_force_when_user_declines(): void
    {
        $this->artisan('images:sync-legacy', [
            'source' => $this->sourceDir,
        ])
            ->expectsConfirmation(
                'This will modify image files and database records. Continue?',
                'no'
            )
            ->expectsOutput('Aborted. No changes were made.')
            ->assertExitCode(0);
    }
}
