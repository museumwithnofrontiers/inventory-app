<?php

namespace Tests\Filament\Resources;

use App\Filament\Resources\CollectionResource\Pages\EditCollection;
use App\Filament\Resources\CollectionResource\RelationManagers\TranslationsRelationManager as CollectionTranslationsRelationManager;
use App\Filament\Resources\CollectionTranslationResource;
use App\Filament\Resources\CollectionTranslationResource\Pages\EditCollectionTranslation;
use App\Filament\Resources\CollectionTranslationResource\Pages\ListCollectionTranslation;
use App\Filament\Resources\CollectionTranslationResource\Pages\ViewCollectionTranslation;
use App\Filament\Resources\CollectionTranslationResource\RelationManagers\SiblingTranslationsRelationManager as CollectionSiblingTranslationsRelationManager;
use App\Filament\Resources\ItemResource\Pages\EditItem;
use App\Filament\Resources\ItemResource\RelationManagers\TranslationsRelationManager as ItemTranslationsRelationManager;
use App\Filament\Resources\ItemTranslationResource;
use App\Filament\Resources\ItemTranslationResource\Pages\EditItemTranslation;
use App\Filament\Resources\ItemTranslationResource\Pages\ListItemTranslation;
use App\Filament\Resources\ItemTranslationResource\Pages\ViewItemTranslation;
use App\Filament\Resources\ItemTranslationResource\RelationManagers\SiblingTranslationsRelationManager as ItemSiblingTranslationsRelationManager;
use App\Filament\Resources\PartnerResource\Pages\EditPartner;
use App\Filament\Resources\PartnerResource\RelationManagers\TranslationsRelationManager as PartnerTranslationsRelationManager;
use App\Filament\Resources\PartnerTranslationResource;
use App\Filament\Resources\PartnerTranslationResource\Pages\EditPartnerTranslation;
use App\Filament\Resources\PartnerTranslationResource\Pages\ListPartnerTranslation;
use App\Filament\Resources\PartnerTranslationResource\Pages\ViewPartnerTranslation;
use App\Filament\Resources\PartnerTranslationResource\RelationManagers\SiblingTranslationsRelationManager as PartnerSiblingTranslationsRelationManager;
use App\Filament\Widgets\SiblingTranslationsWidget;
use App\Models\Collection;
use App\Models\CollectionTranslation;
use App\Models\Context;
use App\Models\Item;
use App\Models\ItemTranslation;
use App\Models\Language;
use App\Models\Partner;
use App\Models\PartnerTranslation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\View\ViewException;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * Tests for translation navigation, sibling context, and improved search.
 *
 * Covers:
 * - Relation manager row actions navigate to canonical TranslationResource pages.
 * - Translation view/edit pages expose a policy-aware "View parent" header action.
 * - Translation view/edit pages render a sibling translations table.
 * - Standalone translation list search by UUID, backward_compatibility, and parent identifiers.
 * - Translation form parent select finds records by UUID and backward_compatibility.
 * - View-only users can access view navigation but not edit pages/actions.
 */
class TranslationNavigationTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    // ── Item Translations: Relation Manager Row Actions ────────────────────────

    public function test_item_translations_relation_manager_exposes_view_translation_action(): void
    {
        $user = $this->createCrudUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);
        $item = Item::factory()->Object()->create(['internal_name' => 'Temple relief']);
        $translation = ItemTranslation::factory()->create([
            'item_id' => $item->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Temple Relief EN',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ItemTranslationsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->assertTableActionExists('viewTranslation', record: $translation);
    }

    public function test_item_translations_relation_manager_view_translation_url_targets_canonical_page(): void
    {
        $user = $this->createCrudUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);
        $item = Item::factory()->Object()->create(['internal_name' => 'Temple relief']);
        $translation = ItemTranslation::factory()->create([
            'item_id' => $item->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Temple Relief EN',
        ]);

        $this->setCurrentPanel();

        $expectedViewUrl = ItemTranslationResource::getUrl('view', ['record' => $translation]);
        $expectedEditUrl = ItemTranslationResource::getUrl('edit', ['record' => $translation]);

        $this->assertNotEmpty($expectedViewUrl);
        $this->assertNotEmpty($expectedEditUrl);
        $this->assertStringContainsString('item-translations', $expectedViewUrl);
        $this->assertStringContainsString('item-translations', $expectedEditUrl);
        $this->assertStringContainsString($translation->id, $expectedViewUrl);
        $this->assertStringContainsString($translation->id, $expectedEditUrl);
    }

    public function test_item_translations_relation_manager_exposes_edit_translation_action(): void
    {
        $user = $this->createCrudUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);
        $item = Item::factory()->Object()->create(['internal_name' => 'Temple relief']);
        $translation = ItemTranslation::factory()->create([
            'item_id' => $item->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Temple Relief EN',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ItemTranslationsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->assertTableActionExists('editTranslation', record: $translation);
    }

    public function test_item_translations_relation_manager_exposes_view_parent_item_action(): void
    {
        $user = $this->createCrudUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);
        $item = Item::factory()->Object()->create(['internal_name' => 'Temple relief']);
        $translation = ItemTranslation::factory()->create([
            'item_id' => $item->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Temple Relief EN',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ItemTranslationsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->assertTableActionExists('viewParentItem', record: $translation);
    }

    // ── Collection Translations: Relation Manager Row Actions ─────────────────

    public function test_collection_translations_relation_manager_exposes_view_and_edit_translation_actions(): void
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
            ->test(CollectionTranslationsRelationManager::class, [
                'ownerRecord' => $collection,
                'pageClass' => EditCollection::class,
            ])
            ->assertTableActionExists('viewTranslation', record: $translation)
            ->assertTableActionExists('editTranslation', record: $translation)
            ->assertTableActionExists('viewParentCollection', record: $translation);
    }

    public function test_collection_translations_relation_manager_view_translation_url_targets_canonical_page(): void
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

        $expectedViewUrl = CollectionTranslationResource::getUrl('view', ['record' => $translation]);
        $expectedEditUrl = CollectionTranslationResource::getUrl('edit', ['record' => $translation]);

        $this->assertStringContainsString('collection-translations', $expectedViewUrl);
        $this->assertStringContainsString('collection-translations', $expectedEditUrl);
        $this->assertStringContainsString($translation->id, $expectedViewUrl);
        $this->assertStringContainsString($translation->id, $expectedEditUrl);
    }

    // ── Partner Translations: Relation Manager Row Actions ────────────────────

    public function test_partner_translations_relation_manager_exposes_view_and_edit_translation_actions(): void
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
            ->test(PartnerTranslationsRelationManager::class, [
                'ownerRecord' => $partner,
                'pageClass' => EditPartner::class,
            ])
            ->assertTableActionExists('viewTranslation', record: $translation)
            ->assertTableActionExists('editTranslation', record: $translation)
            ->assertTableActionExists('viewParentPartner', record: $translation);
    }

    public function test_partner_translations_relation_manager_view_translation_url_targets_canonical_page(): void
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

        $expectedViewUrl = PartnerTranslationResource::getUrl('view', ['record' => $translation]);
        $expectedEditUrl = PartnerTranslationResource::getUrl('edit', ['record' => $translation]);

        $this->assertStringContainsString('partner-translations', $expectedViewUrl);
        $this->assertStringContainsString('partner-translations', $expectedEditUrl);
        $this->assertStringContainsString($translation->id, $expectedViewUrl);
        $this->assertStringContainsString($translation->id, $expectedEditUrl);
    }

    // ── Item Translation Page: Parent Action + Sibling Widget ─────────────────

    public function test_view_item_translation_page_exposes_view_parent_item_action(): void
    {
        $user = $this->createCrudUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);
        $item = Item::factory()->Object()->create(['internal_name' => 'Temple relief']);
        $translation = ItemTranslation::factory()->create([
            'item_id' => $item->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Temple Relief EN',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ViewItemTranslation::class, ['record' => $translation->getRouteKey()])
            ->assertActionExists('viewParentItem');
    }

    public function test_edit_item_translation_page_exposes_view_parent_item_action(): void
    {
        $user = $this->createCrudUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);
        $item = Item::factory()->Object()->create(['internal_name' => 'Temple relief']);
        $translation = ItemTranslation::factory()->create([
            'item_id' => $item->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Temple Relief EN',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(EditItemTranslation::class, ['record' => $translation->getRouteKey()])
            ->assertActionExists('viewParentItem');
    }

    public function test_item_translation_view_page_exposes_sibling_translations_relation_manager(): void
    {
        $this->assertContains(
            ItemSiblingTranslationsRelationManager::class,
            ItemTranslationResource::getRelations()
        );
    }

    public function test_item_translation_view_page_renders_sibling_widget_output(): void
    {
        $user = $this->createCrudUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $langFr = Language::factory()->create(['id' => 'fra', 'internal_name' => 'French', 'is_default' => false]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);
        $item = Item::factory()->Object()->create(['internal_name' => 'Temple relief']);
        $translation = ItemTranslation::factory()->create([
            'item_id' => $item->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Temple Relief EN',
        ]);
        ItemTranslation::factory()->create([
            'item_id' => $item->id,
            'language_id' => $langFr->id,
            'context_id' => $context->id,
            'name' => 'Temple Relief FR',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(SiblingTranslationsWidget::class, [
                'parentId' => $item->id,
                'parentType' => 'item',
            ])
            ->assertSee('Sibling Item Translations')
            ->assertSee('Temple Relief EN')
            ->assertSee('Temple Relief FR');
    }

    public function test_sibling_translations_widget_shows_siblings_for_item(): void
    {
        $user = $this->createCrudUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $langFr = Language::factory()->create(['id' => 'fra', 'internal_name' => 'French', 'is_default' => false]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);
        $item = Item::factory()->Object()->create(['internal_name' => 'Temple relief']);
        $t1 = ItemTranslation::factory()->create([
            'item_id' => $item->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Temple Relief EN',
        ]);
        $t2 = ItemTranslation::factory()->create([
            'item_id' => $item->id,
            'language_id' => $langFr->id,
            'context_id' => $context->id,
            'name' => 'Temple Relief FR',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(SiblingTranslationsWidget::class, [
                'parentId' => $item->id,
                'parentType' => 'item',
            ])
            ->assertSee('Temple Relief EN')
            ->assertSee('Temple Relief FR');
    }

    // ── Collection Translation Page: Parent Action + Sibling Widget ───────────

    public function test_view_collection_translation_page_exposes_view_parent_collection_action(): void
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
            ->test(ViewCollectionTranslation::class, ['record' => $translation->getRouteKey()])
            ->assertActionExists('viewParentCollection');
    }

    public function test_edit_collection_translation_page_exposes_view_parent_collection_action(): void
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
            ->test(EditCollectionTranslation::class, ['record' => $translation->getRouteKey()])
            ->assertActionExists('viewParentCollection');
    }

    public function test_sibling_translations_widget_shows_siblings_for_collection(): void
    {
        $user = $this->createCrudUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $langFr = Language::factory()->create(['id' => 'fra', 'internal_name' => 'French', 'is_default' => false]);
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
        CollectionTranslation::factory()->create([
            'collection_id' => $collection->id,
            'language_id' => $langFr->id,
            'context_id' => $context->id,
            'title' => 'Temple Collection FR',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(SiblingTranslationsWidget::class, [
                'parentId' => $collection->id,
                'parentType' => 'collection',
            ])
            ->assertSee('Temple Collection EN')
            ->assertSee('Temple Collection FR');
    }

    public function test_collection_translation_view_page_exposes_sibling_translations_relation_manager(): void
    {
        $this->assertContains(
            CollectionSiblingTranslationsRelationManager::class,
            CollectionTranslationResource::getRelations()
        );
    }

    public function test_collection_translation_view_page_renders_sibling_widget_output(): void
    {
        $user = $this->createCrudUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $langFr = Language::factory()->create(['id' => 'fra', 'internal_name' => 'French', 'is_default' => false]);
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
        CollectionTranslation::factory()->create([
            'collection_id' => $collection->id,
            'language_id' => $langFr->id,
            'context_id' => $context->id,
            'title' => 'Temple Collection FR',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(SiblingTranslationsWidget::class, [
                'parentId' => $collection->id,
                'parentType' => 'collection',
            ])
            ->assertSee('Sibling Collection Translations')
            ->assertSee('Temple Collection EN')
            ->assertSee('Temple Collection FR');
    }

    // ── Partner Translation Page: Parent Action + Sibling Widget ──────────────

    public function test_view_partner_translation_page_exposes_view_parent_partner_action(): void
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
            ->test(ViewPartnerTranslation::class, ['record' => $translation->getRouteKey()])
            ->assertActionExists('viewParentPartner');
    }

    public function test_edit_partner_translation_page_exposes_view_parent_partner_action(): void
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
            ->test(EditPartnerTranslation::class, ['record' => $translation->getRouteKey()])
            ->assertActionExists('viewParentPartner');
    }

    public function test_sibling_translations_widget_shows_siblings_for_partner(): void
    {
        $user = $this->createCrudUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $langFr = Language::factory()->create(['id' => 'fra', 'internal_name' => 'French', 'is_default' => false]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);
        $partner = Partner::factory()->create(['internal_name' => 'Jordan Museum']);
        PartnerTranslation::factory()->create([
            'partner_id' => $partner->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Jordan Museum EN',
        ]);
        PartnerTranslation::factory()->create([
            'partner_id' => $partner->id,
            'language_id' => $langFr->id,
            'context_id' => $context->id,
            'name' => 'Jordan Museum FR',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(SiblingTranslationsWidget::class, [
                'parentId' => $partner->id,
                'parentType' => 'partner',
            ])
            ->assertSee('Jordan Museum EN')
            ->assertSee('Jordan Museum FR');
    }

    public function test_partner_translation_view_page_exposes_sibling_translations_relation_manager(): void
    {
        $this->assertContains(
            PartnerSiblingTranslationsRelationManager::class,
            PartnerTranslationResource::getRelations()
        );
    }

    public function test_partner_translation_view_page_renders_sibling_widget_output(): void
    {
        $user = $this->createCrudUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $langFr = Language::factory()->create(['id' => 'fra', 'internal_name' => 'French', 'is_default' => false]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);
        $partner = Partner::factory()->create(['internal_name' => 'Jordan Museum']);
        $translation = PartnerTranslation::factory()->create([
            'partner_id' => $partner->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Jordan Museum EN',
        ]);
        PartnerTranslation::factory()->create([
            'partner_id' => $partner->id,
            'language_id' => $langFr->id,
            'context_id' => $context->id,
            'name' => 'Jordan Museum FR',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(SiblingTranslationsWidget::class, [
                'parentId' => $partner->id,
                'parentType' => 'partner',
            ])
            ->assertSee('Sibling Partner Translations')
            ->assertSee('Jordan Museum EN')
            ->assertSee('Jordan Museum FR');
    }

    // ── Item Translation List Search ───────────────────────────────────────────

    public function test_item_translation_list_search_by_translation_uuid(): void
    {
        $user = $this->createCrudUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);
        $item = Item::factory()->Object()->create(['internal_name' => 'Temple relief']);
        $translation = ItemTranslation::factory()->create([
            'item_id' => $item->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Temple Relief EN',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListItemTranslation::class)
            ->searchTable($translation->id)
            ->assertCanSeeTableRecords([$translation]);
    }

    public function test_item_translation_list_search_by_translation_backward_compatibility(): void
    {
        $user = $this->createCrudUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);
        $item = Item::factory()->Object()->create(['internal_name' => 'Temple relief']);
        $translation = ItemTranslation::factory()->create([
            'item_id' => $item->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Temple Relief EN',
            'backward_compatibility' => 'item-trans-legacy-001',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListItemTranslation::class)
            ->searchTable('item-trans-legacy-001')
            ->assertCanSeeTableRecords([$translation]);
    }

    public function test_item_translation_list_search_by_parent_uuid(): void
    {
        $user = $this->createCrudUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);
        $item = Item::factory()->Object()->create(['internal_name' => 'Temple relief']);
        $translation = ItemTranslation::factory()->create([
            'item_id' => $item->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Temple Relief EN',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListItemTranslation::class)
            ->searchTable($item->id)
            ->assertCanSeeTableRecords([$translation]);
    }

    public function test_item_translation_list_search_by_parent_backward_compatibility(): void
    {
        $user = $this->createCrudUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);
        $item = Item::factory()->Object()->create([
            'internal_name' => 'Temple relief',
            'backward_compatibility' => 'parent-item-legacy-42',
        ]);
        $translation = ItemTranslation::factory()->create([
            'item_id' => $item->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Temple Relief EN',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListItemTranslation::class)
            ->searchTable('parent-item-legacy-42')
            ->assertCanSeeTableRecords([$translation]);
    }

    // ── Collection Translation List Search ─────────────────────────────────────

    public function test_collection_translation_list_search_by_translation_uuid(): void
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
            ->searchTable($translation->id)
            ->assertCanSeeTableRecords([$translation]);
    }

    public function test_collection_translation_list_search_by_translation_backward_compatibility(): void
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
            'backward_compatibility' => 'coll-trans-legacy-007',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListCollectionTranslation::class)
            ->searchTable('coll-trans-legacy-007')
            ->assertCanSeeTableRecords([$translation]);
    }

    public function test_collection_translation_list_search_by_parent_uuid(): void
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
            ->searchTable($collection->id)
            ->assertCanSeeTableRecords([$translation]);
    }

    public function test_collection_translation_list_search_by_parent_backward_compatibility(): void
    {
        $user = $this->createCrudUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);
        $collection = Collection::factory()->create([
            'internal_name' => 'Temple collection',
            'context_id' => $context->id,
            'language_id' => $language->id,
            'backward_compatibility' => 'coll-parent-legacy-55',
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
            ->searchTable('coll-parent-legacy-55')
            ->assertCanSeeTableRecords([$translation]);
    }

    // ── Partner Translation List Search ────────────────────────────────────────

    public function test_partner_translation_list_search_by_translation_uuid(): void
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
            ->searchTable($translation->id)
            ->assertCanSeeTableRecords([$translation]);
    }

    public function test_partner_translation_list_search_by_translation_backward_compatibility(): void
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
            'backward_compatibility' => 'partner-trans-legacy-99',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListPartnerTranslation::class)
            ->searchTable('partner-trans-legacy-99')
            ->assertCanSeeTableRecords([$translation]);
    }

    public function test_partner_translation_list_search_by_parent_uuid(): void
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
            ->searchTable($partner->id)
            ->assertCanSeeTableRecords([$translation]);
    }

    public function test_partner_translation_list_search_by_parent_backward_compatibility(): void
    {
        $user = $this->createCrudUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);
        $partner = Partner::factory()->create([
            'internal_name' => 'Jordan Museum',
            'backward_compatibility' => 'partner-parent-legacy-33',
        ]);
        $translation = PartnerTranslation::factory()->create([
            'partner_id' => $partner->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Jordan Museum EN',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListPartnerTranslation::class)
            ->searchTable('partner-parent-legacy-33')
            ->assertCanSeeTableRecords([$translation]);
    }

    // ── View-only user: navigation access but no edit ─────────────────────────

    public function test_view_only_user_can_see_translation_view_page(): void
    {
        $user = $this->createViewOnlyUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);
        $item = Item::factory()->Object()->create(['internal_name' => 'Temple relief']);
        $translation = ItemTranslation::factory()->create([
            'item_id' => $item->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Temple Relief EN',
        ]);

        $this->actingAs($user)
            ->get("/admin/item-translations/{$translation->getKey()}")
            ->assertOk();
    }

    public function test_view_only_user_cannot_access_translation_edit_page(): void
    {
        $user = $this->createViewOnlyUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);
        $item = Item::factory()->Object()->create(['internal_name' => 'Temple relief']);
        $translation = ItemTranslation::factory()->create([
            'item_id' => $item->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Temple Relief EN',
        ]);

        $this->actingAs($user)
            ->get("/admin/item-translations/{$translation->getKey()}/edit")
            ->assertForbidden();
    }

    // ── Edit page parent select hydration (issue #1105 regression) ────────────

    public function test_item_translation_edit_page_hydrates_without_error(): void
    {
        $user = $this->createCrudUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);
        $item = Item::factory()->Object()->create(['internal_name' => 'Temple relief']);
        $translation = ItemTranslation::factory()->create([
            'item_id' => $item->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Temple Relief EN',
        ]);

        $this->actingAs($user)
            ->get("/admin/item-translations/{$translation->getKey()}/edit")
            ->assertOk();
    }

    public function test_item_translation_edit_page_shows_parent_label_with_legacy_id(): void
    {
        $user = $this->createCrudUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);
        $item = Item::factory()->Object()->create([
            'internal_name' => 'Temple relief',
            'backward_compatibility' => 'item-legacy-42',
        ]);
        $translation = ItemTranslation::factory()->create([
            'item_id' => $item->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Temple Relief EN',
        ]);

        $this->setCurrentPanel();

        $livewire = Livewire::actingAs($user)
            ->test(EditItemTranslation::class, ['record' => $translation->getRouteKey()]);
        $label = $livewire->instance()->getFormSelectOptionLabel('data.item_id');

        // The selector now shows the resolved display label (translated name) instead of
        // the legacy internal_name [backward_compatibility] format.
        $this->assertEquals('Temple Relief EN', $label);
    }

    public function test_collection_translation_edit_page_hydrates_without_error(): void
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

        $this->actingAs($user)
            ->get("/admin/collection-translations/{$translation->getKey()}/edit")
            ->assertOk();
    }

    public function test_collection_translation_edit_page_shows_parent_label_with_legacy_id(): void
    {
        $user = $this->createCrudUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);
        $collection = Collection::factory()->create([
            'internal_name' => 'Temple collection',
            'context_id' => $context->id,
            'language_id' => $language->id,
            'backward_compatibility' => 'coll-legacy-7',
        ]);
        $translation = CollectionTranslation::factory()->create([
            'collection_id' => $collection->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'title' => 'Temple Collection EN',
        ]);

        $this->setCurrentPanel();

        $livewire = Livewire::actingAs($user)
            ->test(EditCollectionTranslation::class, ['record' => $translation->getRouteKey()]);
        $label = $livewire->instance()->getFormSelectOptionLabel('data.collection_id');

        // The selector now shows the resolved display label (translated title) instead of
        // the legacy internal_name [backward_compatibility] format.
        $this->assertEquals('Temple Collection EN', $label);
    }

    public function test_partner_translation_edit_page_hydrates_without_error(): void
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

        $this->actingAs($user)
            ->get("/admin/partner-translations/{$translation->getKey()}/edit")
            ->assertOk()
            ->assertSee('Jordan Museum');
    }

    public function test_partner_translation_edit_page_shows_parent_label_with_legacy_id(): void
    {
        $user = $this->createCrudUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);
        $partner = Partner::factory()->create([
            'internal_name' => 'Jordan Museum',
            'backward_compatibility' => 'partner-legacy-99',
        ]);
        $translation = PartnerTranslation::factory()->create([
            'partner_id' => $partner->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Jordan Museum EN',
        ]);

        $this->setCurrentPanel();

        $livewire = Livewire::actingAs($user)
            ->test(EditPartnerTranslation::class, ['record' => $translation->getRouteKey()]);
        $label = $livewire->instance()->getFormSelectOptionLabel('data.partner_id');

        // The selector now shows the resolved display label (translated name) instead of
        // the legacy internal_name [backward_compatibility] format.
        $this->assertEquals('Jordan Museum EN', $label);
    }

    // ── SiblingTranslationsWidget: fail-fast guards ────────────────────────────

    public function test_sibling_translations_widget_throws_for_invalid_parent_type(): void
    {
        $user = $this->createCrudUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => true]);
        $item = Item::factory()->Object()->create(['internal_name' => 'Temple relief']);
        ItemTranslation::factory()->create([
            'item_id' => $item->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Temple Relief EN',
        ]);

        $this->setCurrentPanel();

        // Blade wraps exceptions thrown during rendering in ViewException.
        // Verify the cause is the expected InvalidArgumentException from the guard.
        try {
            Livewire::actingAs($user)
                ->test(SiblingTranslationsWidget::class, [
                    'parentId' => $item->id,
                    'parentType' => 'unknown_type',
                ]);
            $this->fail('Expected an exception to be thrown for invalid parentType.');
        } catch (ViewException $e) {
            $this->assertInstanceOf(\InvalidArgumentException::class, $e->getPrevious());
            $this->assertStringContainsString('Unsupported parentType', $e->getMessage());
        }
    }

    public function test_sibling_translations_widget_throws_for_empty_parent_id(): void
    {
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        // Blade wraps exceptions thrown during rendering in ViewException.
        // Verify the cause is the expected InvalidArgumentException from the guard.
        try {
            Livewire::actingAs($user)
                ->test(SiblingTranslationsWidget::class, [
                    'parentId' => '',
                    'parentType' => 'item',
                ]);
            $this->fail('Expected an exception to be thrown for empty parentId.');
        } catch (ViewException $e) {
            $this->assertInstanceOf(\InvalidArgumentException::class, $e->getPrevious());
            $this->assertStringContainsString('non-empty parentId', $e->getMessage());
        }
    }
}
