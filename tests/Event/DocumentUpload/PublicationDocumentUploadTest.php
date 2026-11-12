<?php

namespace Tests\Event\DocumentUpload;

use App\Events\DocumentUploadEvent;
use App\Models\DocumentUpload;
use App\Models\Item;
use App\Models\ItemDocument;
use App\Models\Publication;
use App\Models\PublicationDocument;
use App\Models\PublicationEdition;
use App\Models\User;
use App\Notifications\ItemDocumentUploadRejected;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use LogicException;
use Tests\TestCase;

/**
 * A publication's PDF goes through the document pipeline with the real
 * event: pending on the private uploads disk, validated, moved to the
 * private documents disk as a PublicationDocument named by its UUID.
 */
class PublicationDocumentUploadTest extends TestCase
{
    use RefreshDatabase;

    private function validPdfContent(): string
    {
        return "%PDF-1.4\n".str_repeat("% padding line for the test fixture\n", 40).'%%EOF';
    }

    private function putPending(string $filename, string $content): void
    {
        $directory = trim(Config::string('localstorage.uploads.documents.directory'), '/');
        Storage::disk(Config::string('localstorage.uploads.documents.disk'))->put($directory.'/'.$filename, $content);
    }

    public function test_a_valid_upload_becomes_a_publication_document_named_by_its_uuid(): void
    {
        Storage::fake('local');
        Storage::fake('public');
        Storage::fake(Config::string('localstorage.documents.disk'));

        $edition = PublicationEdition::factory()->create();
        $content = $this->validPdfContent();
        $this->putPending('upload-name.pdf', $content);

        $upload = DocumentUpload::factory()->create([
            'item_id' => null,
            'publication_id' => $edition->publication_id,
            'publication_edition_id' => $edition->id,
            'kind' => 'credits',
            'path' => 'upload-name.pdf',
            'original_name' => 'Credits.pdf',
            'mime_type' => 'application/pdf',
            'size' => strlen($content),
        ]);

        DocumentUploadEvent::dispatch($upload);

        $document = PublicationDocument::query()->findOrFail($upload->id);
        $this->assertSame($upload->id.'.pdf', $document->path);
        $this->assertSame('credits', $document->kind->value);
        $this->assertSame($edition->id, $document->publication_edition_id);
        $this->assertSame('Credits.pdf', $document->original_name);
        $this->assertSame(1, $document->display_order);
        $this->assertSame(0, ItemDocument::query()->count());
        $this->assertDatabaseMissing('document_uploads', ['id' => $upload->id]);

        $documentsDir = trim(Config::string('localstorage.documents.directory'), '/');
        Storage::disk(Config::string('localstorage.documents.disk'))->assertExists($documentsDir.'/'.$upload->id.'.pdf');
        Storage::disk('public')->assertDirectoryEmpty('/');

        // /doc serves it
        $this->get(route('doc.document', ['filename' => $document->path]))->assertOk();
    }

    public function test_a_disallowed_file_is_rejected_and_the_uploader_is_told(): void
    {
        Storage::fake('local');
        Storage::fake(Config::string('localstorage.documents.disk'));
        Notification::fake();

        $publication = Publication::factory()->create();
        $uploader = User::factory()->create();
        $this->putPending('not-a-pdf.pdf', 'plain text, not a PDF');

        $upload = DocumentUpload::factory()->create([
            'item_id' => null,
            'publication_id' => $publication->id,
            'kind' => 'sample',
            'path' => 'not-a-pdf.pdf',
            'original_name' => 'not-a-pdf.pdf',
            'mime_type' => 'application/pdf',
            'size' => 21,
            'uploaded_by' => $uploader->id,
        ]);

        DocumentUploadEvent::dispatch($upload);

        $this->assertSame(0, PublicationDocument::query()->count());
        $this->assertDatabaseMissing('document_uploads', ['id' => $upload->id]);
        Notification::assertSentTo($uploader, ItemDocumentUploadRejected::class);
    }

    public function test_an_upload_is_for_an_item_or_a_publication_never_both_nor_neither(): void
    {
        $item = Item::factory()->Object()->create();
        $publication = Publication::factory()->create();

        DocumentUpload::factory()->create(['item_id' => $item->id]);
        DocumentUpload::factory()->create(['item_id' => null, 'publication_id' => $publication->id, 'kind' => 'sample']);

        $this->expectException(LogicException::class);
        DocumentUpload::factory()->create(['item_id' => $item->id, 'publication_id' => $publication->id]);
    }

    public function test_an_upload_with_no_owner_is_refused(): void
    {
        $this->expectException(LogicException::class);
        DocumentUpload::factory()->create(['item_id' => null]);
    }
}
