<?php

namespace Tests\Filament\Resources;

use App\Filament\Resources\CollectionTranslationResource\Pages\CreateCollectionTranslation;
use App\Filament\Resources\CollectionTranslationResource\Pages\EditCollectionTranslation;
use App\Filament\Resources\CollectionTranslationResource\Pages\ListCollectionTranslation;
use App\Filament\Resources\CollectionTranslationResource\Pages\ViewCollectionTranslation;
use App\Filament\Resources\ItemTranslationResource\Pages\CreateItemTranslation;
use App\Filament\Resources\ItemTranslationResource\Pages\EditItemTranslation;
use App\Filament\Resources\ItemTranslationResource\Pages\ListItemTranslation;
use App\Filament\Resources\ItemTranslationResource\Pages\ViewItemTranslation;
use App\Filament\Resources\PartnerTranslationResource\Pages\CreatePartnerTranslation;
use App\Filament\Resources\PartnerTranslationResource\Pages\EditPartnerTranslation;
use App\Filament\Resources\PartnerTranslationResource\Pages\ListPartnerTranslation;
use App\Filament\Resources\PartnerTranslationResource\Pages\ViewPartnerTranslation;
use App\Models\Author;
use App\Models\Collection;
use App\Models\CollectionTranslation;
use App\Models\Context;
use App\Models\Item;
use App\Models\ItemTranslation;
use App\Models\Language;
use App\Models\Partner;
use App\Models\PartnerTranslation;
use Filament\Tables\Actions\DeleteAction;
use Filament\Tables\Actions\ViewAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

class TranslationResourceTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    // ─── ItemTranslation ────────────────────────────────────────────────────────

    public function test_authorized_users_can_render_all_item_translation_resource_pages(): void
    {
        $user = $this->createCrudUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);
        $item = Item::factory()->Object()->create(['internal_name' => 'Temple relief']);
        $translation = ItemTranslation::factory()->create([
            'item_id' => $item->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Relief of the temple',
        ]);

        $this->actingAs($user)->get('/admin/item-translations')
            ->assertOk()
            ->assertSee('Item Translations');

        $this->actingAs($user)->get('/admin/item-translations/create')
            ->assertOk()
            ->assertSee('Create');

        $this->actingAs($user)->get("/admin/item-translations/{$translation->getKey()}/edit")
            ->assertOk()
            ->assertSee('Relief of the temple');

        $this->actingAs($user)->get("/admin/item-translations/{$translation->getKey()}")
            ->assertOk()
            ->assertSee('Relief of the temple');
    }

    public function test_authorized_users_can_crud_item_translations(): void
    {
        $user = $this->createCrudUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);
        $item = Item::factory()->Object()->create(['internal_name' => 'Temple relief']);
        $translation = ItemTranslation::factory()->create([
            'item_id' => $item->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Relief of the temple',
            'description' => 'A carved stone relief.',
        ]);

        $this->setCurrentPanel();

        // Create
        $langFr = Language::factory()->create(['id' => 'fra', 'internal_name' => 'French', 'is_default' => false]);
        Livewire::actingAs($user)
            ->test(CreateItemTranslation::class)
            ->fillForm([
                'item_id' => $item->id,
                'language_id' => $langFr->id,
                'context_id' => $context->id,
                'name' => 'Relief du temple',
                'description' => 'Un relief en pierre sculpté.',
            ])
            ->call('create')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('item_translations', [
            'item_id' => $item->id,
            'language_id' => $langFr->id,
            'context_id' => $context->id,
            'name' => 'Relief du temple',
        ]);

        // Edit
        Livewire::actingAs($user)
            ->test(EditItemTranslation::class, ['record' => $translation->getRouteKey()])
            ->assertFormSet([
                'name' => 'Relief of the temple',
            ])
            ->fillForm(['name' => 'Temple wall relief', 'description' => 'Updated description.'])
            ->call('save')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('item_translations', [
            'id' => $translation->id,
            'name' => 'Temple wall relief',
            'description' => 'Updated description.',
        ]);

        // Delete
        Livewire::actingAs($user)
            ->test(ListItemTranslation::class)
            ->callTableAction(DeleteAction::class, $translation)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('item_translations', ['id' => $translation->id]);
    }

    public function test_item_translation_duplicate_prevention(): void
    {
        $user = $this->createCrudUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);
        $item = Item::factory()->Object()->create(['internal_name' => 'Temple relief']);
        ItemTranslation::factory()->create([
            'item_id' => $item->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Relief of the temple',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CreateItemTranslation::class)
            ->fillForm([
                'item_id' => $item->id,
                'language_id' => $language->id,
                'context_id' => $context->id,
                'name' => 'Duplicate translation',
            ])
            ->call('create')
            ->assertHasFormErrors(['language_id']);
    }

    public function test_missing_fallback_filter_works_for_item_translations(): void
    {
        $user = $this->createCrudUser();
        $defaultLang = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $otherLang = Language::factory()->create(['id' => 'fra', 'internal_name' => 'French', 'is_default' => false]);
        $defaultCtx = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);

        // Item A has no default translation
        $itemA = Item::factory()->Object()->create(['internal_name' => 'Item A']);
        $translationA = ItemTranslation::factory()->create([
            'item_id' => $itemA->id,
            'language_id' => $otherLang->id,
            'context_id' => $defaultCtx->id,
            'name' => 'Item A French',
        ]);

        // Item B has a default translation AND a non-default one
        $itemB = Item::factory()->Object()->create(['internal_name' => 'Item B']);
        $translationBDefault = ItemTranslation::factory()->create([
            'item_id' => $itemB->id,
            'language_id' => $defaultLang->id,
            'context_id' => $defaultCtx->id,
            'name' => 'Item B English',
        ]);
        $translationBFrench = ItemTranslation::factory()->create([
            'item_id' => $itemB->id,
            'language_id' => $otherLang->id,
            'context_id' => $defaultCtx->id,
            'name' => 'Item B French',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListItemTranslation::class)
            ->filterTable('missing_fallback')
            ->assertCanSeeTableRecords([$translationA])
            ->assertCanNotSeeTableRecords([$translationBDefault, $translationBFrench]);
    }

    // ─── CollectionTranslation ──────────────────────────────────────────────────

    public function test_item_translation_view_action_and_view_page_work(): void
    {
        $user = $this->createCrudUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);
        $item = Item::factory()->Object()->create(['internal_name' => 'Temple relief']);
        $translation = ItemTranslation::factory()->create([
            'item_id' => $item->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Relief of the temple',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListItemTranslation::class)
            ->assertTableActionExists(ViewAction::class, record: $translation);

        Livewire::actingAs($user)
            ->test(ViewItemTranslation::class, ['record' => $translation->getRouteKey()])
            ->assertSee('Relief of the temple');
    }

    // ─── CollectionTranslation ──────────────────────────────────────────────────

    public function test_authorized_users_can_render_all_collection_translation_resource_pages(): void
    {
        $user = $this->createCrudUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);
        $collection = Collection::factory()->create([
            'internal_name' => 'Temple collection',
            'context_id' => $context->id,
            'language_id' => $language->id,
        ]);
        $translation = CollectionTranslation::factory()->create([
            'collection_id' => $collection->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'title' => 'Temple Collection EN',
        ]);

        $this->actingAs($user)->get('/admin/collection-translations')
            ->assertOk()
            ->assertSee('Collection Translations');

        $this->actingAs($user)->get('/admin/collection-translations/create')
            ->assertOk()
            ->assertSee('Create');

        $this->actingAs($user)->get("/admin/collection-translations/{$translation->getKey()}/edit")
            ->assertOk()
            ->assertSee('Temple Collection EN');

        $this->actingAs($user)->get("/admin/collection-translations/{$translation->getKey()}")
            ->assertOk()
            ->assertSee('Temple Collection EN');
    }

    public function test_authorized_users_can_crud_collection_translations(): void
    {
        $user = $this->createCrudUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);
        $collection = Collection::factory()->create([
            'internal_name' => 'Temple collection',
            'context_id' => $context->id,
            'language_id' => $language->id,
        ]);
        $translation = CollectionTranslation::factory()->create([
            'collection_id' => $collection->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'title' => 'Temple Collection EN',
        ]);

        $this->setCurrentPanel();

        // Create
        $langFr = Language::factory()->create(['id' => 'fra', 'internal_name' => 'French', 'is_default' => false]);
        Livewire::actingAs($user)
            ->test(CreateCollectionTranslation::class)
            ->fillForm([
                'collection_id' => $collection->id,
                'language_id' => $langFr->id,
                'context_id' => $context->id,
                'title' => 'Collection du temple',
            ])
            ->call('create')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('collection_translations', [
            'collection_id' => $collection->id,
            'language_id' => $langFr->id,
            'context_id' => $context->id,
            'title' => 'Collection du temple',
        ]);

        // Edit
        Livewire::actingAs($user)
            ->test(EditCollectionTranslation::class, ['record' => $translation->getRouteKey()])
            ->assertFormSet(['title' => 'Temple Collection EN'])
            ->fillForm(['title' => 'Temple Collection Updated'])
            ->call('save')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('collection_translations', [
            'id' => $translation->id,
            'title' => 'Temple Collection Updated',
        ]);

        // Delete
        Livewire::actingAs($user)
            ->test(ListCollectionTranslation::class)
            ->callTableAction(DeleteAction::class, $translation)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('collection_translations', ['id' => $translation->id]);
    }

    public function test_collection_translation_duplicate_prevention(): void
    {
        $user = $this->createCrudUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);
        $collection = Collection::factory()->create([
            'internal_name' => 'Temple collection',
            'context_id' => $context->id,
            'language_id' => $language->id,
        ]);
        CollectionTranslation::factory()->create([
            'collection_id' => $collection->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'title' => 'Temple Collection EN',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CreateCollectionTranslation::class)
            ->fillForm([
                'collection_id' => $collection->id,
                'language_id' => $language->id,
                'context_id' => $context->id,
                'title' => 'Duplicate collection translation',
            ])
            ->call('create')
            ->assertHasFormErrors(['language_id']);
    }

    // ─── PartnerTranslation ─────────────────────────────────────────────────────

    public function test_collection_translation_view_action_and_view_page_work(): void
    {
        $user = $this->createCrudUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);
        $collection = Collection::factory()->create([
            'internal_name' => 'Temple collection',
            'context_id' => $context->id,
            'language_id' => $language->id,
        ]);
        $translation = CollectionTranslation::factory()->create([
            'collection_id' => $collection->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'title' => 'Temple Collection EN',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListCollectionTranslation::class)
            ->assertTableActionExists(ViewAction::class, record: $translation);

        Livewire::actingAs($user)
            ->test(ViewCollectionTranslation::class, ['record' => $translation->getRouteKey()])
            ->assertSee('Temple Collection EN');
    }

    // ─── PartnerTranslation ─────────────────────────────────────────────────────

    public function test_authorized_users_can_render_all_partner_translation_resource_pages(): void
    {
        $user = $this->createCrudUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);
        $partner = Partner::factory()->create(['internal_name' => 'Jordan Museum']);
        $translation = PartnerTranslation::factory()->create([
            'partner_id' => $partner->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Jordan Museum EN',
        ]);

        $this->actingAs($user)->get('/admin/partner-translations')
            ->assertOk()
            ->assertSee('Partner Translations');

        $this->actingAs($user)->get('/admin/partner-translations/create')
            ->assertOk()
            ->assertSee('Create');

        $this->actingAs($user)->get("/admin/partner-translations/{$translation->getKey()}/edit")
            ->assertOk()
            ->assertSee('Jordan Museum EN');

        $this->actingAs($user)->get("/admin/partner-translations/{$translation->getKey()}")
            ->assertOk()
            ->assertSee('Jordan Museum EN');
    }

    public function test_authorized_users_can_crud_partner_translations(): void
    {
        $user = $this->createCrudUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);
        $partner = Partner::factory()->create(['internal_name' => 'Jordan Museum']);
        $translation = PartnerTranslation::factory()->create([
            'partner_id' => $partner->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Jordan Museum EN',
            'description' => 'Museum description.',
        ]);

        $this->setCurrentPanel();

        // Create
        $langFr = Language::factory()->create(['id' => 'fra', 'internal_name' => 'French', 'is_default' => false]);
        Livewire::actingAs($user)
            ->test(CreatePartnerTranslation::class)
            ->fillForm([
                'partner_id' => $partner->id,
                'language_id' => $langFr->id,
                'context_id' => $context->id,
                'name' => 'Musée de Jordanie',
                'description' => 'Description du musée.',
            ])
            ->call('create')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('partner_translations', [
            'partner_id' => $partner->id,
            'language_id' => $langFr->id,
            'context_id' => $context->id,
            'name' => 'Musée de Jordanie',
        ]);

        // Edit
        Livewire::actingAs($user)
            ->test(EditPartnerTranslation::class, ['record' => $translation->getRouteKey()])
            ->assertFormSet(['name' => 'Jordan Museum EN'])
            ->fillForm(['name' => 'Jordan Heritage Museum', 'description' => 'Updated description.'])
            ->call('save')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('partner_translations', [
            'id' => $translation->id,
            'name' => 'Jordan Heritage Museum',
            'description' => 'Updated description.',
        ]);

        // Delete
        Livewire::actingAs($user)
            ->test(ListPartnerTranslation::class)
            ->callTableAction(DeleteAction::class, $translation)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('partner_translations', ['id' => $translation->id]);
    }

    public function test_partner_translation_duplicate_prevention(): void
    {
        $user = $this->createCrudUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);
        $partner = Partner::factory()->create(['internal_name' => 'Jordan Museum']);
        PartnerTranslation::factory()->create([
            'partner_id' => $partner->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Jordan Museum EN',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CreatePartnerTranslation::class)
            ->fillForm([
                'partner_id' => $partner->id,
                'language_id' => $language->id,
                'context_id' => $context->id,
                'name' => 'Duplicate partner translation',
            ])
            ->call('create')
            ->assertHasFormErrors(['language_id']);
    }

    // ─── Rich Field Tests ────────────────────────────────────────────────────────

    public function test_partner_translation_view_action_and_view_page_work(): void
    {
        $user = $this->createCrudUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);
        $partner = Partner::factory()->create(['internal_name' => 'Jordan Museum']);
        $translation = PartnerTranslation::factory()->create([
            'partner_id' => $partner->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Jordan Museum EN',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListPartnerTranslation::class)
            ->assertTableActionExists(ViewAction::class, record: $translation);

        Livewire::actingAs($user)
            ->test(ViewPartnerTranslation::class, ['record' => $translation->getRouteKey()])
            ->assertSee('Jordan Museum EN');
    }

    // ─── Rich Field Tests ────────────────────────────────────────────────────────

    public function test_item_translation_rich_fields_persist_through_form(): void
    {
        $user = $this->createCrudUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);
        $item = Item::factory()->Object()->create(['internal_name' => 'Temple relief']);
        $author = Author::factory()->create(['name' => 'Jane Author']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CreateItemTranslation::class)
            ->fillForm([
                'item_id' => $item->id,
                'language_id' => $language->id,
                'context_id' => $context->id,
                'name' => 'Rich item translation',
                'alternate_name' => 'Alt name',
                'description' => 'Full description text.',
                'type' => 'sculpture',
                'holder' => 'The British Museum',
                'owner' => 'Crown Estate',
                'initial_owner' => 'Unknown',
                'dates' => '3rd century BC',
                'location' => 'Room 18, British Museum',
                'dimensions' => '120x80x60 cm',
                'place_of_production' => 'Athens, Greece',
                'method_for_datation' => 'Carbon dating',
                'method_for_provenance' => 'Documentary evidence',
                'provenance' => 'Elgin Collection',
                'obtention' => 'Acquired 1801',
                'bibliography' => 'Smith, J. (1900). Ancient Reliefs.',
                'author_id' => $author->id,
                'backward_compatibility' => 'legacy-123',
                'extra' => '{"notes": "Some extra notes"}',
            ])
            ->call('create')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('item_translations', [
            'item_id' => $item->id,
            'language_id' => $language->id,
            'name' => 'Rich item translation',
            'type' => 'sculpture',
            'holder' => 'The British Museum',
            'dates' => '3rd century BC',
            'place_of_production' => 'Athens, Greece',
            'provenance' => 'Elgin Collection',
            'obtention' => 'Acquired 1801',
            'bibliography' => 'Smith, J. (1900). Ancient Reliefs.',
            'author_id' => $author->id,
            'backward_compatibility' => 'legacy-123',
        ]);

        $translation = ItemTranslation::where('item_id', $item->id)->where('language_id', $language->id)->first();
        $this->assertNotNull($translation);
        $extra = $this->extraToArray($translation->extra);
        $this->assertArrayHasKey('notes', $extra);
    }

    public function test_item_translation_contributor_fields_persist(): void
    {
        $user = $this->createCrudUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);
        $item = Item::factory()->Object()->create(['internal_name' => 'Temple relief']);
        $author = Author::factory()->create(['name' => 'Jane Author']);
        $editor = Author::factory()->create(['name' => 'Bob Editor']);
        $translator = Author::factory()->create(['name' => 'Alice Translator']);
        $copyEditor = Author::factory()->create(['name' => 'Carol Copy']);

        $translation = ItemTranslation::factory()->create([
            'item_id' => $item->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Original translation',
            'author_id' => null,
            'text_copy_editor_id' => null,
            'translator_id' => null,
            'translation_copy_editor_id' => null,
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(EditItemTranslation::class, ['record' => $translation->getRouteKey()])
            ->fillForm([
                'author_id' => $author->id,
                'text_copy_editor_id' => $editor->id,
                'translator_id' => $translator->id,
                'translation_copy_editor_id' => $copyEditor->id,
            ])
            ->call('save')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('item_translations', [
            'id' => $translation->id,
            'author_id' => $author->id,
            'text_copy_editor_id' => $editor->id,
            'translator_id' => $translator->id,
            'translation_copy_editor_id' => $copyEditor->id,
        ]);
    }

    public function test_partner_translation_rich_fields_persist_through_form(): void
    {
        $user = $this->createCrudUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);
        $partner = Partner::factory()->create(['internal_name' => 'Jordan Museum']);
        $translation = PartnerTranslation::factory()->create([
            'partner_id' => $partner->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Jordan Museum EN',
            'extra' => null,
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(EditPartnerTranslation::class, ['record' => $translation->getRouteKey()])
            ->fillForm([
                'city_display' => 'Amman',
                'address_line_1' => '1 Museum Street',
                'address_line_2' => 'Suite 100',
                'postal_code' => '11190',
                'address_notes' => 'Near the Citadel',
                'contact_name' => 'Dr. Ahmad',
                'contact_email_general' => 'info@jordanmuseum.jo',
                'contact_email_press' => 'press@jordanmuseum.jo',
                'contact_phone' => '+962 6 4629317',
                'contact_website' => 'https://www.jordanmuseum.jo',
                'contact_notes' => 'Open Sunday–Thursday',
                'backward_compatibility' => 'partner-legacy-42',
                'extra' => '{"type": "museum"}',
            ])
            ->call('save')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('partner_translations', [
            'id' => $translation->id,
            'city_display' => 'Amman',
            'address_line_1' => '1 Museum Street',
            'address_line_2' => 'Suite 100',
            'postal_code' => '11190',
            'address_notes' => 'Near the Citadel',
            'contact_name' => 'Dr. Ahmad',
            'contact_email_general' => 'info@jordanmuseum.jo',
            'contact_email_press' => 'press@jordanmuseum.jo',
            'contact_phone' => '+962 6 4629317',
            'contact_website' => 'https://www.jordanmuseum.jo',
            'contact_notes' => 'Open Sunday–Thursday',
            'backward_compatibility' => 'partner-legacy-42',
        ]);

        $translation->refresh();
        $extra = $this->extraToArray($translation->extra);
        $this->assertArrayHasKey('type', $extra);
        $this->assertSame('museum', $extra['type']);
    }

    public function test_partner_translation_contact_arrays_persist(): void
    {
        $user = $this->createCrudUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);
        $partner = Partner::factory()->create(['internal_name' => 'Jordan Museum']);
        $translation = PartnerTranslation::factory()->create([
            'partner_id' => $partner->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Jordan Museum EN',
            'contact_emails' => null,
            'contact_phones' => null,
            'extra' => null,
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(EditPartnerTranslation::class, ['record' => $translation->getRouteKey()])
            ->fillForm([
                'contact_emails' => [
                    ['value' => 'info@jordanmuseum.jo'],
                    ['value' => 'events@jordanmuseum.jo'],
                ],
                'contact_phones' => [
                    ['value' => '+962 6 4629317'],
                    ['value' => '+962 6 4629318'],
                ],
            ])
            ->call('save')
            ->assertHasNoFormErrors();

        $translation->refresh();
        $this->assertIsArray($translation->contact_emails);
        $this->assertContains('info@jordanmuseum.jo', $translation->contact_emails);
        $this->assertContains('events@jordanmuseum.jo', $translation->contact_emails);
        $this->assertIsArray($translation->contact_phones);
        $this->assertContains('+962 6 4629317', $translation->contact_phones);
    }

    public function test_collection_translation_rich_fields_persist_through_form(): void
    {
        $user = $this->createCrudUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);
        $collection = Collection::factory()->create([
            'internal_name' => 'Temple collection',
            'context_id' => $context->id,
            'language_id' => $language->id,
        ]);
        $translation = CollectionTranslation::factory()->create([
            'collection_id' => $collection->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'title' => 'Temple Collection EN',
            'quote' => null,
            'url' => null,
            'backward_compatibility' => null,
            'extra' => null,
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(EditCollectionTranslation::class, ['record' => $translation->getRouteKey()])
            ->fillForm([
                'title' => 'Temple Collection Updated',
                'description' => 'A rich collection description.',
                'quote' => '"Art speaks where words are unable to explain." — Mathiole',
                'url' => 'https://example.com/collections/temple',
                'backward_compatibility' => 'coll-legacy-99',
                'extra' => '{"curator": "Dr. Jones"}',
            ])
            ->call('save')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('collection_translations', [
            'id' => $translation->id,
            'title' => 'Temple Collection Updated',
            'description' => 'A rich collection description.',
            'quote' => '"Art speaks where words are unable to explain." — Mathiole',
            'url' => 'https://example.com/collections/temple',
            'backward_compatibility' => 'coll-legacy-99',
        ]);

        $translation->refresh();
        $extra = $this->extraToArray($translation->extra);
        $this->assertArrayHasKey('curator', $extra);
        $this->assertSame('Dr. Jones', $extra['curator']);
    }

    // ─── Helpers ────────────────────────────────────────────────────────────────

    /**
     * Normalise the model's `extra` attribute to a plain PHP array regardless of
     * whether it comes back as stdClass (object cast) or a plain array.
     *
     * @return array<string, mixed>
     */
    protected function extraToArray(mixed $extra): array
    {
        if (is_array($extra)) {
            return $extra;
        }

        return (array) $extra;
    }
}
