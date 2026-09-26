<?php

namespace Tests\Filament\Resources;

use App\Models\AvailableImage;
use App\Models\Collection;
use App\Models\CollectionImage;
use App\Models\Item;
use App\Models\ItemImage;
use App\Models\Partner;
use App\Models\PartnerImage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

class FilamentImageRoutesTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_filament_available_image_view_route_returns_image_inline(): void
    {
        $disk = config('localstorage.available.images.disk');
        Storage::fake($disk);
        Storage::disk($disk)->makeDirectory('images');

        $availableImage = AvailableImage::factory()->create(['path' => 'avail-test.jpg']);
        $imagePath = trim(config('localstorage.available.images.directory'), '/').'/'.$availableImage->path;
        Storage::disk($disk)->put($imagePath, 'fake-jpeg-data');

        $user = $this->createViewOnlyUser();

        $response = $this->actingAs($user)->get(
            route('filament.admin.available-image.view', ['availableImage' => $availableImage])
        );

        $response->assertOk();
        $this->assertStringNotContainsString('attachment', $response->headers->get('Content-Disposition') ?? '');
    }

    public function test_filament_available_image_download_route_returns_attachment(): void
    {
        $disk = config('localstorage.available.images.disk');
        Storage::fake($disk);
        Storage::disk($disk)->makeDirectory('images');

        $availableImage = AvailableImage::factory()->create(['path' => 'avail-download-test.jpg']);
        $imagePath = trim(config('localstorage.available.images.directory'), '/').'/'.$availableImage->path;
        Storage::disk($disk)->put($imagePath, 'fake-jpeg-data');

        $user = $this->createViewOnlyUser();

        $response = $this->actingAs($user)->get(
            route('filament.admin.available-image.download', ['availableImage' => $availableImage])
        );

        $response->assertOk();
        $this->assertStringContainsString('attachment', $response->headers->get('Content-Disposition') ?? '');
    }

    public function test_filament_item_image_view_route_returns_image_inline(): void
    {
        $disk = config('localstorage.available.images.disk');
        Storage::fake($disk);
        Storage::disk($disk)->makeDirectory('images');

        $item = Item::factory()->Object()->create();
        $itemImage = ItemImage::factory()->forItem($item)->create(['path' => 'item-view-test.jpg']);
        $imagesDir = trim(config('localstorage.available.images.directory'), '/');
        Storage::disk($disk)->put($imagesDir.'/'.$itemImage->path, 'fake-jpeg-data');

        $user = $this->createViewOnlyUser();

        $response = $this->actingAs($user)->get(
            route('filament.admin.item-image.view', ['item' => $item, 'itemImage' => $itemImage])
        );

        $response->assertOk();
        $this->assertStringNotContainsString('attachment', $response->headers->get('Content-Disposition') ?? '');
        // The admin panel shows the original, not the burned rendition the API and /pub serve
        $this->assertInstanceOf(BinaryFileResponse::class, $response->baseResponse);
        $this->assertSame('fake-jpeg-data', $response->baseResponse->getFile()->getContent());
    }

    public function test_filament_item_image_view_route_returns_404_for_mismatched_item(): void
    {
        Storage::fake('public');

        $item1 = Item::factory()->Object()->create();
        $item2 = Item::factory()->Object()->create();
        $itemImage = ItemImage::factory()->forItem($item1)->create(['path' => 'mismatch-test.jpg']);

        $user = $this->createViewOnlyUser();

        $this->actingAs($user)->get(
            route('filament.admin.item-image.view', ['item' => $item2, 'itemImage' => $itemImage])
        )->assertNotFound();
    }

    public function test_filament_item_image_download_route_returns_attachment(): void
    {
        $disk = config('localstorage.available.images.disk');
        Storage::fake($disk);
        Storage::disk($disk)->makeDirectory('images');

        $item = Item::factory()->Object()->create();
        $itemImage = ItemImage::factory()->forItem($item)->create(['path' => 'item-download-test.jpg']);
        $imagesDir = trim(config('localstorage.available.images.directory'), '/');
        Storage::disk($disk)->put($imagesDir.'/'.$itemImage->path, 'fake-jpeg-data');

        $user = $this->createViewOnlyUser();

        $response = $this->actingAs($user)->get(
            route('filament.admin.item-image.download', ['item' => $item, 'itemImage' => $itemImage])
        );

        $response->assertOk();
        $this->assertStringContainsString('attachment', $response->headers->get('Content-Disposition') ?? '');
    }

    public function test_filament_collection_image_view_route_returns_404_for_mismatched_collection(): void
    {
        Storage::fake('public');

        $collection1 = Collection::factory()->create();
        $collection2 = Collection::factory()->create();
        $collectionImage = CollectionImage::factory()->forCollection($collection1)->create(['path' => 'col-mismatch.jpg']);

        $user = $this->createViewOnlyUser();

        $this->actingAs($user)->get(
            route('filament.admin.collection-image.view', ['collection' => $collection2, 'collectionImage' => $collectionImage])
        )->assertNotFound();
    }

    public function test_filament_partner_image_view_route_returns_404_for_mismatched_partner(): void
    {
        Storage::fake('public');

        $partner1 = Partner::factory()->create();
        $partner2 = Partner::factory()->create();
        $partnerImage = PartnerImage::factory()->forPartner($partner1)->create(['path' => 'par-mismatch.jpg']);

        $user = $this->createViewOnlyUser();

        $this->actingAs($user)->get(
            route('filament.admin.partner-image.view', ['partner' => $partner2, 'partnerImage' => $partnerImage])
        )->assertNotFound();
    }

    public function test_unauthenticated_users_cannot_access_filament_image_routes(): void
    {
        Storage::fake('public');

        $availableImage = AvailableImage::factory()->create(['path' => 'auth-test.jpg']);

        $this->get(
            route('filament.admin.available-image.view', ['availableImage' => $availableImage])
        )->assertRedirect('/admin/login');
    }
}
