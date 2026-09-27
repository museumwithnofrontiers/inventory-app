<?php

namespace Tests\Event\DocumentUpload;

use App\Events\DocumentUploadEvent;
use App\Listeners\DocumentUploadListener;
use App\Models\DocumentUpload;
use App\Models\Item;
use App\Models\ItemDocument;
use App\Models\User;
use App\Notifications\ItemDocumentUploadRejected;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class DocumentUploadTest extends TestCase
{
    use RefreshDatabase;

    private function pendingPath(string $filename): string
    {
        $directory = trim(Config::string('localstorage.uploads.documents.directory'), '/');

        return $directory.'/'.$filename;
    }

    private function validPdfContent(): string
    {
        // A real "%PDF-" magic header so the framework's own MIME guesser
        // recognises it, padded past the configured minimum upload size.
        return "%PDF-1.4\n".str_repeat("% padding line for the test fixture\n", 40).'%%EOF';
    }

    public function test_documentuploadlistener_is_registered_for_documentuploadevent(): void
    {
        Event::fake();

        Event::assertListening(
            expectedEvent: DocumentUploadEvent::class,
            expectedListener: DocumentUploadListener::class,
        );
    }

    public function test_listener_promotes_a_valid_upload_into_an_item_document_with_the_same_id(): void
    {
        Storage::fake('local');
        Storage::fake(Config::string('localstorage.documents.disk'));

        $item = Item::factory()->Object()->create();
        $content = $this->validPdfContent();

        Storage::disk(Config::string('localstorage.uploads.documents.disk'))
            ->put($this->pendingPath('promoted.pdf'), $content);

        $documentUpload = DocumentUpload::factory()->forItem($item)->create([
            'path' => 'promoted.pdf',
            'original_name' => 'promoted.pdf',
            'mime_type' => 'application/pdf',
            'size' => strlen($content),
            'display_order' => null,
        ]);
        $uploadId = $documentUpload->id;

        (new DocumentUploadListener)->handle(new DocumentUploadEvent($documentUpload));

        $this->assertDatabaseMissing('document_uploads', ['id' => $uploadId]);

        $itemDocument = ItemDocument::find($uploadId);
        $this->assertNotNull($itemDocument);
        $this->assertSame($item->id, $itemDocument->item_id);
        $this->assertSame('promoted.pdf', $itemDocument->original_name);
        $this->assertSame(1, $itemDocument->display_order);

        $documentsDir = trim(Config::string('localstorage.documents.directory'), '/');
        Storage::disk(Config::string('localstorage.documents.disk'))
            ->assertExists($documentsDir.'/promoted.pdf');
        Storage::disk(Config::string('localstorage.uploads.documents.disk'))
            ->assertMissing($this->pendingPath('promoted.pdf'));
    }

    public function test_listener_rejects_a_disallowed_extension_and_emails_the_uploader(): void
    {
        Storage::fake('local');
        Storage::fake(Config::string('localstorage.documents.disk'));
        Notification::fake();

        $user = User::factory()->create();
        $item = Item::factory()->Object()->create();

        Storage::disk(Config::string('localstorage.uploads.documents.disk'))
            ->put($this->pendingPath('rogue.exe'), 'definitely not a document');

        $documentUpload = DocumentUpload::factory()->forItem($item)->create([
            'path' => 'rogue.exe',
            'original_name' => 'rogue.exe',
            'mime_type' => 'application/octet-stream',
            'uploaded_by' => $user->id,
        ]);
        $uploadId = $documentUpload->id;

        (new DocumentUploadListener)->handle(new DocumentUploadEvent($documentUpload));

        $this->assertDatabaseMissing('document_uploads', ['id' => $uploadId]);
        $this->assertDatabaseMissing('item_documents', ['id' => $uploadId]);
        Storage::disk(Config::string('localstorage.uploads.documents.disk'))
            ->assertMissing($this->pendingPath('rogue.exe'));

        Notification::assertSentTo($user, ItemDocumentUploadRejected::class);
    }

    public function test_listener_rejects_an_oversized_file_and_emails_the_uploader(): void
    {
        Storage::fake('local');
        Storage::fake(Config::string('localstorage.documents.disk'));
        Notification::fake();

        Config::set('localstorage.uploads.documents.max_size', 1); // 1 KB

        $user = User::factory()->create();
        $item = Item::factory()->Object()->create();

        $content = "%PDF-1.4\n".str_repeat('0', 4096)."\n%%EOF";
        Storage::disk(Config::string('localstorage.uploads.documents.disk'))
            ->put($this->pendingPath('too-big.pdf'), $content);

        $documentUpload = DocumentUpload::factory()->forItem($item)->create([
            'path' => 'too-big.pdf',
            'original_name' => 'too-big.pdf',
            'mime_type' => 'application/pdf',
            'size' => strlen($content),
            'uploaded_by' => $user->id,
        ]);
        $uploadId = $documentUpload->id;

        (new DocumentUploadListener)->handle(new DocumentUploadEvent($documentUpload));

        $this->assertDatabaseMissing('document_uploads', ['id' => $uploadId]);
        $this->assertDatabaseMissing('item_documents', ['id' => $uploadId]);
        Storage::disk(Config::string('localstorage.uploads.documents.disk'))
            ->assertMissing($this->pendingPath('too-big.pdf'));

        Notification::assertSentTo($user, ItemDocumentUploadRejected::class);
    }

    public function test_listener_rejects_a_missing_pending_file_without_throwing(): void
    {
        Storage::fake('local');
        Storage::fake(Config::string('localstorage.documents.disk'));
        Notification::fake();

        $user = User::factory()->create();
        $item = Item::factory()->Object()->create();

        $documentUpload = DocumentUpload::factory()->forItem($item)->create([
            'path' => 'never-landed.pdf',
            'uploaded_by' => $user->id,
        ]);
        $uploadId = $documentUpload->id;

        (new DocumentUploadListener)->handle(new DocumentUploadEvent($documentUpload));

        $this->assertDatabaseMissing('document_uploads', ['id' => $uploadId]);
        $this->assertDatabaseMissing('item_documents', ['id' => $uploadId]);

        Notification::assertSentTo($user, ItemDocumentUploadRejected::class);
    }
}
