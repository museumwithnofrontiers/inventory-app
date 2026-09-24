<?php

namespace Tests\Filament\Resources;

use App\Enums\Permission;
use App\Filament\Resources\AvailableImageResource\Pages\ListAvailableImage;
use App\Models\AvailableImage;
use App\Models\Item;
use App\Models\ItemImage;
use App\Models\Partner;
use App\Models\PartnerImage;
use App\Models\User;
use Filament\Facades\Filament;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Livewire\Livewire;
use Tests\TestCase;

class AvailableImageSmokeTest extends TestCase
{
    use RefreshDatabase;

    public function test_available_image_resource_handles_a_one_thousand_image_pool(): void
    {
        Storage::fake('local');
        Storage::fake('public');
        Storage::disk('public')->makeDirectory('images');

        $user = $this->createAuthorizedUser();
        $this->seedAvailableImages(1_000);

        DB::flushQueryLog();
        DB::enableQueryLog();

        $response = $this->actingAs($user)->get('/admin/available-images');

        $response->assertOk();
        $this->assertLessThan(20, count(DB::getQueryLog()));
        $this->assertLessThan(2 * 1024 * 1024, strlen($response->getContent()));
        DB::disableQueryLog();

        $this->setCurrentPanel();

        $expectedFirstPage = AvailableImage::query()
            ->orderBy('created_at', 'desc')
            ->limit(10)
            ->get();

        $target = AvailableImage::query()
            ->where('path', 'like', '%img-00999%')
            ->firstOrFail();

        Livewire::actingAs($user)
            ->test(ListAvailableImage::class)
            ->assertCanSeeTableRecords($expectedFirstPage)
            ->searchTable('img-00999')
            ->assertCanSeeTableRecords([$target]);
    }

    public function test_attach_image_moves_file_from_images_to_pictures_and_removes_from_pool(): void
    {
        Storage::fake('local');
        Storage::fake('public');
        Storage::disk('public')->makeDirectory('images');
        Storage::disk('public')->makeDirectory('pictures');

        $availableImage = AvailableImage::factory()->create(['path' => 'test-image.jpg']);
        $imagePath = trim(config('localstorage.available.images.directory'), '/').'/'.$availableImage->path;
        Storage::disk('public')->put($imagePath, 'fake-image-data');

        $item = Item::factory()->Object()->create();

        $itemImage = ItemImage::attachFromAvailableImage($availableImage, $item->id, 'A test image');

        $this->assertDatabaseMissing('available_images', ['id' => $availableImage->id]);
        $this->assertDatabaseHas('item_images', [
            'id' => $availableImage->id,
            'item_id' => $item->id,
            'path' => 'test-image.jpg',
            'alt_text' => 'A test image',
        ]);

        $picturesDir = trim(config('localstorage.pictures.directory'), '/');
        Storage::disk(config('localstorage.pictures.disk'))->assertExists($picturesDir.'/test-image.jpg');
        Storage::disk(config('localstorage.available.images.disk'))->assertMissing($imagePath);
    }

    public function test_detach_image_moves_file_from_pictures_to_images_and_returns_to_pool(): void
    {
        Storage::fake('local');
        Storage::fake('public');
        Storage::disk('public')->makeDirectory('images');
        Storage::disk('public')->makeDirectory('pictures');

        $item = Item::factory()->Object()->create();
        $itemImage = ItemImage::factory()->forItem($item)->create(['path' => 'test-detach.jpg']);

        $picturesDir = trim(config('localstorage.pictures.directory'), '/');
        Storage::disk(config('localstorage.pictures.disk'))->put($picturesDir.'/test-detach.jpg', 'fake-image-data');

        $attachedId = $itemImage->id;

        $availableImage = $itemImage->detachToAvailableImage();

        $this->assertDatabaseMissing('item_images', ['id' => $attachedId]);
        $this->assertDatabaseHas('available_images', [
            'id' => $attachedId,
            'path' => 'test-detach.jpg',
        ]);

        $imagesDir = trim(config('localstorage.available.images.directory'), '/');
        Storage::disk(config('localstorage.available.images.disk'))->assertExists($imagesDir.'/test-detach.jpg');
        Storage::disk(config('localstorage.pictures.disk'))->assertMissing($picturesDir.'/test-detach.jpg');
    }

