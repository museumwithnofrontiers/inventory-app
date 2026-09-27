<?php

namespace Tests\Filament\Resources;

use App\Models\Item;
use App\Models\ItemDocument;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * M7 Story A4.3 (#1907): the Filament-registered `item-document.download`
 * route, which reuses App\Http\Controllers\ItemDocumentController::download
 * rather than reimplementing the disk/path/FileResponse logic.
 *
 * Stricter than the existing Filament image routes (FilamentImageRoutesTest):
 * per #1907's rule, this route requires `update` on the Item via ItemPolicy,
 * not just the panel's login requirement.
 */
class FilamentDocumentRoutesTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_filament_item_document_download_route_returns_attachment_for_an_authorized_user(): void
    {
        $disk = Config::string('localstorage.documents.disk');
        Storage::fake($disk);

        $item = Item::factory()->Object()->create();
        $itemDocument = ItemDocument::factory()->forItem($item)->create(['path' => 'report.pdf', 'original_name' => 'report.pdf']);

        $directory = trim(Config::string('localstorage.documents.directory'), '/');
        Storage::disk($disk)->put($directory.'/'.$itemDocument->path, '%PDF-1.4 fake-pdf-data');

        $user = $this->createCrudUser();

        $response = $this->actingAs($user)->get(
            route('filament.admin.item-document.download', ['item' => $item, 'itemDocument' => $itemDocument])
        );

        $response->assertOk();
        $this->assertStringContainsString('attachment', $response->headers->get('Content-Disposition') ?? '');
    }

    public function test_filament_item_document_download_route_forbids_a_view_only_user(): void
    {
        $disk = Config::string('localstorage.documents.disk');
        Storage::fake($disk);

        $item = Item::factory()->Object()->create();
        $itemDocument = ItemDocument::factory()->forItem($item)->create(['path' => 'report.pdf', 'original_name' => 'report.pdf']);

        $directory = trim(Config::string('localstorage.documents.directory'), '/');
        Storage::disk($disk)->put($directory.'/'.$itemDocument->path, '%PDF-1.4 fake-pdf-data');

        $user = $this->createViewOnlyUser();

        $this->actingAs($user)->get(
            route('filament.admin.item-document.download', ['item' => $item, 'itemDocument' => $itemDocument])
        )->assertForbidden();
    }

    public function test_filament_item_document_download_route_returns_404_for_mismatched_item(): void
    {
        $disk = Config::string('localstorage.documents.disk');
        Storage::fake($disk);

        $item1 = Item::factory()->Object()->create();
        $item2 = Item::factory()->Object()->create();
        $itemDocument = ItemDocument::factory()->forItem($item1)->create(['path' => 'mismatch.pdf', 'original_name' => 'mismatch.pdf']);

        $user = $this->createCrudUser();

        $this->actingAs($user)->get(
            route('filament.admin.item-document.download', ['item' => $item2, 'itemDocument' => $itemDocument])
        )->assertNotFound();
    }

    public function test_unauthenticated_users_cannot_access_the_item_document_download_route(): void
    {
        $disk = Config::string('localstorage.documents.disk');
        Storage::fake($disk);

        $item = Item::factory()->Object()->create();
        $itemDocument = ItemDocument::factory()->forItem($item)->create(['path' => 'report.pdf', 'original_name' => 'report.pdf']);

        $this->get(
            route('filament.admin.item-document.download', ['item' => $item, 'itemDocument' => $itemDocument])
        )->assertRedirect('/admin/login');
    }
}
