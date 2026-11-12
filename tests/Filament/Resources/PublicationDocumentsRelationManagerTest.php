<?php

namespace Tests\Filament\Resources;

use App\Filament\Resources\PublicationResource\Pages\EditPublication;
use App\Filament\Resources\PublicationResource\Pages\ViewPublication;
use App\Filament\Resources\PublicationResource\RelationManagers\DocumentsRelationManager;
use App\Models\Publication;
use App\Models\PublicationDocument;
use App\Models\PublicationEdition;
use Filament\Tables\Actions\DeleteAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

class PublicationDocumentsRelationManagerTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    private string $disk;

    private string $directory;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        Storage::fake('public');
        $this->disk = Config::string('localstorage.documents.disk');
        $this->directory = trim(Config::string('localstorage.documents.directory'), '/');
        Storage::fake($this->disk);
    }

    private function pdf(): UploadedFile
    {
        return UploadedFile::fake()->createWithContent(
            'Sample pages.pdf',
            "%PDF-1.4\n".str_repeat("% padding line for the test fixture\n", 40).'%%EOF'
        );
    }

    public function test_an_uploaded_pdf_goes_through_the_pipeline_to_a_publication_document(): void
    {
        $user = $this->createCrudUser();
        $publication = Publication::factory()->create();
        $edition = PublicationEdition::factory()->forPublication($publication)->create();
        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(DocumentsRelationManager::class, ['ownerRecord' => $publication, 'pageClass' => EditPublication::class])
            ->mountTableAction('upload')
            ->setTableActionData([
                'file' => $this->pdf(),
                'kind' => 'sample',
                'publication_edition_id' => $edition->id,
            ])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $document = PublicationDocument::query()->where('publication_id', $publication->id)->firstOrFail();
        $this->assertSame('sample', $document->kind->value);
        $this->assertSame($edition->id, $document->publication_edition_id);
        $this->assertSame('Sample pages.pdf', $document->original_name);
        $this->assertSame($document->id.'.pdf', $document->path);
        Storage::disk($this->disk)->assertExists($this->directory.'/'.$document->path);
        Storage::disk('public')->assertDirectoryEmpty('/');
    }

    public function test_a_document_is_edited_downloaded_and_deleted(): void
    {
        $user = $this->createCrudUser();
        $publication = Publication::factory()->create();
        $document = PublicationDocument::factory()->forPublication($publication)->create(['path' => Str::uuid()->toString().'.pdf']);
        Storage::disk($this->disk)->put($this->directory.'/'.$document->path, '%PDF-1.4');
        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(DocumentsRelationManager::class, ['ownerRecord' => $publication, 'pageClass' => EditPublication::class])
            ->assertCanSeeTableRecords([$document])
            ->callTableAction('edit', $document, data: ['kind' => 'credits', 'display_order' => 3])
            ->assertHasNoTableActionErrors()
            ->callTableAction(DeleteAction::class, $document->fresh())
            ->assertHasNoTableActionErrors();

        $this->assertModelMissing($document);
        Storage::disk($this->disk)->assertMissing($this->directory.'/'.$document->path);
    }

    public function test_the_panel_download_serves_the_file_to_a_user_who_may_update_the_publication(): void
    {
        $user = $this->createCrudUser();
        $document = PublicationDocument::factory()->create(['path' => Str::uuid()->toString().'.pdf']);
        Storage::disk($this->disk)->put($this->directory.'/'.$document->path, '%PDF-1.4');

        $this->actingAs($user)
            ->get(route('filament.admin.publication-document.download', ['publication' => $document->publication_id, 'publicationDocument' => $document]))
            ->assertOk();

        $this->actingAs($this->createViewOnlyUser())
            ->get(route('filament.admin.publication-document.download', ['publication' => $document->publication_id, 'publicationDocument' => $document]))
            ->assertForbidden();
    }

    public function test_view_only_users_cannot_change_the_documents(): void
    {
        $publication = Publication::factory()->create();
        $document = PublicationDocument::factory()->forPublication($publication)->create();
        $this->setCurrentPanel();

        Livewire::actingAs($this->createViewOnlyUser())
            ->test(DocumentsRelationManager::class, ['ownerRecord' => $publication, 'pageClass' => ViewPublication::class])
            ->assertCanSeeTableRecords([$document])
            ->assertTableActionHidden('upload')
            ->assertTableActionHidden('edit', $document)
            ->assertTableActionHidden('delete', $document);
    }
}
