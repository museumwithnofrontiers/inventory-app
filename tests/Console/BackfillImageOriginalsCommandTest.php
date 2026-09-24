<?php

namespace Tests\Console;

use App\Models\Collection;
use App\Models\CollectionImage;
use App\Models\Item;
use App\Models\ItemImage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class BackfillImageOriginalsCommandTest extends TestCase
{
    use RefreshDatabase;

    private string $privateDisk;

    private string $privateDirectory;

    private string $picturesDisk;

    private string $picturesDirectory;

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
    }

    private function putPublicOnlyImage(string $filename): void
    {
        Storage::disk($this->picturesDisk)->put($this->picturesDirectory.'/'.$filename, 'public-bytes-'.$filename);
    }

    public function test_copies_public_file_to_private_disk_and_empties_the_public_disk(): void
    {
        $image = ItemImage::factory()->forItem(Item::factory()->Object()->create())->create(['path' => 'backfill-me.jpg']);
        $this->putPublicOnlyImage('backfill-me.jpg');

        $this->artisan('images:backfill-originals', ['--force' => true])
            ->assertExitCode(0);

        Storage::disk($this->privateDisk)->assertExists($this->privateDirectory.'/backfill-me.jpg');
        $this->assertSame('public-bytes-backfill-me.jpg', Storage::disk($this->privateDisk)->get($this->privateDirectory.'/backfill-me.jpg'));
        Storage::disk($this->picturesDisk)->assertMissing($this->picturesDirectory.'/backfill-me.jpg');

        $this->assertNotNull($image);
    }

    public function test_processes_every_registered_model_not_a_hardcoded_subset(): void
    {
        ItemImage::factory()->forItem(Item::factory()->Object()->create())->create(['path' => 'item-one.jpg']);
        $this->putPublicOnlyImage('item-one.jpg');

        CollectionImage::factory()->create(['collection_id' => Collection::factory()->create()->id, 'path' => 'collection-one.jpg']);
        $this->putPublicOnlyImage('collection-one.jpg');

        $this->artisan('images:backfill-originals', ['--force' => true])
            ->assertExitCode(0);

        Storage::disk($this->privateDisk)->assertExists($this->privateDirectory.'/item-one.jpg');
        Storage::disk($this->privateDisk)->assertExists($this->privateDirectory.'/collection-one.jpg');
        Storage::disk($this->picturesDisk)->assertMissing($this->picturesDirectory.'/item-one.jpg');
        Storage::disk($this->picturesDisk)->assertMissing($this->picturesDirectory.'/collection-one.jpg');
    }

    public function test_dry_run_makes_no_changes(): void
    {
        ItemImage::factory()->forItem(Item::factory()->Object()->create())->create(['path' => 'untouched.jpg']);
        $this->putPublicOnlyImage('untouched.jpg');

        $this->artisan('images:backfill-originals', ['--dry-run' => true])
            ->assertExitCode(0);

        Storage::disk($this->privateDisk)->assertMissing($this->privateDirectory.'/untouched.jpg');
        Storage::disk($this->picturesDisk)->assertExists($this->picturesDirectory.'/untouched.jpg');
    }

    public function test_already_backfilled_image_is_skipped_without_error(): void
    {
        ItemImage::factory()->forItem(Item::factory()->Object()->create())->create(['path' => 'already-done.jpg']);
        Storage::disk($this->privateDisk)->put($this->privateDirectory.'/already-done.jpg', 'already-private');

        $this->artisan('images:backfill-originals', ['--force' => true])
            ->assertExitCode(0);

        $this->assertSame('already-private', Storage::disk($this->privateDisk)->get($this->privateDirectory.'/already-done.jpg'));
    }

    public function test_stray_public_file_is_removed_when_private_original_already_exists(): void
    {
        ItemImage::factory()->forItem(Item::factory()->Object()->create())->create(['path' => 'stray.jpg']);
        Storage::disk($this->privateDisk)->put($this->privateDirectory.'/stray.jpg', 'private-bytes');
        $this->putPublicOnlyImage('stray.jpg');

        $this->artisan('images:backfill-originals', ['--force' => true])
            ->assertExitCode(0);

        // The private original is untouched - never overwritten by the stray public copy.
        $this->assertSame('private-bytes', Storage::disk($this->privateDisk)->get($this->privateDirectory.'/stray.jpg'));
        Storage::disk($this->picturesDisk)->assertMissing($this->picturesDirectory.'/stray.jpg');
    }

    public function test_reports_error_and_continues_when_neither_file_exists(): void
    {
        ItemImage::factory()->forItem(Item::factory()->Object()->create())->create(['path' => 'missing-everywhere.jpg']);
        ItemImage::factory()->forItem(Item::factory()->Object()->create())->create(['path' => 'present.jpg']);
        $this->putPublicOnlyImage('present.jpg');

        $this->artisan('images:backfill-originals', ['--force' => true])
            ->assertExitCode(1);

        Storage::disk($this->privateDisk)->assertExists($this->privateDirectory.'/present.jpg');
        Storage::disk($this->privateDisk)->assertMissing($this->privateDirectory.'/missing-everywhere.jpg');
    }

    public function test_confirmation_is_required_without_force(): void
    {
        ItemImage::factory()->forItem(Item::factory()->Object()->create())->create(['path' => 'needs-confirm.jpg']);
        $this->putPublicOnlyImage('needs-confirm.jpg');

        $this->artisan('images:backfill-originals')
            ->expectsConfirmation(
                'This will copy files to the private disk and remove them from the public disk. Continue?',
                'no'
            )
            ->expectsOutput('Aborted. No changes were made.')
            ->assertExitCode(0);

        Storage::disk($this->privateDisk)->assertMissing($this->privateDirectory.'/needs-confirm.jpg');
    }

    public function test_no_records_succeeds_without_confirmation(): void
    {
        $this->artisan('images:backfill-originals')
            ->assertExitCode(0);
    }

    public function test_backfilled_image_burns_correctly_on_first_subsequent_request(): void
    {
        // A genuinely decodable minimal JPEG - see Tests\Pub\PictureControllerTest.
        $minimalJpeg = base64_decode('/9j/4AAQSkZJRgABAQEAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=');

        $filename = Str::uuid()->toString().'.jpg';

        $image = ItemImage::factory()->forItem(Item::factory()->Object()->create())->create([
            'path' => $filename,
            'copyright' => 'Backfilled Owner',
            'mime_type' => 'image/jpeg',
        ]);
        Storage::disk($this->picturesDisk)->put($this->picturesDirectory.'/'.$filename, $minimalJpeg);

        $this->artisan('images:backfill-originals', ['--force' => true])
            ->assertExitCode(0);

        Storage::disk($this->privateDisk)->assertExists($this->privateDirectory.'/'.$filename);
        Storage::disk($this->picturesDisk)->assertMissing($this->picturesDirectory.'/'.$filename);

        $response = $this->get(route('pub.picture', ['filename' => $filename]));

        $response->assertOk();
        Storage::disk($this->picturesDisk)->assertExists($this->picturesDirectory.'/'.$filename);
        $this->assertNotNull($image);
    }
}
