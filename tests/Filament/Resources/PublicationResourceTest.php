<?php

namespace Tests\Filament\Resources;

use App\Filament\Resources\CollectionResource\Pages\EditCollection;
use App\Filament\Resources\CollectionResource\RelationManagers\PublicationsRelationManager as CollectionPublicationsRelationManager;
use App\Filament\Resources\ItemResource\Pages\EditItem;
use App\Filament\Resources\ItemResource\RelationManagers\PublicationsRelationManager as ItemPublicationsRelationManager;
use App\Filament\Resources\PublicationResource\Pages\CreatePublication;
use App\Filament\Resources\PublicationResource\Pages\EditPublication;
use App\Filament\Resources\PublicationResource\Pages\ListPublication;
use App\Filament\Resources\PublicationResource\Pages\ViewPublication;
use App\Filament\Resources\PublicationResource\RelationManagers\CollectionsRelationManager;
use App\Filament\Resources\PublicationResource\RelationManagers\EditionsRelationManager;
use App\Filament\Resources\PublicationResource\RelationManagers\ImagesRelationManager;
use App\Filament\Resources\PublicationResource\RelationManagers\ItemsRelationManager;
use App\Filament\Resources\PublicationResource\RelationManagers\TagsRelationManager;
use App\Filament\Resources\PublicationResource\RelationManagers\TranslationsRelationManager;
use App\Filament\Resources\PublicationTranslationResource\Pages\CreatePublicationTranslation;
use App\Models\AvailableImage;
use App\Models\Collection;
use App\Models\Context;
use App\Models\Item;
use App\Models\Language;
use App\Models\Project;
use App\Models\Publication;
use App\Models\PublicationEdition;
use App\Models\PublicationImage;
use App\Models\PublicationTranslation;
use App\Models\Tag;
use Filament\Tables\Actions\DeleteAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

class PublicationResourceTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_authorized_users_can_render_every_publication_page(): void
    {
        $user = $this->createCrudUser();
        $publication = Publication::factory()->create(['internal_name' => 'Travel guide Jordan']);
        $translation = PublicationTranslation::factory()->forPublication($publication)->create(['title' => 'Jordan']);

        $this->actingAs($user)->get('/admin/publications')->assertOk()->assertSee('Travel guide Jordan');
        $this->actingAs($user)->get('/admin/publications/create')->assertOk();
        $this->actingAs($user)->get("/admin/publications/{$publication->getKey()}")->assertOk()->assertSee('Travel guide Jordan');
        $this->actingAs($user)->get("/admin/publications/{$publication->getKey()}/edit")->assertOk()->assertSee('Core information');

        $this->actingAs($user)->get('/admin/publication-translations')->assertOk()->assertSee('Jordan');
        $this->actingAs($user)->get("/admin/publication-translations/{$translation->getKey()}")->assertOk();
        $this->actingAs($user)->get("/admin/publication-translations/{$translation->getKey()}/edit")->assertOk();
    }

    public function test_view_only_users_see_publications_but_cannot_change_them(): void
    {
        $user = $this->createViewOnlyUser();
        $publication = Publication::factory()->create();

        $this->actingAs($user)->get('/admin/publications')->assertOk();
        $this->actingAs($user)->get("/admin/publications/{$publication->getKey()}")->assertOk();
        $this->actingAs($user)->get('/admin/publications/create')->assertForbidden();
        $this->actingAs($user)->get("/admin/publications/{$publication->getKey()}/edit")->assertForbidden();
    }

    public function test_users_without_view_data_get_no_publications(): void
    {
        $user = $this->createReferenceDataUser();

        $this->actingAs($user)->get('/admin/publications')->assertForbidden();
        $this->actingAs($user)->get('/admin/publication-translations')->assertForbidden();
    }

    public function test_a_publication_is_created_and_edited_in_the_panel(): void
    {
        $user = $this->createCrudUser();
        $language = Language::factory()->create();
        $project = Project::factory()->create();
        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CreatePublication::class)
            ->fillForm([
                'internal_name' => 'MWNF Educational Guide',
                'category' => 'educational',
                'status' => 'in-preparation',
                'language_id' => $language->id,
                'project_id' => $project->id,
                'backward_compatibility' => 'mwnf3:bookbase:48',
            ])
            ->call('create')
            ->assertHasNoFormErrors();

        $publication = Publication::query()->where('backward_compatibility', 'mwnf3:bookbase:48')->firstOrFail();
        $this->assertSame('educational', $publication->category->value);
        $this->assertSame('in-preparation', $publication->status->value);

        Livewire::actingAs($user)
            ->test(EditPublication::class, ['record' => $publication->getKey()])
            ->fillForm(['category' => 'other'])
            ->call('save')
            ->assertHasNoFormErrors();

        $this->assertSame('other', $publication->fresh()?->category->value);
    }

    public function test_the_list_filters_by_category_and_searches_the_legacy_key(): void
    {
        $user = $this->createCrudUser();
        $trail = Publication::factory()->create(['category' => 'exhibition-trail', 'backward_compatibility' => 'mwnf3:bookbase:1']);
        $other = Publication::factory()->create(['category' => 'other', 'backward_compatibility' => 'mwnf3:bookbase:53']);
        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListPublication::class)
            ->filterTable('category', 'exhibition-trail')
            ->assertCanSeeTableRecords([$trail])
            ->assertCanNotSeeTableRecords([$other]);

        Livewire::actingAs($user)
            ->test(ListPublication::class)
            ->searchTable('mwnf3:bookbase:53')
            ->assertCanSeeTableRecords([$other])
            ->assertCanNotSeeTableRecords([$trail]);
    }

    public function test_the_translation_create_page_is_prefilled_with_its_publication(): void
    {
        $user = $this->createCrudUser();
        $publication = Publication::factory()->create();
        $language = Language::factory()->create();
        $context = Context::factory()->create();
        $this->setCurrentPanel();

        Livewire::withQueryParams(['publication_id' => $publication->id])
            ->actingAs($user)
            ->test(CreatePublicationTranslation::class)
            ->assertFormSet(['publication_id' => $publication->id])
            ->fillForm([
                'language_id' => $language->id,
                'context_id' => $context->id,
                'title' => 'Islamic Art in the Mediterranean',
                'author_credit' => 'Ed. by A. Author',
            ])
            ->call('create')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('publication_translations', [
            'publication_id' => $publication->id,
            'title' => 'Islamic Art in the Mediterranean',
            'author_credit' => 'Ed. by A. Author',
        ]);
    }

    public function test_the_translations_manager_lists_and_deletes(): void
    {
        $user = $this->createCrudUser();
        $publication = Publication::factory()->create();
        $translation = PublicationTranslation::factory()->forPublication($publication)->create();
        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(TranslationsRelationManager::class, ['ownerRecord' => $publication, 'pageClass' => EditPublication::class])
            ->assertCanSeeTableRecords([$translation])
            ->callTableAction(DeleteAction::class, $translation)
            ->assertHasNoTableActionErrors();

        $this->assertModelMissing($translation);
    }

    public function test_editions_are_created_edited_and_deleted_inline(): void
    {
        $user = $this->createCrudUser();
        $publication = Publication::factory()->create();
        $language = Language::factory()->create();
        $this->setCurrentPanel();

        $component = Livewire::actingAs($user)
            ->test(EditionsRelationManager::class, ['ownerRecord' => $publication, 'pageClass' => EditPublication::class])
            ->callTableAction('create', data: [
                'language_id' => $language->id,
                'format' => 'print-on-demand',
                'edition' => 2,
                'publish_year' => 2012,
                'isbn' => '978-3-902782-00-0',
                'publisher' => 'Museum With No Frontiers',
                'visible' => false,
            ])
            ->assertHasNoTableActionErrors();

        $edition = PublicationEdition::query()->where('publication_id', $publication->id)->firstOrFail();
        $this->assertSame('print-on-demand', $edition->format->value);
        $this->assertFalse($edition->visible);

        $component
            ->callTableAction('edit', $edition, data: ['dimensions' => '24 × 17 cm'])
            ->assertHasNoTableActionErrors()
            ->callTableAction(DeleteAction::class, $edition->fresh())
            ->assertHasNoTableActionErrors();

        $this->assertModelMissing($edition);
    }

    public function test_view_only_users_cannot_change_the_editions(): void
    {
        $user = $this->createViewOnlyUser();
        $publication = Publication::factory()->create();
        $edition = PublicationEdition::factory()->forPublication($publication)->create();
        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(EditionsRelationManager::class, ['ownerRecord' => $publication, 'pageClass' => ViewPublication::class])
            ->assertCanSeeTableRecords([$edition])
            ->assertTableActionHidden('create')
            ->assertTableActionHidden('edit', $edition)
            ->assertTableActionHidden('delete', $edition);
    }

    public function test_an_available_image_is_attached_as_an_edition_cover_and_detached(): void
    {
        $user = $this->createCrudUser();
        $publication = Publication::factory()->create();
        $edition = PublicationEdition::factory()->forPublication($publication)->create();
        $available = AvailableImage::factory()->create(['path' => 'cover.jpg']);
        $this->setCurrentPanel();

        $component = Livewire::actingAs($user)
            ->test(ImagesRelationManager::class, ['ownerRecord' => $publication, 'pageClass' => EditPublication::class])
            ->callTableAction('attach', data: [
                'available_image_id' => $available->id,
                'kind' => 'cover',
                'publication_edition_id' => $edition->id,
            ])
            ->assertHasNoTableActionErrors();

        $image = PublicationImage::query()->findOrFail($available->id);
        $this->assertSame('cover', $image->kind->value);
        $this->assertSame($edition->id, $image->publication_edition_id);

        $component
            ->callTableAction('edit', $image, data: ['kind' => 'page', 'display_order' => 4])
            ->assertHasNoTableActionErrors();
        $this->assertSame('page', $image->fresh()?->kind->value);

        $component
            ->callTableAction('detach', $image)
            ->assertHasNoTableActionErrors();

        $this->assertModelMissing($image);
        $this->assertDatabaseHas('available_images', ['id' => $available->id]);
    }

    public function test_collections_items_and_tags_are_attached_and_detached(): void
    {
        $user = $this->createCrudUser();
        $publication = Publication::factory()->create();
        $collection = Collection::factory()->create();
        $item = Item::factory()->Object()->create();
        $tag = Tag::factory()->create(['category' => 'theme']);
        $this->setCurrentPanel();
        $owner = ['ownerRecord' => $publication, 'pageClass' => EditPublication::class];

        Livewire::actingAs($user)->test(CollectionsRelationManager::class, $owner)
            ->callTableAction('attach', data: ['recordId' => $collection->id, 'display_order' => 1])
            ->assertHasNoTableActionErrors();
        Livewire::actingAs($user)->test(ItemsRelationManager::class, $owner)
            ->callTableAction('attach', data: ['recordId' => $item->id])
            ->assertHasNoTableActionErrors();
        Livewire::actingAs($user)->test(TagsRelationManager::class, $owner)
            ->callTableAction('attach', data: ['recordId' => $tag->id])
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('publication_collection', ['publication_id' => $publication->id, 'collection_id' => $collection->id, 'display_order' => 1]);
        $this->assertDatabaseHas('publication_item', ['publication_id' => $publication->id, 'item_id' => $item->id]);
        $this->assertDatabaseHas('publication_tag', ['publication_id' => $publication->id, 'tag_id' => $tag->id]);

        Livewire::actingAs($user)->test(CollectionsRelationManager::class, $owner)
            ->callTableAction('detach', $collection)
            ->assertHasNoTableActionErrors();
        Livewire::actingAs($user)->test(TagsRelationManager::class, $owner)
            ->callTableAction('detach', $tag)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('publication_collection', ['publication_id' => $publication->id]);
        $this->assertDatabaseMissing('publication_tag', ['publication_id' => $publication->id]);
    }

    public function test_the_item_and_collection_publications_managers_attach_and_detach(): void
    {
        $user = $this->createCrudUser();
        $publication = Publication::factory()->create();
        $item = Item::factory()->Object()->create();
        $collection = Collection::factory()->create();
        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ItemPublicationsRelationManager::class, ['ownerRecord' => $item, 'pageClass' => EditItem::class])
            ->callTableAction('attach', data: ['recordId' => $publication->id])
            ->assertHasNoTableActionErrors();
        Livewire::actingAs($user)
            ->test(CollectionPublicationsRelationManager::class, ['ownerRecord' => $collection, 'pageClass' => EditCollection::class])
            ->callTableAction('attach', data: ['recordId' => $publication->id, 'display_order' => 2])
            ->assertHasNoTableActionErrors()
            ->assertCanSeeTableRecords([$publication])
            ->callTableAction('detach', $publication)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('publication_item', ['publication_id' => $publication->id, 'item_id' => $item->id]);
        $this->assertDatabaseMissing('publication_collection', ['publication_id' => $publication->id]);
    }
}
