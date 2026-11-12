<?php

namespace Tests\Api\Resources;

use App\Enums\OAuthScope;
use App\Enums\Permission;
use App\Models\Publication;
use App\Models\PublicationDocument;
use App\Models\PublicationEdition;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Laravel\Passport\Passport;
use Tests\Api\Fixtures\DenyingPublicationPolicy;
use Tests\Api\Traits\AuthenticatesApiRequests;
use Tests\TestCase;

class PublicationDocumentTest extends TestCase
{
    use AuthenticatesApiRequests {
        setUp as authenticatedSetUp;
    }
    use RefreshDatabase;

    private string $disk;

    private string $directory;

    protected function setUp(): void
    {
        $this->authenticatedSetUp();

        Storage::fake('local');
        Storage::fake('public');
        $this->disk = Config::string('localstorage.documents.disk');
        $this->directory = trim(Config::string('localstorage.documents.directory'), '/');
        Storage::fake($this->disk);
    }

    /**
     * @return array<string, mixed>
     */
    private function documentData(array $overrides = []): array
    {
        return $overrides + [
            'kind' => 'sample',
            'path' => Str::uuid()->toString().'.pdf',
            'original_name' => 'Sample pages.pdf',
            'mime_type' => 'application/pdf',
            'size' => 12345,
        ];
    }

    public function test_documents_are_listed_shown_recorded_updated_and_deleted(): void
    {
        $publication = Publication::factory()->create();
        $edition = PublicationEdition::factory()->forPublication($publication)->create();
        PublicationDocument::factory()->forPublication($publication)->count(2)->create();

        $this->getJson(route('publication.documents.index', $publication))
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $created = $this->postJson(route('publication.documents.store', $publication), $this->documentData([
            'publication_edition_id' => $edition->id,
            'backward_compatibility' => 'mwnf3:books:48:en:1:book:1:catalogue',
        ]))->assertCreated()
            ->assertJsonPath('data.kind', 'sample')
            ->assertJsonPath('data.publication_edition_id', $edition->id)
            ->json('data');

        $this->assertSame(route('doc.document', ['filename' => $created['path']]), $created['public_url']);

        $this->getJson(route('publication-document.show', ['publicationDocument' => $created['id'], 'include' => 'publication,publicationEdition']))
            ->assertOk()
            ->assertJsonPath('data.publication.id', $publication->id);

        $this->patchJson(route('publication-document.update', $created['id']), ['kind' => 'credits', 'display_order' => 7])
            ->assertOk()
            ->assertJsonPath('data.kind', 'credits')
            ->assertJsonPath('data.display_order', 7);

        Storage::disk($this->disk)->put($this->directory.'/'.$created['path'], '%PDF-1.4');
        $this->deleteJson(route('publication-document.destroy', $created['id']))->assertNoContent();
        $this->assertDatabaseMissing('publication_documents', ['id' => $created['id']]);
        Storage::disk($this->disk)->assertMissing($this->directory.'/'.$created['path']);
    }

    public function test_store_validates_a_pdf_named_by_a_uuid_and_an_edition_of_the_same_publication(): void
    {
        $publication = Publication::factory()->create();
        $foreignEdition = PublicationEdition::factory()->create();

        $this->postJson(route('publication.documents.store', $publication), $this->documentData([
            'kind' => 'brochure',
            'path' => 'sample.pdf',
            'mime_type' => 'image/jpeg',
            'publication_edition_id' => $foreignEdition->id,
        ]))->assertUnprocessable()
            ->assertJsonValidationErrors(['kind', 'path', 'mime_type', 'publication_edition_id']);
    }

    public function test_the_signed_in_download_serves_the_file(): void
    {
        $document = PublicationDocument::factory()->create(['path' => Str::uuid()->toString().'.pdf', 'original_name' => 'credits.pdf']);
        Storage::disk($this->disk)->put($this->directory.'/'.$document->path, '%PDF-1.4');

        $this->get(route('publication-document.download', $document))->assertOk();
    }

    public function test_changes_need_update_on_the_publication(): void
    {
        $publication = Publication::factory()->create();
        $document = PublicationDocument::factory()->forPublication($publication)->create();

        $user = User::factory()->create();
        $user->givePermissionTo([Permission::VIEW_DATA->value, Permission::CREATE_DATA->value, Permission::DELETE_DATA->value]);
        Passport::actingAs($user, [OAuthScope::API_READ->value, OAuthScope::API_WRITE->value]);

        $this->getJson(route('publication-document.show', $document))->assertOk();
        $this->postJson(route('publication.documents.store', $publication), $this->documentData())->assertForbidden();
        $this->patchJson(route('publication-document.update', $document), ['kind' => 'credits'])->assertForbidden();
        $this->deleteJson(route('publication-document.destroy', $document))->assertForbidden();
    }

    public function test_the_publication_policy_decides(): void
    {
        $publication = Publication::factory()->create();
        $document = PublicationDocument::factory()->forPublication($publication)->create();
        Gate::policy(Publication::class, DenyingPublicationPolicy::class);

        $this->postJson(route('publication.documents.store', $publication), $this->documentData())->assertForbidden();
        $this->patchJson(route('publication-document.update', $document), ['kind' => 'credits'])->assertForbidden();
        $this->deleteJson(route('publication-document.destroy', $document))->assertForbidden();
        $this->getJson(route('publication-document.show', $document))->assertOk();
    }

    public function test_deleting_an_edition_keeps_its_documents(): void
    {
        $edition = PublicationEdition::factory()->create();
        $document = PublicationDocument::factory()->forEdition($edition)->create();

        $edition->delete();

        $this->assertDatabaseHas('publication_documents', ['id' => $document->id, 'publication_edition_id' => null]);
    }
}
