<?php

namespace Tests\Filament\Resources;

use App\Enums\ItemType;
use App\Enums\Permission;
use App\Filament\Pages\BrowseItemTree;
use App\Filament\Resources\CountryResource;
use App\Filament\Resources\ItemResource\Pages\CreateItem;
use App\Filament\Resources\ItemResource\Pages\EditItem;
use App\Filament\Resources\ItemResource\Pages\ListItem;
use App\Filament\Resources\ItemResource\Pages\ViewItem;
use App\Filament\Resources\ItemResource\RelationManagers\ChildItemsRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\CollectionAppearancesRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\OutgoingLinksRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\PictureItemsRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\TagsRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\TranslationsRelationManager;
use App\Filament\Resources\PartnerResource;
use App\Filament\Resources\ProjectResource;
use App\Models\Collection;
use App\Models\Context;
use App\Models\Country;
use App\Models\Item;
use App\Models\ItemImage;
use App\Models\Language;
use App\Models\Partner;
use App\Models\Project;
use App\Models\Tag;
use App\Models\User;
use Filament\Tables\Actions\DeleteAction;
use Filament\Tables\Columns\TextColumn;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

class ItemResourceTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_authorized_users_can_render_all_item_resource_pages(): void
    {
        $user = $this->createCrudUser();
        $partner = Partner::factory()->create(['internal_name' => 'Jordan Museum']);
        $item = Item::factory()->Object()->create([
            'internal_name' => 'Temple relief',
            'partner_id' => $partner->id,
        ]);

        $this->actingAs($user)->get('/admin/items')
            ->assertOk()
            ->assertSee('Items');

        $this->actingAs($user)->get('/admin/items/create')
            ->assertOk()
            ->assertSee('Create');

        $this->actingAs($user)->get("/admin/items/{$item->getKey()}/edit")
            ->assertOk()
            ->assertSee('Temple relief')
            ->assertSee('Core information')
            ->assertSee('Content')
            ->assertSee('Media')
            ->assertSee('Origin')
            ->assertSee('Links')
            ->assertSee('Timeline');

        $this->actingAs($user)->get("/admin/items/{$item->getKey()}")
            ->assertOk()
            ->assertSee('Temple relief')
            ->assertSee('Item')
            ->assertSee('Content')
            ->assertSee('Media')
            ->assertSee('Origin')
            ->assertSee('Links')
            ->assertSee('Timeline');

        $this->actingAs($user)->get('/admin/browse-item-tree')
            ->assertOk();
    }

    public function test_authorized_users_can_create_edit_and_delete_items(): void
    {
        $user = $this->createCrudUser();
        $partner = Partner::factory()->create(['internal_name' => 'Jordan Museum']);
        $item = Item::factory()->Object()->create([
            'internal_name' => 'Temple relief',
            'backward_compatibility' => 'itm-01',
            'partner_id' => $partner->id,
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CreateItem::class)
            ->fillForm([
                'internal_name' => 'Stone tablet',
                'type' => ItemType::OBJECT->value,
                'backward_compatibility' => 'itm-02',
                'partner_id' => $partner->id,
            ])
            ->call('create')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('items', [
            'internal_name' => 'Stone tablet',
            'type' => ItemType::OBJECT->value,
            'backward_compatibility' => 'itm-02',
            'partner_id' => $partner->id,
        ]);

        Livewire::actingAs($user)
            ->test(EditItem::class, [
                'record' => $item->getRouteKey(),
            ])
            ->assertFormSet([
                'internal_name' => 'Temple relief',
                'type' => ItemType::OBJECT->value,
                'backward_compatibility' => 'itm-01',
                'partner_id' => $partner->id,
            ])
            ->fillForm([
                'internal_name' => 'Temple inscription',
                'backward_compatibility' => 'itm-11',
            ])
            ->call('save')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('items', [
            'id' => $item->id,
            'internal_name' => 'Temple inscription',
            'backward_compatibility' => 'itm-11',
        ]);

        Livewire::actingAs($user)
            ->test(ListItem::class)
            ->callTableAction(DeleteAction::class, $item)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('items', [
            'id' => $item->id,
        ]);
    }

    public function test_authorized_users_can_change_item_parent(): void
    {
        $user = $this->createCrudUser();
        $parent = Item::factory()->Object()->create(['internal_name' => 'Root item']);
        $child = Item::factory()->Object()->create(['internal_name' => 'Child item', 'parent_id' => null]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListItem::class)
            ->callTableAction('changeParent', $child, data: ['parent_id' => $parent->id])
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('items', [
            'id' => $child->id,
            'parent_id' => $parent->id,
        ]);
    }

    public function test_authorized_users_can_move_items_to_parent_in_bulk(): void
    {
        $user = $this->createCrudUser();
        $parent = Item::factory()->Object()->create(['internal_name' => 'Root item']);
        $child1 = Item::factory()->Object()->create(['internal_name' => 'Child 1', 'parent_id' => null]);
        $child2 = Item::factory()->Object()->create(['internal_name' => 'Child 2', 'parent_id' => null]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListItem::class)
            ->callTableBulkAction('moveToParent', [$child1, $child2], data: ['parent_id' => $parent->id])
            ->assertHasNoTableBulkActionErrors();

        $this->assertDatabaseHas('items', ['id' => $child1->id, 'parent_id' => $parent->id]);
        $this->assertDatabaseHas('items', ['id' => $child2->id, 'parent_id' => $parent->id]);
    }

    public function test_authorized_users_can_attach_items_to_collection_in_bulk(): void
    {
        $user = $this->createCrudUser();
        $collection = Collection::factory()->create(['internal_name' => 'Temple collection']);
        $item1 = Item::factory()->Object()->create(['internal_name' => 'Item 1']);
        $item2 = Item::factory()->Object()->create(['internal_name' => 'Item 2']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListItem::class)
            ->callTableBulkAction('attachToCollection', [$item1, $item2], data: ['collection_id' => $collection->id])
            ->assertHasNoTableBulkActionErrors();

        $this->assertDatabaseHas('collection_item', ['collection_id' => $collection->id, 'item_id' => $item1->id]);
        $this->assertDatabaseHas('collection_item', ['collection_id' => $collection->id, 'item_id' => $item2->id]);
    }

    public function test_authorized_users_can_attach_tag_to_items_in_bulk(): void
    {
        $user = $this->createCrudUser();
        $tag = Tag::factory()->create(['internal_name' => 'religious']);
        $item1 = Item::factory()->Object()->create(['internal_name' => 'Item 1']);
        $item2 = Item::factory()->Object()->create(['internal_name' => 'Item 2']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListItem::class)
            ->callTableBulkAction('attachTag', [$item1, $item2], data: ['tag_id' => $tag->id])
            ->assertHasNoTableBulkActionErrors();

        $this->assertDatabaseHas('item_tag', ['item_id' => $item1->id, 'tag_id' => $tag->id]);
        $this->assertDatabaseHas('item_tag', ['item_id' => $item2->id, 'tag_id' => $tag->id]);
    }

    public function test_child_items_relation_manager_shows_children(): void
    {
        $user = $this->createCrudUser();
        $parent = Item::factory()->Object()->create(['internal_name' => 'Root item']);
        $child = Item::factory()->create([
            'internal_name' => 'Detail item',
            'type' => ItemType::DETAIL,
            'parent_id' => $parent->id,
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ChildItemsRelationManager::class, [
                'ownerRecord' => $parent,
                'pageClass' => ViewItem::class,
            ])
            ->assertCanSeeTableRecords([$child]);
    }

    public function test_pictures_relation_manager_shows_picture_children_only(): void
    {
        $user = $this->createCrudUser();
        $parent = Item::factory()->Object()->create(['internal_name' => 'Root item']);
        $picture = Item::factory()->create([
            'internal_name' => 'Picture item',
            'type' => ItemType::PICTURE,
            'parent_id' => $parent->id,
        ]);
        $detail = Item::factory()->create([
            'internal_name' => 'Detail item',
            'type' => ItemType::DETAIL,
            'parent_id' => $parent->id,
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(PictureItemsRelationManager::class, [
                'ownerRecord' => $parent,
                'pageClass' => ViewItem::class,
            ])
            ->assertCanSeeTableRecords([$picture])
            ->assertCanNotSeeTableRecords([$detail]);
    }

    public function test_translations_relation_manager_supports_crud_operations(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create(['internal_name' => 'Temple relief']);
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);
        $context = Context::factory()->create(['internal_name' => 'Catalogue']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(TranslationsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->mountTableAction('create')
            ->setTableActionData([
                'language_id' => $language->id,
                'context_id' => $context->id,
                'name' => 'Temple Relief',
                'alternate_name' => 'Relief fragment',
                'description' => 'A carved stone relief.',
            ])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $translation = $item->translations()->firstOrFail();

        Livewire::actingAs($user)
            ->test(TranslationsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->callTableAction(DeleteAction::class, $translation->fresh())
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('item_translations', [
            'id' => $translation->id,
        ]);
    }

    public function test_links_relation_manager_supports_crud_operations(): void
    {
        $user = $this->createCrudUser();
        $source = Item::factory()->Object()->create(['internal_name' => 'Source item']);
        $target = Item::factory()->Object()->create(['internal_name' => 'Target item']);
        $context = Context::factory()->create(['internal_name' => 'Catalogue']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(OutgoingLinksRelationManager::class, [
                'ownerRecord' => $source,
                'pageClass' => EditItem::class,
            ])
            ->mountTableAction('create')
            ->setTableActionData([
                'target_id' => $target->id,
                'context_id' => $context->id,
            ])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $link = $source->outgoingLinks()->firstOrFail();

        $this->assertDatabaseHas('item_item_links', [
            'source_id' => $source->id,
            'target_id' => $target->id,
            'context_id' => $context->id,
        ]);

        Livewire::actingAs($user)
            ->test(OutgoingLinksRelationManager::class, [
                'ownerRecord' => $source,
                'pageClass' => EditItem::class,
            ])
            ->assertCanSeeTableRecords([$link])
            ->callTableAction(DeleteAction::class, $link->fresh())
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('item_item_links', [
            'id' => $link->id,
        ]);
    }

    public function test_tags_relation_manager_supports_attach_and_detach(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create(['internal_name' => 'Temple relief']);
        $tag = Tag::factory()->create(['internal_name' => 'religious']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(TagsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->callTableAction('attach', data: ['recordId' => $tag->id])
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('item_tag', [
            'item_id' => $item->id,
            'tag_id' => $tag->id,
        ]);

        Livewire::actingAs($user)
            ->test(TagsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->callTableAction('detach', $tag)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('item_tag', [
            'item_id' => $item->id,
            'tag_id' => $tag->id,
        ]);
    }

    public function test_item_table_shows_fallback_translation_badge(): void
    {
        $user = $this->createCrudUser();
        $defaultLang = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $defaultCtx = Context::factory()->create(['internal_name' => 'Default context', 'is_default' => true]);
        $otherLang = Language::factory()->create(['id' => 'fra', 'internal_name' => 'French', 'is_default' => false]);

        $itemWithFallback = Item::factory()->Object()->create(['internal_name' => 'Item with fallback']);
        $itemWithFallback->translations()->create([
            'language_id' => $defaultLang->id,
            'context_id' => $defaultCtx->id,
            'name' => 'Item with fallback',
        ]);

        $itemWithoutFallback = Item::factory()->Object()->create(['internal_name' => 'Item without fallback']);
        $itemWithoutFallback->translations()->create([
            'language_id' => $otherLang->id,
            'context_id' => $defaultCtx->id,
            'name' => 'Item without fallback FR',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListItem::class)
            ->assertCanSeeTableRecords([$itemWithFallback, $itemWithoutFallback]);
    }

    public function test_item_table_filter_has_fallback_translation(): void
    {
        $user = $this->createCrudUser();
        $defaultLang = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $defaultCtx = Context::factory()->create(['internal_name' => 'Default context', 'is_default' => true]);

        $itemWithFallback = Item::factory()->Object()->create(['internal_name' => 'Item A']);
        $itemWithFallback->translations()->create([
            'language_id' => $defaultLang->id,
            'context_id' => $defaultCtx->id,
            'name' => 'Item A name',
        ]);

        $itemWithoutFallback = Item::factory()->Object()->create(['internal_name' => 'Item B']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListItem::class)
            ->filterTable('has_fallback_translation')
            ->assertCanSeeTableRecords([$itemWithFallback])
            ->assertCanNotSeeTableRecords([$itemWithoutFallback]);
    }

    public function test_item_table_filter_missing_fallback_translation(): void
    {
        $user = $this->createCrudUser();
        $defaultLang = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $defaultCtx = Context::factory()->create(['internal_name' => 'Default context', 'is_default' => true]);

        $itemWithFallback = Item::factory()->Object()->create(['internal_name' => 'Item A']);
        $itemWithFallback->translations()->create([
            'language_id' => $defaultLang->id,
            'context_id' => $defaultCtx->id,
            'name' => 'Item A name',
        ]);

        $itemWithoutFallback = Item::factory()->Object()->create(['internal_name' => 'Item B']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListItem::class)
            ->filterTable('missing_fallback_translation')
            ->assertCanSeeTableRecords([$itemWithoutFallback])
            ->assertCanNotSeeTableRecords([$itemWithFallback]);
    }

    public function test_item_table_filter_has_translation_in_language(): void
    {
        $user = $this->createCrudUser();
        $langEn = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $langFr = Language::factory()->create(['id' => 'fra', 'internal_name' => 'French', 'is_default' => false]);
        $ctx = Context::factory()->create(['internal_name' => 'Default context', 'is_default' => true]);

        $itemEn = Item::factory()->Object()->create(['internal_name' => 'English item']);
        $itemEn->translations()->create([
            'language_id' => $langEn->id,
            'context_id' => $ctx->id,
            'name' => 'English item name',
        ]);

        $itemFr = Item::factory()->Object()->create(['internal_name' => 'French item']);
        $itemFr->translations()->create([
            'language_id' => $langFr->id,
            'context_id' => $ctx->id,
            'name' => 'French item name',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListItem::class)
            ->filterTable('translation_language_has', $langFr->id)
            ->assertCanSeeTableRecords([$itemFr])
            ->assertCanNotSeeTableRecords([$itemEn]);
    }

    public function test_item_table_filter_missing_translation_in_language(): void
    {
        $user = $this->createCrudUser();
        $langEn = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $langFr = Language::factory()->create(['id' => 'fra', 'internal_name' => 'French', 'is_default' => false]);
        $ctx = Context::factory()->create(['internal_name' => 'Default context', 'is_default' => true]);

        $itemEn = Item::factory()->Object()->create(['internal_name' => 'English item']);
        $itemEn->translations()->create([
            'language_id' => $langEn->id,
            'context_id' => $ctx->id,
            'name' => 'English item name',
        ]);

        $itemFr = Item::factory()->Object()->create(['internal_name' => 'French item']);
        $itemFr->translations()->create([
            'language_id' => $langFr->id,
            'context_id' => $ctx->id,
            'name' => 'French item name',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListItem::class)
            ->filterTable('translation_language_missing', $langFr->id)
            ->assertCanSeeTableRecords([$itemEn])
            ->assertCanNotSeeTableRecords([$itemFr]);
    }

    public function test_item_table_filter_has_translation_in_context(): void
    {
        $user = $this->createCrudUser();
        $lang = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $ctxDefault = Context::factory()->create(['internal_name' => 'Default context', 'is_default' => true]);
        $ctxCatalogue = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => false]);

        $itemDefault = Item::factory()->Object()->create(['internal_name' => 'Default context item']);
        $itemDefault->translations()->create([
            'language_id' => $lang->id,
            'context_id' => $ctxDefault->id,
            'name' => 'Default item name',
        ]);

        $itemCatalogue = Item::factory()->Object()->create(['internal_name' => 'Catalogue item']);
        $itemCatalogue->translations()->create([
            'language_id' => $lang->id,
            'context_id' => $ctxCatalogue->id,
            'name' => 'Catalogue item name',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListItem::class)
            ->filterTable('translation_context_has', $ctxCatalogue->id)
            ->assertCanSeeTableRecords([$itemCatalogue])
            ->assertCanNotSeeTableRecords([$itemDefault]);
    }

    public function test_item_table_filter_missing_translation_in_context(): void
    {
        $user = $this->createCrudUser();
        $lang = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $ctxDefault = Context::factory()->create(['internal_name' => 'Default context', 'is_default' => true]);
        $ctxCatalogue = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => false]);

        $itemDefault = Item::factory()->Object()->create(['internal_name' => 'Default context item']);
        $itemDefault->translations()->create([
            'language_id' => $lang->id,
            'context_id' => $ctxDefault->id,
            'name' => 'Default item name',
        ]);

        $itemCatalogue = Item::factory()->Object()->create(['internal_name' => 'Catalogue item']);
        $itemCatalogue->translations()->create([
            'language_id' => $lang->id,
            'context_id' => $ctxCatalogue->id,
            'name' => 'Catalogue item name',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListItem::class)
            ->filterTable('translation_context_missing', $ctxCatalogue->id)
            ->assertCanSeeTableRecords([$itemDefault])
            ->assertCanNotSeeTableRecords([$itemCatalogue]);
    }

    public function test_browse_item_tree_page_renders(): void
    {
        $user = $this->createCrudUser();
        Item::factory()->Object()->create(['internal_name' => 'Root object', 'parent_id' => null]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(BrowseItemTree::class)
            ->assertSee('Root object');
    }

    public function test_users_without_admin_panel_permission_receive_forbidden_on_the_filament_item_resource(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo([
            Permission::VIEW_DATA->value,
            Permission::CREATE_DATA->value,
            Permission::UPDATE_DATA->value,
            Permission::DELETE_DATA->value,
        ]);

        $response = $this->actingAs($user)->get('/admin/items');

        $response->assertForbidden();
    }

    public function test_item_table_partner_column_links_to_partner_resource_for_authorized_user(): void
    {
        $user = $this->createCrudUser();
        $partner = Partner::factory()->create(['internal_name' => 'Jordan Museum']);
        $item = Item::factory()->Object()->create(['partner_id' => $partner->id]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListItem::class)
            ->assertTableColumnExists(
                'partner.internal_name',
                fn (TextColumn $column): bool => $column->getUrl() === PartnerResource::getUrl('view', ['record' => $partner]),
                $item
            );
    }

    public function test_item_table_country_column_is_plain_text_without_manage_reference_data_permission(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo([
            Permission::ACCESS_ADMIN_PANEL->value,
            Permission::VIEW_DATA->value,
        ]);

        $country = Country::factory()->create(['id' => 'jor', 'internal_name' => 'Jordan']);
        $item = Item::factory()->Object()->create(['country_id' => $country->id]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListItem::class)
            ->assertTableColumnExists(
                'country.internal_name',
                fn (TextColumn $column): bool => $column->getUrl() === null,
                $item
            );
    }

    public function test_item_table_country_column_links_to_country_resource_with_manage_reference_data_permission(): void
    {
        $user = $this->createViewAndReferenceDataUser();

        $country = Country::factory()->create(['id' => 'jor', 'internal_name' => 'Jordan']);
        $item = Item::factory()->Object()->create(['country_id' => $country->id]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListItem::class)
            ->assertTableColumnExists(
                'country.internal_name',
                fn (TextColumn $column): bool => $column->getUrl() === CountryResource::getUrl('view', ['record' => $country]),
                $item
            );
    }

    public function test_item_table_project_column_links_to_project_resource_for_authorized_user(): void
    {
        $user = $this->createCrudUser();
        $project = Project::factory()->create(['internal_name' => 'Temple catalogue']);
        $item = Item::factory()->Object()->create(['project_id' => $project->id]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListItem::class)
            ->assertTableColumnExists(
                'project.internal_name',
                fn (TextColumn $column): bool => $column->getUrl() === ProjectResource::getUrl('view', ['record' => $project]),
                $item
            );
    }

    public function test_item_table_parent_column_renders_plain_text_when_parent_is_null(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create(['parent_id' => null]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListItem::class)
            ->assertTableColumnExists(
                'parent_display_label',
                fn (TextColumn $column): bool => $column->getUrl($item) === null,
                $item
            );
    }

    protected function createViewAndReferenceDataUser(): User
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo([
            Permission::ACCESS_ADMIN_PANEL->value,
            Permission::VIEW_DATA->value,
            Permission::MANAGE_REFERENCE_DATA->value,
        ]);

        return $user;
    }

    public function test_pictures_relation_manager_shows_thumbnail_column_for_picture_with_image(): void
    {
        $user = $this->createCrudUser();
        $parent = Item::factory()->Object()->create(['internal_name' => 'Root item']);
        $picture = Item::factory()->create([
            'internal_name' => 'Picture item',
            'type' => ItemType::PICTURE,
            'parent_id' => $parent->id,
        ]);
        $image = ItemImage::factory()->forItem($picture)->create(['path' => 'test.jpg', 'display_order' => 1]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(PictureItemsRelationManager::class, [
                'ownerRecord' => $parent,
                'pageClass' => ViewItem::class,
            ])
            ->assertTableColumnExists('thumbnail')
            ->assertCanSeeTableRecords([$picture]);
    }

    public function test_pictures_relation_manager_shows_thumbnail_column_for_picture_without_image(): void
    {
        $user = $this->createCrudUser();
        $parent = Item::factory()->Object()->create(['internal_name' => 'Root item']);
        $picture = Item::factory()->create([
            'internal_name' => 'Picture without image',
            'type' => ItemType::PICTURE,
            'parent_id' => $parent->id,
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(PictureItemsRelationManager::class, [
                'ownerRecord' => $parent,
                'pageClass' => ViewItem::class,
            ])
            ->assertTableColumnExists('thumbnail')
            ->assertCanSeeTableRecords([$picture]);
    }

    public function test_displayed_in_relation_manager_shows_collections_containing_item(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create(['internal_name' => 'Temple relief']);
        $context = Context::factory()->create(['internal_name' => 'Catalogue']);
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);
        $collection = Collection::factory()->create([
            'internal_name' => 'Temple collection',
            'context_id' => $context->id,
            'language_id' => $language->id,
        ]);
        $collection->attachedItems()->attach($item->id);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CollectionAppearancesRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->assertCanSeeTableRecords([$collection]);
    }

    public function test_displayed_in_relation_manager_shows_empty_state_when_item_not_in_any_collection(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create(['internal_name' => 'Standalone item']);
        $context = Context::factory()->create(['internal_name' => 'Catalogue']);
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);
        $otherCollection = Collection::factory()->create([
            'internal_name' => 'Other collection',
            'context_id' => $context->id,
            'language_id' => $language->id,
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CollectionAppearancesRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->assertCanNotSeeTableRecords([$otherCollection]);
    }
}
