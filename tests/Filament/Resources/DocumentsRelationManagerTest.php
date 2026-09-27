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
use ReflectionProperty;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * M7 Stories A4.2 (#1906, the `upload` header action) and A4.3 (#1907, the
 * `download` / `edit` / `delete` row actions). After A4.3,
 * DocumentsRelationManager is removed from
 * RelationManagerConventionTest::PENDING.
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

    public function test_row_actions_are_download_edit_delete(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();
        $itemDocument = ItemDocument::factory()->forItem($item)->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(DocumentsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->assertTableActionExists('download')
            ->assertTableActionExists('edit')
            ->assertTableActionExists('delete')
            ->assertTableActionVisible('download', $itemDocument)
            ->assertTableActionVisible('edit', $itemDocument)
            ->assertTableActionVisible('delete', $itemDocument);
    }

    public function test_download_row_action_points_at_the_filament_download_route(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();
        $itemDocument = ItemDocument::factory()->forItem($item)->create();

        $this->setCurrentPanel();

        $component = Livewire::actingAs($user)
            ->test(DocumentsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ]);

        $table = $component->instance()->getTable();
        $action = null;
        foreach ($table->getActions() as $candidate) {
            if ($candidate->getName() === 'download') {
                $action = $candidate;

                break;
            }
        }

        $this->assertNotNull($action, 'The download row action must exist.');

        // The url() closure is an arrow function bound to the mounted
        // manager instance, so invoking it directly (bypassing Filament's
        // own action-evaluation machinery) still resolves $this->ownerItem()
        // correctly against the record this test mounted.
        $property = new ReflectionProperty($action, 'url');
        $property->setAccessible(true);
        $urlClosure = $property->getValue($action);

        $this->assertIsCallable($urlClosure);
        $actualUrl = $urlClosure($itemDocument);

        $expectedUrl = route('filament.admin.item-document.download', [
            'item' => $item,
            'itemDocument' => $itemDocument,
        ]);

        $this->assertSame($expectedUrl, $actualUrl);
    }

    public function test_download_row_action_is_hidden_for_a_view_only_user(): void
    {
        $user = $this->createViewOnlyUser();
        $item = Item::factory()->Object()->create();
        $itemDocument = ItemDocument::factory()->forItem($item)->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(DocumentsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->assertTableActionHidden('download', $itemDocument)
            ->assertTableActionHidden('edit', $itemDocument)
            ->assertTableActionHidden('delete', $itemDocument);
    }

    public function test_edit_action_updates_metadata_without_touching_the_file(): void
    {
        Storage::fake(Config::string('localstorage.documents.disk'));

        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();
        $language = Language::factory()->create();
        $itemDocument = ItemDocument::factory()->forItem($item)->create([
            'path' => 'unchanged.pdf',
            'title' => 'Old title',
            'display_order' => 1,
        ]);

        $directory = trim(Config::string('localstorage.documents.directory'), '/');
        Storage::disk(Config::string('localstorage.documents.disk'))->put($directory.'/unchanged.pdf', 'original-bytes');

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(DocumentsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->mountTableAction('edit', $itemDocument)
            ->setTableActionData([
                'title' => 'New title',
                'language_id' => $language->id,
                'display_order' => 7,
                'extra' => '{"reviewed":true}',
            ])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $itemDocument->refresh();
        $this->assertSame('New title', $itemDocument->title);
        $this->assertSame($language->id, $itemDocument->language_id);
        $this->assertSame(7, $itemDocument->display_order);
        $this->assertSame(['reviewed' => true], (array) $itemDocument->extra);
        // The file itself is untouched: same path, same bytes still on disk.
        $this->assertSame('unchanged.pdf', $itemDocument->path);
        Storage::disk(Config::string('localstorage.documents.disk'))
            ->assertExists($directory.'/unchanged.pdf');
    }

    public function test_delete_action_removes_the_record_and_its_file(): void
    {
        Storage::fake(Config::string('localstorage.documents.disk'));

        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();
        $itemDocument = ItemDocument::factory()->forItem($item)->create(['path' => 'to-delete.pdf']);

        $directory = trim(Config::string('localstorage.documents.directory'), '/');
        $disk = Config::string('localstorage.documents.disk');
        Storage::disk($disk)->put($directory.'/to-delete.pdf', 'bytes-to-remove');

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(DocumentsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->callTableAction('delete', $itemDocument)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('item_documents', ['id' => $itemDocument->id]);
        Storage::disk($disk)->assertMissing($directory.'/to-delete.pdf');
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
