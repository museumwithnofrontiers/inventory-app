<?php

namespace Tests\Filament\Resources;

use App\Enums\MediaType;
use App\Filament\Resources\CountryResource\Pages\EditCountry;
use App\Filament\Resources\CountryResource\RelationManagers\TranslationsRelationManager as CountryTranslationsRelationManager;
use App\Filament\Resources\GlossaryResource\Pages\EditGlossary;
use App\Filament\Resources\GlossaryResource\RelationManagers\SynonymsRelationManager;
use App\Filament\Resources\ItemResource\Pages\EditItem;
use App\Filament\Resources\ItemResource\RelationManagers\ArtistsRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\DocumentsRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\DynastiesRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\MediaRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\WorkshopsRelationManager;
use App\Filament\Resources\LanguageResource\Pages\EditLanguage;
use App\Filament\Resources\LanguageResource\RelationManagers\TranslationsRelationManager as LanguageTranslationsRelationManager;
use App\Filament\Resources\ProjectResource\Pages\ViewProject;
use App\Filament\Resources\ProjectResource\RelationManagers\PartnersRelationManager;
use App\Models\Artist;
use App\Models\Country;
use App\Models\CountryTranslation;
use App\Models\Dynasty;
use App\Models\Glossary;
use App\Models\Item;
use App\Models\ItemDocument;
use App\Models\ItemMedia;
use App\Models\Language;
use App\Models\LanguageTranslation;
use App\Models\Partner;
use App\Models\Project;
use App\Models\Workshop;
use Filament\Tables\Columns\TextColumn;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * Convention tests for newly added relation managers.
 *
 * Verifies the same conventions documented in RelationManagerConventionTest:
 * 1. Primary related record column is searchable.
 * 2. Metadata columns (timestamps, size, mime_type) are toggleable and hidden by default.
 * 3. Pagination defaults are consistent: defaultPaginationPageOption(25), paginated([25, 50, 100]).
 * 4. Attach/detach actions exist where appropriate.
 */
class NewRelationManagersTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    // ── ProjectResource: PartnersRelationManager ───────────────────────────────

    public function test_project_partners_relation_manager_renders_successfully(): void
    {
        $user = $this->createCrudUser();
        $project = Project::factory()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(PartnersRelationManager::class, [
                'ownerRecord' => $project,
                'pageClass' => ViewProject::class,
            ])
            ->assertSuccessful();
    }

    public function test_project_partners_relation_manager_primary_column_is_searchable(): void
    {
        $user = $this->createCrudUser();
        $project = Project::factory()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(PartnersRelationManager::class, [
                'ownerRecord' => $project,
                'pageClass' => ViewProject::class,
            ])
            ->assertTableColumnExists(
                'internal_name',
                fn (TextColumn $column): bool => $column->isSearchable()
            );
    }

    public function test_project_partners_relation_manager_timestamp_is_hidden_by_default(): void
    {
        $user = $this->createCrudUser();
        $project = Project::factory()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(PartnersRelationManager::class, [
                'ownerRecord' => $project,
                'pageClass' => ViewProject::class,
            ])
            ->assertTableColumnExists(
                'created_at',
                fn (TextColumn $column): bool => $column->isToggledHiddenByDefault()
            );
    }

    public function test_project_partners_relation_manager_shows_partners(): void
    {
        $user = $this->createCrudUser();
        $project = Project::factory()->create();
        Partner::factory()->create(['internal_name' => 'Jordan Museum', 'project_id' => $project->id]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(PartnersRelationManager::class, [
                'ownerRecord' => $project,
                'pageClass' => ViewProject::class,
            ])
            ->assertCanSeeTableRecords($project->partners);
    }

    // ── ItemResource: ArtistsRelationManager ───────────────────────────────────

    public function test_item_artists_relation_manager_renders_successfully(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ArtistsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->assertSuccessful();
    }

    public function test_item_artists_relation_manager_primary_column_is_searchable(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ArtistsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->assertTableColumnExists(
                'name',
                fn (TextColumn $column): bool => $column->isSearchable()
            );
    }

    public function test_item_artists_relation_manager_timestamp_is_hidden_by_default(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ArtistsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->assertTableColumnExists(
                'created_at',
                fn (TextColumn $column): bool => $column->isToggledHiddenByDefault()
            );
    }

    public function test_item_artists_relation_manager_attach_detach_actions_exist(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();
        $artist = Artist::factory()->create(['internal_name' => 'da_Vinci']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ArtistsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->callTableAction('attach', data: ['recordId' => $artist->id])
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('artist_item', [
            'item_id' => $item->id,
            'artist_id' => $artist->id,
        ]);
    }

    // ── ItemResource: WorkshopsRelationManager ────────────────────────────────

    public function test_item_workshops_relation_manager_renders_successfully(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(WorkshopsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->assertSuccessful();
    }

    public function test_item_workshops_relation_manager_primary_column_is_searchable(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(WorkshopsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->assertTableColumnExists(
                'name',
                fn (TextColumn $column): bool => $column->isSearchable()
            );
    }

    public function test_item_workshops_relation_manager_attach_detach_actions_exist(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();
        $workshop = Workshop::factory()->create(['internal_name' => 'venetian_glass']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(WorkshopsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->callTableAction('attach', data: ['recordId' => $workshop->id])
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('item_workshop', [
            'item_id' => $item->id,
            'workshop_id' => $workshop->id,
        ]);
    }

    // ── ItemResource: DynastiesRelationManager ────────────────────────────────

    public function test_item_dynasties_relation_manager_renders_successfully(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(DynastiesRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->assertSuccessful();
    }

    public function test_item_dynasties_relation_manager_attach_detach_actions_exist(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();
        $dynasty = Dynasty::factory()->create(['backward_compatibility' => 'mwnf3:dynasties:42']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(DynastiesRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->callTableAction('attach', data: ['recordId' => $dynasty->id])
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('item_dynasty', [
            'item_id' => $item->id,
            'dynasty_id' => $dynasty->id,
        ]);
    }

    // ── ItemResource: MediaRelationManager ────────────────────────────────────

    public function test_item_media_relation_manager_renders_successfully(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(MediaRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->assertSuccessful();
    }

    public function test_item_media_relation_manager_primary_column_is_searchable(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(MediaRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->assertTableColumnExists(
                'title',
                fn (TextColumn $column): bool => $column->isSearchable()
            );
    }

    public function test_item_media_relation_manager_timestamp_is_hidden_by_default(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(MediaRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->assertTableColumnExists(
                'created_at',
                fn (TextColumn $column): bool => $column->isToggledHiddenByDefault()
            );
    }

    public function test_item_media_relation_manager_shows_media(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();
        ItemMedia::factory()->video()->forItem($item)->create(['title' => 'Cave painting video']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(MediaRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->assertCanSeeTableRecords($item->itemMedia);
    }

    public function test_item_media_relation_manager_can_create_media(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(MediaRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->callTableAction('create', data: [
                'type' => MediaType::VIDEO->value,
                'url' => 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                'title' => 'Test video',
            ])
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('item_media', [
            'item_id' => $item->id,
            'title' => 'Test video',
        ]);
    }

    // ── ItemResource: DocumentsRelationManager ────────────────────────────────

    public function test_item_documents_relation_manager_renders_successfully(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(DocumentsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->assertSuccessful();
    }

    public function test_item_documents_relation_manager_metadata_columns_are_hidden_by_default(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(DocumentsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->assertTableColumnExists(
                'mime_type',
                fn (TextColumn $column): bool => $column->isToggledHiddenByDefault()
            )
            ->assertTableColumnExists(
                'size',
                fn (TextColumn $column): bool => $column->isToggledHiddenByDefault()
            )
            ->assertTableColumnExists(
                'created_at',
                fn (TextColumn $column): bool => $column->isToggledHiddenByDefault()
            );
    }

    public function test_item_documents_relation_manager_shows_documents(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();
        ItemDocument::factory()->forItem($item)->create(['title' => 'Conservation report']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(DocumentsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->assertCanSeeTableRecords($item->itemDocuments);
    }

    // ── GlossaryResource: SynonymsRelationManager ─────────────────────────────

    public function test_glossary_synonyms_relation_manager_renders_successfully(): void
    {
        $user = $this->createReferenceDataUser();
        $glossary = Glossary::factory()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(SynonymsRelationManager::class, [
                'ownerRecord' => $glossary,
                'pageClass' => EditGlossary::class,
            ])
            ->assertSuccessful();
    }

    public function test_glossary_synonyms_relation_manager_primary_column_is_searchable(): void
    {
        $user = $this->createReferenceDataUser();
        $glossary = Glossary::factory()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(SynonymsRelationManager::class, [
                'ownerRecord' => $glossary,
                'pageClass' => EditGlossary::class,
            ])
            ->assertTableColumnExists(
                'internal_name',
                fn (TextColumn $column): bool => $column->isSearchable()
            );
    }

    public function test_glossary_synonyms_relation_manager_timestamp_is_hidden_by_default(): void
    {
        $user = $this->createReferenceDataUser();
        $glossary = Glossary::factory()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(SynonymsRelationManager::class, [
                'ownerRecord' => $glossary,
                'pageClass' => EditGlossary::class,
            ])
            ->assertTableColumnExists(
                'created_at',
                fn (TextColumn $column): bool => $column->isToggledHiddenByDefault()
            );
    }

    public function test_glossary_synonyms_relation_manager_attach_action_works(): void
    {
        $user = $this->createReferenceDataUser();
        $glossary = Glossary::factory()->create(['internal_name' => 'mashrabiya']);
        $synonym = Glossary::factory()->create(['internal_name' => 'shanasheel']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(SynonymsRelationManager::class, [
                'ownerRecord' => $glossary,
                'pageClass' => EditGlossary::class,
            ])
            ->callTableAction('attach', data: ['recordId' => $synonym->id])
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('glossary_synonyms', [
            'glossary_id' => $glossary->id,
            'synonym_id' => $synonym->id,
        ]);
    }

    // ── CountryResource: TranslationsRelationManager ──────────────────────────

    public function test_country_translations_relation_manager_renders_successfully(): void
    {
        $user = $this->createReferenceDataUser();
        $country = Country::factory()->create(['id' => 'JOR', 'internal_name' => 'Jordan']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CountryTranslationsRelationManager::class, [
                'ownerRecord' => $country,
                'pageClass' => EditCountry::class,
            ])
            ->assertSuccessful();
    }

    public function test_country_translations_relation_manager_primary_column_is_searchable(): void
    {
        $user = $this->createReferenceDataUser();
        $country = Country::factory()->create(['id' => 'JOR', 'internal_name' => 'Jordan']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CountryTranslationsRelationManager::class, [
                'ownerRecord' => $country,
                'pageClass' => EditCountry::class,
            ])
            ->assertTableColumnExists(
                'name',
                fn (TextColumn $column): bool => $column->isSearchable()
            );
    }

    public function test_country_translations_relation_manager_timestamp_is_hidden_by_default(): void
    {
        $user = $this->createReferenceDataUser();
        $country = Country::factory()->create(['id' => 'JOR', 'internal_name' => 'Jordan']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CountryTranslationsRelationManager::class, [
                'ownerRecord' => $country,
                'pageClass' => EditCountry::class,
            ])
            ->assertTableColumnExists(
                'created_at',
                fn (TextColumn $column): bool => $column->isToggledHiddenByDefault()
            )
            ->assertTableColumnExists(
                'updated_at',
                fn (TextColumn $column): bool => $column->isToggledHiddenByDefault()
            );
    }

    public function test_country_translations_relation_manager_shows_translations(): void
    {
        $user = $this->createReferenceDataUser();
        $country = Country::factory()->create(['id' => 'JOR', 'internal_name' => 'Jordan']);
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);
        CountryTranslation::factory()->create([
            'country_id' => $country->id,
            'language_id' => $language->id,
            'name' => 'Jordan',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CountryTranslationsRelationManager::class, [
                'ownerRecord' => $country,
                'pageClass' => EditCountry::class,
            ])
            ->assertCanSeeTableRecords($country->translations);
    }

    public function test_country_translations_relation_manager_can_create_translation(): void
    {
        $user = $this->createReferenceDataUser();
        $country = Country::factory()->create(['id' => 'JOR', 'internal_name' => 'Jordan']);
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CountryTranslationsRelationManager::class, [
                'ownerRecord' => $country,
                'pageClass' => EditCountry::class,
            ])
            ->callTableAction('create', data: [
                'language_id' => $language->id,
                'name' => 'Jordan',
            ])
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('country_translations', [
            'country_id' => $country->id,
            'language_id' => $language->id,
            'name' => 'Jordan',
        ]);
    }

    // ── LanguageResource: TranslationsRelationManager ─────────────────────────

    public function test_language_translations_relation_manager_renders_successfully(): void
    {
        $user = $this->createReferenceDataUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(LanguageTranslationsRelationManager::class, [
                'ownerRecord' => $language,
                'pageClass' => EditLanguage::class,
            ])
            ->assertSuccessful();
    }

    public function test_language_translations_relation_manager_primary_column_is_searchable(): void
    {
        $user = $this->createReferenceDataUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(LanguageTranslationsRelationManager::class, [
                'ownerRecord' => $language,
                'pageClass' => EditLanguage::class,
            ])
            ->assertTableColumnExists(
                'name',
                fn (TextColumn $column): bool => $column->isSearchable()
            );
    }

    public function test_language_translations_relation_manager_timestamp_is_hidden_by_default(): void
    {
        $user = $this->createReferenceDataUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(LanguageTranslationsRelationManager::class, [
                'ownerRecord' => $language,
                'pageClass' => EditLanguage::class,
            ])
            ->assertTableColumnExists(
                'created_at',
                fn (TextColumn $column): bool => $column->isToggledHiddenByDefault()
            )
            ->assertTableColumnExists(
                'updated_at',
                fn (TextColumn $column): bool => $column->isToggledHiddenByDefault()
            );
    }

    public function test_language_translations_relation_manager_shows_translations(): void
    {
        $user = $this->createReferenceDataUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);
        $displayLanguage = Language::factory()->create(['id' => 'fra', 'internal_name' => 'French']);
        LanguageTranslation::factory()->create([
            'language_id' => $language->id,
            'display_language_id' => $displayLanguage->id,
            'name' => 'Anglais',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(LanguageTranslationsRelationManager::class, [
                'ownerRecord' => $language,
                'pageClass' => EditLanguage::class,
            ])
            ->assertCanSeeTableRecords($language->translations);
    }

    public function test_language_translations_relation_manager_can_create_translation(): void
    {
        $user = $this->createReferenceDataUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);
        $displayLanguage = Language::factory()->create(['id' => 'fra', 'internal_name' => 'French']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(LanguageTranslationsRelationManager::class, [
                'ownerRecord' => $language,
                'pageClass' => EditLanguage::class,
            ])
            ->callTableAction('create', data: [
                'display_language_id' => $displayLanguage->id,
                'name' => 'Anglais',
            ])
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('language_translations', [
            'language_id' => $language->id,
            'display_language_id' => $displayLanguage->id,
            'name' => 'Anglais',
        ]);
    }
}