    public function test_same_image_cannot_be_attached_to_two_entities(): void
    {
        Storage::fake('local');
        Storage::fake('public');
        Storage::disk('public')->makeDirectory('images');
        Storage::disk('public')->makeDirectory('pictures');

        $availableImage = AvailableImage::factory()->create(['path' => 'unique-image.jpg']);
        $imagePath = trim(config('localstorage.available.images.directory'), '/').'/'.$availableImage->path;
        Storage::disk('public')->put($imagePath, 'fake-image-data');

        $item1 = Item::factory()->Object()->create();
        $item2 = Item::factory()->Object()->create();

        ItemImage::attachFromAvailableImage($availableImage, $item1->id);

        $this->assertDatabaseMissing('available_images', ['id' => $availableImage->id]);

        $this->expectException(ModelNotFoundException::class);
        AvailableImage::findOrFail($availableImage->id);
    }

    public function test_partner_attach_and_detach_works_correctly(): void
    {
        Storage::fake('local');
        Storage::fake('public');
        Storage::disk('public')->makeDirectory('images');
        Storage::disk('public')->makeDirectory('pictures');

        $availableImage = AvailableImage::factory()->create(['path' => 'partner-image.jpg']);
        $imagePath = trim(config('localstorage.available.images.directory'), '/').'/'.$availableImage->path;
        Storage::disk('public')->put($imagePath, 'fake-image-data');

        $partner = Partner::factory()->create();

        $partnerImage = PartnerImage::attachFromAvailableImage($availableImage, $partner->id, 'Partner image');

        $this->assertDatabaseMissing('available_images', ['id' => $availableImage->id]);
        $this->assertDatabaseHas('partner_images', [
            'id' => $availableImage->id,
            'partner_id' => $partner->id,
            'alt_text' => 'Partner image',
        ]);

        $attachedId = $partnerImage->id;
        $partnerImage->detachToAvailableImage();

        $this->assertDatabaseMissing('partner_images', ['id' => $attachedId]);
        $this->assertDatabaseHas('available_images', ['id' => $attachedId]);
    }

    public function test_metadata_is_preserved_through_attach_to_item(): void
    {
        Storage::fake('local');
        Storage::fake('public');
        Storage::disk('public')->makeDirectory('images');
        Storage::disk('public')->makeDirectory('pictures');

        $availableImage = AvailableImage::factory()->create([
            'path' => 'meta-test.jpg',
            'original_name' => 'my-original-photo.jpg',
            'mime_type' => 'image/jpeg',
            'size' => 12345,
            'copyright' => '© Meta Test',
        ]);
        Storage::disk('public')->put(
            trim(config('localstorage.available.images.directory'), '/').'/'.$availableImage->path,
            'fake-image-data'
        );

        $item = Item::factory()->Object()->create();
        $itemImage = ItemImage::attachFromAvailableImage($availableImage, $item->id, 'Alt text');

        $this->assertDatabaseHas('item_images', [
            'id' => $availableImage->id,
            'original_name' => 'my-original-photo.jpg',
            'mime_type' => 'image/jpeg',
            'size' => 12345,
            'copyright' => '© Meta Test',
        ]);
        $this->assertEquals($availableImage->id, $itemImage->id);
        $this->assertEquals('my-original-photo.jpg', $itemImage->original_name);
        $this->assertEquals('image/jpeg', $itemImage->mime_type);
        $this->assertEquals(12345, $itemImage->size);
        $this->assertEquals('© Meta Test', $itemImage->copyright);
    }

    public function test_metadata_is_preserved_through_detach_from_item(): void
    {
        Storage::fake('local');
        Storage::fake('public');
        Storage::disk('public')->makeDirectory('images');
        Storage::disk('public')->makeDirectory('pictures');

        $item = Item::factory()->Object()->create();
        $itemImage = ItemImage::factory()->forItem($item)->create([
            'path' => 'detach-meta.jpg',
            'original_name' => 'original-upload.jpg',
            'mime_type' => 'image/png',
            'size' => 98765,
            'copyright' => '© Detach Meta',
        ]);
        Storage::disk(config('localstorage.pictures.disk'))->put(
            trim(config('localstorage.pictures.directory'), '/').'/detach-meta.jpg',
            'fake-image-data'
        );

        $attachedId = $itemImage->id;
        $availableImage = $itemImage->detachToAvailableImage();

        $this->assertEquals($attachedId, $availableImage->id);
        $this->assertEquals('original-upload.jpg', $availableImage->original_name);
        $this->assertEquals('image/png', $availableImage->mime_type);
        $this->assertEquals(98765, $availableImage->size);
        $this->assertEquals('© Detach Meta', $availableImage->copyright);
        $this->assertDatabaseHas('available_images', [
            'id' => $attachedId,
            'original_name' => 'original-upload.jpg',
            'mime_type' => 'image/png',
            'size' => 98765,
            'copyright' => '© Detach Meta',
        ]);
    }

