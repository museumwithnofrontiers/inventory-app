<?php

namespace Tests\Filament\Resources;

use App\Enums\ItemType;
use App\Enums\Permission;
use App\Filament\Resources\CollectionResource;
use App\Filament\Resources\ItemResource;
use App\Filament\Resources\ItemResource\Pages\ViewItem;
use App\Filament\Resources\ItemResource\RelationManagers\PictureItemsRelationManager;
use App\Filament\Support\ItemDisplayLabel;
use App\Models\Collection;
use App\Models\Context;
use App\Models\Item;
use App\Models\Language;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * Regression tests for translated display labels on items and collections.
 *
 * Covers Stories #1250 (picture child items), #1251 (record titles),
 * #1252 (parent fields), and #1253 (imported-style name regression).
 *
 * Picture item label fallback order:
 *  1. Picture's own translations (default lang + own ctx → default ctx → default lang → any).
 *  2. Direct parent's translations (same 4 steps) when picture has no own translation.
 *  3. Picture's internal_name.
 *  The result is formatted as "{title} {display_order}" when display_order is present.
 */
class ItemDisplayLabelTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    // ──────────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────────

    protected function createViewUser(): User
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo([
            Permission::ACCESS_ADMIN_PANEL->value,
            Permission::VIEW_DATA->value,
        ]);

        return $user;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // resolveTranslationOnly – PHP helper (no internal_name fallback)
    // ──────────────────────────────────────────────────────────────────────────

    public function test_resolve_translation_only_returns_null_when_no_translations(): void
    {
        Language::factory()->create(['id' => 'eng', 'is_default' => true]);

        $item = Item::factory()->Object()->create(['internal_name' => 'theme_47_4']);
        $item->load('translations');

        $this->assertNull(ItemDisplayLabel::resolveTranslationOnly($item));
    }

    public function test_resolve_translation_only_step1_default_lang_and_own_context(): void
    {
        $defaultLang = Language::factory()->create(['id' => 'eng', 'is_default' => true]);
        $defaultCtx = Context::factory()->create(['is_default' => true]);
        $ownCtx = Context::factory()->create(['is_default' => false]);

        $collection = Collection::factory()->create(['context_id' => $ownCtx->id]);
        $item = Item::factory()->Object()->create([
            'internal_name' => 'theme_47_4',
            'collection_id' => $collection->id,
        ]);

        // Top-priority translation (default lang + own collection context)
        $item->translations()->create([
            'language_id' => $defaultLang->id,
            'context_id' => $ownCtx->id,
            'name' => 'Andalusian Heritage',
        ]);

        // Lower-priority translation (default lang + default ctx)
        $item->translations()->create([
            'language_id' => $defaultLang->id,
            'context_id' => $defaultCtx->id,
            'name' => 'Andalusian Heritage (default)',
        ]);

        $item->load(['translations', 'collection:id,context_id']);

        $this->assertSame('Andalusian Heritage', ItemDisplayLabel::resolveTranslationOnly($item));
    }

    public function test_resolve_translation_only_step2_default_lang_and_default_context(): void
    {
        $defaultLang = Language::factory()->create(['id' => 'eng', 'is_default' => true]);
        $defaultCtx = Context::factory()->create(['is_default' => true]);

        $item = Item::factory()->Object()->create(['internal_name' => 'theme_47_4']);

        $item->translations()->create([
            'language_id' => $defaultLang->id,
            'context_id' => $defaultCtx->id,
            'name' => 'Andalusian Heritage',
        ]);

        $item->load('translations');

        $this->assertSame('Andalusian Heritage', ItemDisplayLabel::resolveTranslationOnly($item));
    }

    public function test_resolve_translation_only_step3_default_lang_any_context(): void
    {
        $defaultLang = Language::factory()->create(['id' => 'eng', 'is_default' => true]);
        $otherCtx = Context::factory()->create(['is_default' => false]);

        $item = Item::factory()->Object()->create(['internal_name' => 'theme_47_4']);

        $item->translations()->create([
            'language_id' => $defaultLang->id,
            'context_id' => $otherCtx->id,
            'name' => 'Andalusian Heritage (other ctx)',
        ]);

        $item->load('translations');

        $this->assertSame('Andalusian Heritage (other ctx)', ItemDisplayLabel::resolveTranslationOnly($item));
    }

    public function test_resolve_translation_only_step4_any_language(): void
    {
        Language::factory()->create(['id' => 'eng', 'is_default' => true]);
        $arabicLang = Language::factory()->create(['id' => 'ara', 'is_default' => false]);
        $otherCtx = Context::factory()->create(['is_default' => false]);

        $item = Item::factory()->Object()->create(['internal_name' => 'theme_47_4']);

        $item->translations()->create([
            'language_id' => $arabicLang->id,
            'context_id' => $otherCtx->id,
            'name' => 'التراث الأندلسي',
        ]);

        $item->load('translations');

        $this->assertSame('التراث الأندلسي', ItemDisplayLabel::resolveTranslationOnly($item));
    }

    public function test_resolve_translation_only_returns_null_for_empty_name(): void
    {
        $defaultLang = Language::factory()->create(['id' => 'eng', 'is_default' => true]);
        $defaultCtx = Context::factory()->create(['is_default' => true]);

        $item = Item::factory()->Object()->create(['internal_name' => 'theme_47_4']);

        $item->translations()->create([
            'language_id' => $defaultLang->id,
            'context_id' => $defaultCtx->id,
            'name' => '',
        ]);

        $item->load('translations');

        $this->assertNull(ItemDisplayLabel::resolveTranslationOnly($item));
    }

    // ──────────────────────────────────────────────────────────────────────────
    // resolvePictureLabel – picture item label with parent fallback
    // ──────────────────────────────────────────────────────────────────────────

    public function test_picture_label_uses_own_translation_when_available(): void
    {
        $defaultLang = Language::factory()->create(['id' => 'eng', 'is_default' => true]);
        $defaultCtx = Context::factory()->create(['is_default' => true]);

        $parent = Item::factory()->Object()->create(['internal_name' => 'parent_item']);
        $parent->translations()->create([
            'language_id' => $defaultLang->id,
            'context_id' => $defaultCtx->id,
            'name' => 'Parent Title',
        ]);

        $picture = Item::factory()->create([
            'type' => ItemType::PICTURE,
            'parent_id' => $parent->id,
            'internal_name' => 'Image 1',
            'display_order' => 3,
        ]);
        $picture->translations()->create([
            'language_id' => $defaultLang->id,
            'context_id' => $defaultCtx->id,
            'name' => 'Front view',
        ]);

        $picture->load(['translations', 'parent.translations']);

        // Own translation takes priority; parent translation is ignored
        $this->assertSame('Front view 3', ItemDisplayLabel::resolvePictureLabel($picture));
    }

    public function test_picture_label_falls_back_to_parent_translation_when_no_own_translation(): void
    {
        $defaultLang = Language::factory()->create(['id' => 'eng', 'is_default' => true]);
        $defaultCtx = Context::factory()->create(['is_default' => true]);

        $parent = Item::factory()->Object()->create(['internal_name' => 'theme_47_1']);
        $parent->translations()->create([
            'language_id' => $defaultLang->id,
            'context_id' => $defaultCtx->id,
            'name' => 'Andalusian Heritage',
        ]);

        $picture = Item::factory()->create([
            'type' => ItemType::PICTURE,
            'parent_id' => $parent->id,
            'internal_name' => 'Image 1',
            'display_order' => 1,
        ]);
        // No own translations

        $picture->load(['translations', 'parent.translations', 'parent.collection:id,context_id', 'parent.project:id,context_id']);

        $this->assertSame('Andalusian Heritage 1', ItemDisplayLabel::resolvePictureLabel($picture));
    }

    public function test_picture_label_falls_back_to_internal_name_when_neither_has_translation(): void
    {
        Language::factory()->create(['id' => 'eng', 'is_default' => true]);

        $parent = Item::factory()->Object()->create(['internal_name' => 'theme_47_1']);
        $picture = Item::factory()->create([
            'type' => ItemType::PICTURE,
            'parent_id' => $parent->id,
            'internal_name' => 'Image 1',
            'display_order' => 2,
        ]);

        $picture->load(['translations', 'parent.translations']);

        $this->assertSame('Image 1 2', ItemDisplayLabel::resolvePictureLabel($picture));
    }

    public function test_picture_label_without_display_order_has_no_suffix(): void
    {
        $defaultLang = Language::factory()->create(['id' => 'eng', 'is_default' => true]);
        $defaultCtx = Context::factory()->create(['is_default' => true]);

        $parent = Item::factory()->Object()->create(['internal_name' => 'parent_item']);
        $picture = Item::factory()->create([
            'type' => ItemType::PICTURE,
            'parent_id' => $parent->id,
            'internal_name' => 'Image 1',
            'display_order' => null,
        ]);
        $picture->translations()->create([
            'language_id' => $defaultLang->id,
            'context_id' => $defaultCtx->id,
            'name' => 'Front view',
        ]);

        $picture->load(['translations', 'parent.translations']);

        $this->assertSame('Front view', ItemDisplayLabel::resolvePictureLabel($picture));
    }

    public function test_picture_label_falls_back_to_internal_name_without_parent(): void
    {
        Language::factory()->create(['id' => 'eng', 'is_default' => true]);

        $picture = Item::factory()->create([
            'type' => ItemType::PICTURE,
            'parent_id' => null,
            'internal_name' => 'Image 1',
            'display_order' => 5,
        ]);

        $picture->load(['translations']);

        $this->assertSame('Image 1 5', ItemDisplayLabel::resolvePictureLabel($picture));
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Imported-style name regression (Story #1253)
    //
    // Importers may generate internal_names like "theme_47_4" or "Image 1".
    // The fallback chain must prefer any valid translation over these values.
    // ──────────────────────────────────────────────────────────────────────────

    public function test_imported_generated_internal_name_is_replaced_by_translation(): void
    {
        $defaultLang = Language::factory()->create(['id' => 'eng', 'is_default' => true]);
        $defaultCtx = Context::factory()->create(['is_default' => true]);

        $item = Item::factory()->Object()->create(['internal_name' => 'theme_47_4']);
        $item->translations()->create([
            'language_id' => $defaultLang->id,
            'context_id' => $defaultCtx->id,
            'name' => 'Andalusian Heritage',
        ]);

        $item->load('translations');

        // resolveForRecord must return the translation, not the generated internal_name
        $this->assertSame('Andalusian Heritage', ItemDisplayLabel::resolveForRecord($item));
        $this->assertNotSame('theme_47_4', ItemDisplayLabel::resolveForRecord($item));
    }

    public function test_picture_with_generated_internal_name_uses_parent_translation(): void
    {
        $defaultLang = Language::factory()->create(['id' => 'eng', 'is_default' => true]);
        $defaultCtx = Context::factory()->create(['is_default' => true]);

        // Parent item has a human-readable translation
        $parent = Item::factory()->Object()->create(['internal_name' => 'theme_47_1']);
        $parent->translations()->create([
            'language_id' => $defaultLang->id,
            'context_id' => $defaultCtx->id,
            'name' => 'Andalusian Heritage',
        ]);

        // Picture item has a generated internal_name and no own translations
        $picture = Item::factory()->create([
            'type' => ItemType::PICTURE,
            'parent_id' => $parent->id,
            'internal_name' => 'Image 1',
            'display_order' => 1,
        ]);

        $picture->load(['translations', 'parent.translations', 'parent.collection:id,context_id', 'parent.project:id,context_id']);

        // Must show parent translation + display_order, NOT the generated "Image 1 1"
        $label = ItemDisplayLabel::resolvePictureLabel($picture);
        $this->assertSame('Andalusian Heritage 1', $label);
        $this->assertStringNotContainsString('Image 1', $label);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PictureItemsRelationManager – Filament table integration (Story #1250)
    // ──────────────────────────────────────────────────────────────────────────

    public function test_picture_relation_manager_shows_translated_label_from_own_translation(): void
    {
        $user = $this->createCrudUser();
        $defaultLang = Language::factory()->create(['id' => 'eng', 'is_default' => true]);
        $defaultCtx = Context::factory()->create(['is_default' => true]);

        $parent = Item::factory()->Object()->create(['internal_name' => 'Root item']);
        $picture = Item::factory()->create([
            'type' => ItemType::PICTURE,
            'parent_id' => $parent->id,
            'internal_name' => 'Image 1',
            'display_order' => 2,
        ]);
        $picture->translations()->create([
            'language_id' => $defaultLang->id,
            'context_id' => $defaultCtx->id,
            'name' => 'Front view',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(PictureItemsRelationManager::class, [
                'ownerRecord' => $parent,
                'pageClass' => ViewItem::class,
            ])
            ->assertCanSeeTableRecords([$picture])
            ->assertTableColumnStateSet('picture_label', 'Front view 2', $picture);
    }

    public function test_picture_relation_manager_shows_parent_translation_when_no_own_translation(): void
    {
        $user = $this->createCrudUser();
        $defaultLang = Language::factory()->create(['id' => 'eng', 'is_default' => true]);
        $defaultCtx = Context::factory()->create(['is_default' => true]);

        $parent = Item::factory()->Object()->create(['internal_name' => 'theme_47_1']);
        $parent->translations()->create([
            'language_id' => $defaultLang->id,
            'context_id' => $defaultCtx->id,
            'name' => 'Andalusian Heritage',
        ]);

        $picture = Item::factory()->create([
            'type' => ItemType::PICTURE,
            'parent_id' => $parent->id,
            'internal_name' => 'Image 1',
            'display_order' => 1,
        ]);
        // No picture translations

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(PictureItemsRelationManager::class, [
                'ownerRecord' => $parent,
                'pageClass' => ViewItem::class,
            ])
            ->assertCanSeeTableRecords([$picture])
            ->assertTableColumnStateSet('picture_label', 'Andalusian Heritage 1', $picture);
    }

    public function test_picture_relation_manager_internal_name_column_is_searchable(): void
    {
        $user = $this->createCrudUser();
        Language::factory()->create(['id' => 'eng', 'is_default' => true]);

        $parent = Item::factory()->Object()->create(['internal_name' => 'Root item']);
        $picture = Item::factory()->create([
            'type' => ItemType::PICTURE,
            'parent_id' => $parent->id,
            'internal_name' => 'Image 1',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(PictureItemsRelationManager::class, [
                'ownerRecord' => $parent,
                'pageClass' => ViewItem::class,
            ])
            ->assertTableColumnExists('internal_name')
            ->assertCanSeeTableRecords([$picture]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Record titles – Item view/edit pages use translated label (Story #1251)
    // ──────────────────────────────────────────────────────────────────────────

    public function test_item_view_page_title_uses_translated_label(): void
    {
        $user = $this->createViewUser();
        $defaultLang = Language::factory()->create(['id' => 'eng', 'is_default' => true]);
        $defaultCtx = Context::factory()->create(['is_default' => true]);

        $item = Item::factory()->Object()->create(['internal_name' => 'theme_47_4']);
        $item->translations()->create([
            'language_id' => $defaultLang->id,
            'context_id' => $defaultCtx->id,
            'name' => 'Andalusian Heritage',
        ]);

        $this->actingAs($user)
            ->get("/admin/items/{$item->getKey()}")
            ->assertOk()
            ->assertSee('Andalusian Heritage');
    }

    public function test_item_view_page_title_falls_back_to_internal_name(): void
    {
        $user = $this->createViewUser();
        Language::factory()->create(['id' => 'eng', 'is_default' => true]);

        $item = Item::factory()->Object()->create(['internal_name' => 'theme_47_4']);

        $this->actingAs($user)
            ->get("/admin/items/{$item->getKey()}")
            ->assertOk()
            ->assertSee('theme_47_4');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Record titles – Collection view/edit pages use translated label (Story #1251)
    // ──────────────────────────────────────────────────────────────────────────

    public function test_collection_view_page_title_uses_translated_label(): void
    {
        $user = $this->createViewUser();
        $defaultLang = Language::factory()->create(['id' => 'eng', 'is_default' => true]);
        $defaultCtx = Context::factory()->create(['is_default' => true]);

        $collection = Collection::factory()->create([
            'internal_name' => 'theme_47_4',
            'context_id' => $defaultCtx->id,
        ]);
        $collection->translations()->create([
            'language_id' => $defaultLang->id,
            'context_id' => $defaultCtx->id,
            'title' => 'Andalusian Heritage',
        ]);

        $this->actingAs($user)
            ->get("/admin/collections/{$collection->getKey()}")
            ->assertOk()
            ->assertSee('Andalusian Heritage');
    }

    public function test_collection_view_page_title_falls_back_to_internal_name(): void
    {
        $user = $this->createViewUser();
        Language::factory()->create(['id' => 'eng', 'is_default' => true]);

        $collection = Collection::factory()->create(['internal_name' => 'theme_47_4']);

        $this->actingAs($user)
            ->get("/admin/collections/{$collection->getKey()}")
            ->assertOk()
            ->assertSee('theme_47_4');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Parent fields – Item table/infolist uses translated label (Story #1252)
    // ──────────────────────────────────────────────────────────────────────────

    public function test_item_table_parent_column_shows_translated_label(): void
    {
        $user = $this->createViewUser();
        $defaultLang = Language::factory()->create(['id' => 'eng', 'is_default' => true]);
        $defaultCtx = Context::factory()->create(['is_default' => true]);

        $parent = Item::factory()->Object()->create(['internal_name' => 'theme_47_1']);
        $parent->translations()->create([
            'language_id' => $defaultLang->id,
            'context_id' => $defaultCtx->id,
            'name' => 'Andalusian Heritage',
        ]);

        Item::factory()->Object()->create([
            'internal_name' => 'child_item',
            'parent_id' => $parent->id,
        ]);

        $this->actingAs($user)
            ->get('/admin/items')
            ->assertOk()
            ->assertSee('Andalusian Heritage');
    }

    public function test_item_infolist_parent_entry_shows_translated_label(): void
    {
        $user = $this->createViewUser();
        $defaultLang = Language::factory()->create(['id' => 'eng', 'is_default' => true]);
        $defaultCtx = Context::factory()->create(['is_default' => true]);

        $parent = Item::factory()->Object()->create(['internal_name' => 'theme_47_1']);
        $parent->translations()->create([
            'language_id' => $defaultLang->id,
            'context_id' => $defaultCtx->id,
            'name' => 'Andalusian Heritage',
        ]);

        $child = Item::factory()->Object()->create([
            'internal_name' => 'child_item',
            'parent_id' => $parent->id,
        ]);

        $this->actingAs($user)
            ->get("/admin/items/{$child->getKey()}")
            ->assertOk()
            ->assertSee('Andalusian Heritage');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Parent fields – Collection table/infolist uses translated label (Story #1252)
    // ──────────────────────────────────────────────────────────────────────────

    public function test_collection_table_parent_column_shows_translated_label(): void
    {
        $user = $this->createViewUser();
        $defaultLang = Language::factory()->create(['id' => 'eng', 'is_default' => true]);
        $defaultCtx = Context::factory()->create(['is_default' => true]);

        $parent = Collection::factory()->create([
            'internal_name' => 'theme_47_1',
            'context_id' => $defaultCtx->id,
        ]);
        $parent->translations()->create([
            'language_id' => $defaultLang->id,
            'context_id' => $defaultCtx->id,
            'title' => 'Andalusian Heritage',
        ]);

        Collection::factory()->create([
            'internal_name' => 'child_collection',
            'parent_id' => $parent->id,
        ]);

        $this->actingAs($user)
            ->get('/admin/collections')
            ->assertOk()
            ->assertSee('Andalusian Heritage');
    }

    public function test_collection_infolist_parent_entry_shows_translated_label(): void
    {
        $user = $this->createViewUser();
        $defaultLang = Language::factory()->create(['id' => 'eng', 'is_default' => true]);
        $defaultCtx = Context::factory()->create(['is_default' => true]);

        $parent = Collection::factory()->create([
            'internal_name' => 'theme_47_1',
            'context_id' => $defaultCtx->id,
        ]);
        $parent->translations()->create([
            'language_id' => $defaultLang->id,
            'context_id' => $defaultCtx->id,
            'title' => 'Andalusian Heritage',
        ]);

        $child = Collection::factory()->create([
            'internal_name' => 'child_collection',
            'parent_id' => $parent->id,
        ]);

        $this->actingAs($user)
            ->get("/admin/collections/{$child->getKey()}")
            ->assertOk()
            ->assertSee('Andalusian Heritage');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // getRecordTitle – used for page breadcrumbs and tab titles
    // ──────────────────────────────────────────────────────────────────────────

    public function test_item_resource_get_record_title_returns_translated_label(): void
    {
        $defaultLang = Language::factory()->create(['id' => 'eng', 'is_default' => true]);
        $defaultCtx = Context::factory()->create(['is_default' => true]);

        $item = Item::factory()->Object()->create(['internal_name' => 'theme_47_4']);
        $item->translations()->create([
            'language_id' => $defaultLang->id,
            'context_id' => $defaultCtx->id,
            'name' => 'Andalusian Heritage',
        ]);

        $item->load(['translations', 'collection:id,context_id', 'project:id,context_id']);

        $title = ItemResource::getRecordTitle($item);

        $this->assertSame('Andalusian Heritage', $title);
    }

    public function test_item_resource_get_record_title_falls_back_to_internal_name(): void
    {
        Language::factory()->create(['id' => 'eng', 'is_default' => true]);

        $item = Item::factory()->Object()->create(['internal_name' => 'theme_47_4']);
        $item->load(['translations', 'collection:id,context_id', 'project:id,context_id']);

        $title = ItemResource::getRecordTitle($item);

        $this->assertSame('theme_47_4', $title);
    }

    public function test_collection_resource_get_record_title_returns_translated_label(): void
    {
        $defaultLang = Language::factory()->create(['id' => 'eng', 'is_default' => true]);
        $defaultCtx = Context::factory()->create(['is_default' => true]);

        $collection = Collection::factory()->create([
            'internal_name' => 'theme_47_4',
            'context_id' => $defaultCtx->id,
        ]);
        $collection->translations()->create([
            'language_id' => $defaultLang->id,
            'context_id' => $defaultCtx->id,
            'title' => 'Andalusian Heritage',
        ]);

        $collection->load('translations');

        $title = CollectionResource::getRecordTitle($collection);

        $this->assertSame('Andalusian Heritage', $title);
    }

    public function test_collection_resource_get_record_title_falls_back_to_internal_name(): void
    {
        Language::factory()->create(['id' => 'eng', 'is_default' => true]);

        $collection = Collection::factory()->create(['internal_name' => 'theme_47_4']);
        $collection->load('translations');

        $title = CollectionResource::getRecordTitle($collection);

        $this->assertSame('theme_47_4', $title);
    }
}
