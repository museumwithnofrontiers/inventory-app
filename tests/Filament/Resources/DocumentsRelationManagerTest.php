<?php

namespace Tests\Filament\Resources;

use App\Filament\Resources\ItemResource\Pages\ViewItem;
use App\Filament\Resources\ItemResource\RelationManagers\DocumentsRelationManager;
use App\Models\Item;
use App\Models\ItemDocument;
use App\Models\Language;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * M7 Story A4.2 (#1906): the `upload` header action on DocumentsRelationManager.
 * DocumentsRelationManager stays on RelationManagerConventionTest::PENDING
 * after this story — its row actions are still [delete] only, not the full
 * [download, edit, delete] target A4.3 delivers.
 */
class DocumentsRelationManagerTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    private function validPdf(string $name = 'report.pdf'): UploadedFile
    {
        // A real "%PDF-" magic header so both Filament's own acceptedFileTypes
        // rule and DocumentUploadListener's real MIME guess recognise it,
        // padded past the configured minimum upload size (1 KB by default).
        $content = "%PDF-1.4\n".str_repeat("% padding line for the test fixture\n", 40).'%%EOF';

        return UploadedFile::fake()->createWithContent($name, $content);
    }

    public function test_documents_relation_manager_renders(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(DocumentsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->assertSuccessful();
    }

    public function test_upload_header_action_is_visible_for_a_crud_user(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(DocumentsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->assertTableHeaderActionsExistInOrder(['upload']);
    }

    public function test_upload_header_action_is_hidden_for_a_view_only_user(): void
    {
        $user = $this->createViewOnlyUser();
        $item = Item::factory()->Object()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(DocumentsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->assertTableActionHidden('upload');
    }

    public function test_row_actions_are_still_delete_only_pending_a43(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();
        ItemDocument::factory()->forItem($item)->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(DocumentsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->assertTableActionExists('delete')
            ->assertTableActionDoesNotExist('download')
            ->assertTableActionDoesNotExist('edit');
    }

    public function test_uploading_a_valid_pdf_from_the_item_view_page_creates_an_item_document(): void
    {
        Storage::fake('local');
        Storage::fake(Config::string('localstorage.documents.disk'));

        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();
        $language = Language::factory()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(DocumentsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->mountTableAction('upload')
            ->setTableActionData([
                'file' => $this->validPdf(),
                'language_id' => $language->id,
                'title' => 'Condition report',
                'display_order' => 3,
            ])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseCount('document_uploads', 0);

        $itemDocument = ItemDocument::where('item_id', $item->id)->first();
        $this->assertNotNull($itemDocument);
        $this->assertSame('report.pdf', $itemDocument->original_name);
        $this->assertSame($language->id, $itemDocument->language_id);
        $this->assertSame('Condition report', $itemDocument->title);
        $this->assertSame(3, $itemDocument->display_order);
        $this->assertSame('application/pdf', $itemDocument->mime_type);

        $directory = trim(Config::string('localstorage.documents.directory'), '/');
        Storage::disk(Config::string('localstorage.documents.disk'))
            ->assertExists($directory.'/'.$itemDocument->path);
    }
}