    public function test_metadata_survives_full_detach_and_reattach_roundtrip(): void
    {
        Storage::fake('local');
        Storage::fake('public');
        Storage::disk('public')->makeDirectory('images');
        Storage::disk('public')->makeDirectory('pictures');

        $availableImage = AvailableImage::factory()->create([
            'path' => 'roundtrip.jpg',
            'original_name' => 'roundtrip-upload.jpg',
            'mime_type' => 'image/jpeg',
            'size' => 55555,
            'copyright' => '© Roundtrip',
        ]);
        Storage::disk('public')->put(
            trim(config('localstorage.available.images.directory'), '/').'/roundtrip.jpg',
            'fake-image-data'
        );

        $item = Item::factory()->Object()->create();
        $originalId = $availableImage->id;

        // Attach
        $itemImage = ItemImage::attachFromAvailableImage($availableImage, $item->id);
        $this->assertEquals($originalId, $itemImage->id);
        $this->assertEquals('roundtrip-upload.jpg', $itemImage->original_name);
        $this->assertEquals('© Roundtrip', $itemImage->copyright);

        // Detach
        $availableImage2 = $itemImage->detachToAvailableImage();
        $this->assertEquals($originalId, $availableImage2->id);
        $this->assertEquals('roundtrip-upload.jpg', $availableImage2->original_name);
        $this->assertEquals('image/jpeg', $availableImage2->mime_type);
        $this->assertEquals(55555, $availableImage2->size);
        $this->assertEquals('© Roundtrip', $availableImage2->copyright);

        // Re-attach to another item
        $item2 = Item::factory()->Object()->create();
        $availableImage2->refresh();
        $itemImage2 = ItemImage::attachFromAvailableImage($availableImage2, $item2->id);
        $this->assertEquals($originalId, $itemImage2->id);
        $this->assertEquals('roundtrip-upload.jpg', $itemImage2->original_name);
        $this->assertEquals('image/jpeg', $itemImage2->mime_type);
        $this->assertEquals(55555, $itemImage2->size);
        $this->assertEquals('© Roundtrip', $itemImage2->copyright);
    }

    public function test_metadata_is_preserved_through_partner_attach_and_detach(): void
    {
        Storage::fake('local');
        Storage::fake('public');
        Storage::disk('public')->makeDirectory('images');
        Storage::disk('public')->makeDirectory('pictures');

        $availableImage = AvailableImage::factory()->create([
            'path' => 'partner-meta.jpg',
            'original_name' => 'partner-original.jpg',
            'mime_type' => 'image/jpeg',
            'size' => 77777,
            'copyright' => '© Partner Meta',
        ]);
        Storage::disk('public')->put(
            trim(config('localstorage.available.images.directory'), '/').'/partner-meta.jpg',
            'fake-image-data'
        );

        $partner = Partner::factory()->create();
        $originalId = $availableImage->id;

        $partnerImage = PartnerImage::attachFromAvailableImage($availableImage, $partner->id);
        $this->assertEquals($originalId, $partnerImage->id);
        $this->assertEquals('partner-original.jpg', $partnerImage->original_name);
        $this->assertEquals('© Partner Meta', $partnerImage->copyright);

        $returned = $partnerImage->detachToAvailableImage();
        $this->assertEquals($originalId, $returned->id);
        $this->assertEquals('partner-original.jpg', $returned->original_name);
        $this->assertEquals('image/jpeg', $returned->mime_type);
        $this->assertEquals(77777, $returned->size);
        $this->assertEquals('© Partner Meta', $returned->copyright);
    }

    protected function createAuthorizedUser(): User
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo([
            Permission::ACCESS_ADMIN_PANEL->value,
            Permission::VIEW_DATA->value,
        ]);

        return $user;
    }

    protected function seedAvailableImages(int $count): void
    {
        $timestamp = Carbon::now();

        $rows = [];
        for ($i = 0; $i < $count; $i++) {
            $rows[] = [
                'id' => Str::uuid()->toString(),
                'path' => sprintf('img-%05d.jpg', $i),
                'comment' => sprintf('Image number %05d', $i),
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ];
        }

        foreach (array_chunk($rows, 500) as $chunk) {
            AvailableImage::query()->insert($chunk);
        }

        foreach ($rows as $row) {
            $dir = trim(config('localstorage.available.images.directory'), '/');
            Storage::disk('public')->put($dir.'/'.$row['path'], 'fake-image');
        }
    }

    protected function setCurrentPanel(): void
    {
        Filament::setCurrentPanel(Filament::getPanel('admin'));
    }
}
