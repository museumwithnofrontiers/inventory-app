<?php

namespace Tests\Pub;

use App\Http\Controllers\Doc\DocumentController;
use App\Models\ItemDocument;
use App\Models\PublicationDocument;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * /doc/{filename}: the public URL of a publication's PDFs (ADR 004).
 */
class DocumentControllerTest extends TestCase
{
    use RefreshDatabase;

    private const PDF = "%PDF-1.4\n% a test document\n%%EOF";

    private string $disk;

    private string $directory;

    protected function setUp(): void
    {
        parent::setUp();

        // Every disk a document touches, faked
        Storage::fake('local');
        Storage::fake('public');
        $this->disk = Config::string('localstorage.documents.disk');
        $this->directory = trim(Config::string('localstorage.documents.directory'), '/');
        Storage::fake($this->disk);
    }

    private function publicationDocument(string $originalName = 'Sample pages.pdf'): PublicationDocument
    {
        $document = PublicationDocument::factory()->create([
            'path' => Str::uuid()->toString().'.pdf',
            'original_name' => $originalName,
        ]);
        Storage::disk($this->disk)->put($this->directory.'/'.$document->path, self::PDF);

        return $document;
    }

    public function test_a_publication_document_is_streamed_as_stored_with_its_headers(): void
    {
        $document = $this->publicationDocument();

        $response = $this->get(route('doc.document', ['filename' => $document->path]));

        $response->assertOk()
            ->assertHeader('Content-Type', 'application/pdf')
            ->assertHeader('Content-Disposition', 'inline; filename="Sample pages.pdf"')
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('Content-Security-Policy', 'sandbox')
            ->assertHeader('ETag');
        $this->assertStringContainsString('public', (string) $response->headers->get('Cache-Control'));
        $this->assertStringContainsString('no-cache', (string) $response->headers->get('Cache-Control'));
        $this->assertSame(self::PDF, $response->streamedContent());
    }

    public function test_a_matching_etag_answers_304_and_a_changed_file_changes_it(): void
    {
        $document = $this->publicationDocument();
        $url = route('doc.document', ['filename' => $document->path]);
        $etag = (string) $this->get($url)->headers->get('ETag');

        $this->get($url, ['If-None-Match' => $etag])
            ->assertStatus(304)
            ->assertHeader('ETag', $etag)
            ->assertHeader('Content-Security-Policy', 'sandbox');

        Storage::disk($this->disk)->put($this->directory.'/'.$document->path, self::PDF."\n% revised");

        $this->get($url, ['If-None-Match' => $etag])->assertOk();
        $this->assertNotSame($etag, $this->get($url)->headers->get('ETag'));
    }

    public function test_an_item_document_is_never_served(): void
    {
        $itemDocument = ItemDocument::factory()->create(['path' => Str::uuid()->toString().'.pdf']);
        Storage::disk($this->disk)->put($this->directory.'/'.$itemDocument->path, self::PDF);

        $this->get(route('doc.document', ['filename' => $itemDocument->path]))->assertNotFound();
    }

    public function test_a_known_document_whose_file_is_gone_is_a_404(): void
    {
        $document = PublicationDocument::factory()->create(['path' => Str::uuid()->toString().'.pdf']);

        $this->get(route('doc.document', ['filename' => $document->path]))->assertNotFound();
    }

    /**
     * @return array<string, array{string}>
     */
    public static function rejectedFilenameProvider(): array
    {
        return [
            'not a uuid' => ['sample.pdf'],
            'a picture' => ['00000000-0000-0000-0000-000000000000.jpg'],
            'no extension' => ['00000000-0000-0000-0000-000000000000'],
            'upper-case extension' => ['00000000-0000-0000-0000-000000000000.PDF'],
            'a path' => ['documents%2F00000000-0000-0000-0000-000000000000.pdf'],
            'a traversal' => ['..%2F.env'],
        ];
    }

    #[DataProvider('rejectedFilenameProvider')]
    public function test_other_filenames_are_a_404(string $filename): void
    {
        $this->get('/doc/'.$filename)->assertNotFound();
    }

    public function test_an_unknown_uuid_is_a_404(): void
    {
        $this->get(route('doc.document', ['filename' => Str::uuid()->toString().'.pdf']))->assertNotFound();
    }

    public function test_a_query_string_is_refused(): void
    {
        $document = $this->publicationDocument();

        $this->get(route('doc.document', ['filename' => $document->path]).'?download=1')->assertStatus(400);
    }

    public function test_no_response_starts_a_session_or_sets_a_cookie(): void
    {
        $document = $this->publicationDocument();
        $url = route('doc.document', ['filename' => $document->path]);
        $served = $this->get($url)->assertOk();

        $responses = [
            'served' => $served,
            '304' => $this->get($url, ['If-None-Match' => (string) $served->headers->get('ETag')])->assertStatus(304),
            '404' => $this->get(route('doc.document', ['filename' => Str::uuid()->toString().'.pdf']))->assertNotFound(),
        ];

        foreach ($responses as $kind => $response) {
            $this->assertSame([], $response->headers->getCookies(), "A {$kind} response sets no cookie");
        }
    }

    public function test_served_files_and_errors_count_against_the_throttle_but_304s_do_not(): void
    {
        config(['app.doc_documents_throttle' => 2]);
        $document = $this->publicationDocument();
        $url = route('doc.document', ['filename' => $document->path]);

        $etag = (string) $this->get($url)->assertOk()->headers->get('ETag');
        foreach (range(1, 4) as $ignored) {
            $last = $this->get($url, ['If-None-Match' => $etag])->assertStatus(304);
        }
        $last->assertHeader('X-RateLimit-Remaining', '1');

        $this->get(route('doc.document', ['filename' => Str::uuid()->toString().'.pdf']))->assertNotFound();
        $this->get($url)->assertStatus(429);
    }

    public function test_the_disposition_keeps_the_header_safe(): void
    {
        $this->assertSame('inline; filename="Catalogue.pdf"', DocumentController::inlineDisposition('Catalogue.pdf'));
        $this->assertSame('inline; filename="_evil_.pdf"', DocumentController::inlineDisposition('books/"evil".pdf'));
        $this->assertSame(
            "inline; filename=\"Cr_dits.pdf\"; filename*=UTF-8''Cr%C3%A9dits.pdf",
            DocumentController::inlineDisposition('Crédits.pdf')
        );
    }
}
