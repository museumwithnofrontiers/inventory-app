<?php

namespace Tests\Filament\Resources;

use App\Enums\Permission;
use App\Filament\Resources\CollectionResource\Pages\EditCollection;
use App\Filament\Resources\CollectionResource\RelationManagers\ChildCollectionsRelationManager;
use App\Filament\Resources\CollectionResource\RelationManagers\ItemsRelationManager as CollectionItemsRelationManager;
use App\Filament\Resources\CollectionResource\RelationManagers\PartnersRelationManager as CollectionPartnersRelationManager;
use App\Filament\Resources\CollectionResource\RelationManagers\TranslationsRelationManager as CollectionTranslationsRelationManager;
use App\Filament\Resources\GlossaryResource\Pages\EditGlossary;
use App\Filament\Resources\GlossaryResource\RelationManagers\SpellingsRelationManager;
use App\Filament\Resources\GlossaryResource\RelationManagers\TranslationsRelationManager as GlossaryTranslationsRelationManager;
use App\Filament\Resources\ItemResource\Pages\EditItem;
use App\Filament\Resources\ItemResource\RelationManagers\ChildItemsRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\ImagesRelationManager as ItemImagesRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\TagsRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\TranslationsRelationManager as ItemTranslationsRelationManager;
use App\Filament\Resources\PartnerResource\Pages\EditPartner;
use App\Filament\Resources\PartnerResource\RelationManagers\CollectionParticipationsRelationManager;
use App\Filament\Resources\PartnerResource\RelationManagers\ImagesRelationManager as PartnerImagesRelationManager;
use App\Filament\Resources\PartnerResource\RelationManagers\OwnedItemsRelationManager;
use App\Filament\Resources\PartnerResource\RelationManagers\TranslationsRelationManager as PartnerTranslationsRelationManager;
use App\Filament\Resources\PartnerTranslationResource\Pages\EditPartnerTranslation;
use App\Filament\Resources\PartnerTranslationResource\RelationManagers\ImagesRelationManager as PartnerTranslationImagesRelationManager;
use App\Filament\Resources\ProjectResource\Pages\ViewProject;
use App\Filament\Resources\ProjectResource\RelationManagers\CollectionsRelationManager as ProjectCollectionsRelationManager;
use App\Filament\Resources\ProjectResource\RelationManagers\ItemsRelationManager as ProjectItemsRelationManager;
use App\Filament\Resources\RoleResource\Pages\EditRole;
use App\Filament\Resources\RoleResource\RelationManagers\PermissionsRelationManager;
use App\Filament\Resources\RoleResource\RelationManagers\UsersRelationManager;
use App\Models\Collection;
use App\Models\Context;
use App\Models\Glossary;
use App\Models\Item;
use App\Models\Language;
use App\Models\Partner;
use App\Models\Project;
use App\Models\Tag;
use App\Models\User;
use Filament\Tables\Columns\TextColumn;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Spatie\Permission\Models\Role;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * Asserts that all relation managers follow the documented UX convention:
 *
 * 1. Primary related record column is searchable and clickable where appropriate.
 * 2. Row actions appear in a consistent order: view/open, edit, detach/remove, delete.
 * 3. Attachment actions use server-side bounded searchable selects for high-cardinality targets.
 * 4. Metadata columns (timestamps, mime_type, size) are toggleable and hidden by default.
 * 5. Pagination defaults are consistent: defaultPaginationPageOption(25), paginated([25, 50, 100]).
 */
class RelationManagerConventionTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    // ── Helpers ───────────────────────────────────────────────────────────────

    protected function createManagerUser(): User
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo([
            Permission::ACCESS_ADMIN_PANEL->value,
            Permission::MANAGE_ROLES->value,
        ]);

        return $user;
    }

    // ── Convention 4: Metadata columns hidden by default ─────────────────────

    public function test_item_images_relation_manager_metadata_columns_are_hidden_by_default(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ItemImagesRelationManager::class, [
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

    public function test_partner_images_relation_manager_metadata_columns_are_hidden_by_default(): void
    {
        $user = $this->createCrudUser();
        $partner = Partner::factory()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(PartnerImagesRelationManager::class, [
                'ownerRecord' => $partner,
                'pageClass' => EditPartner::class,
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

    public function test_partner_translation_images_relation_manager_metadata_columns_are_hidden_by_default(): void
    {
        $user = $this->createCrudUser();
        $partner = Partner::factory()->create();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);
        $context = Context::factory()->create(['internal_name' => 'Catalogue']);
        $partnerTranslation = $partner->translations()->create([
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Jordan Museum EN',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(PartnerTranslationImagesRelationManager::class, [
                'ownerRecord' => $partnerTranslation,
                'pageClass' => EditPartnerTranslation::class,
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

    public function test_item_translations_relation_manager_timestamp_columns_are_hidden_by_default(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ItemTranslationsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
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

    public function test_collection_translations_relation_manager_timestamp_columns_are_hidden_by_default(): void
    {
        $user = $this->createCrudUser();
        $context = Context::factory()->create(['internal_name' => 'Catalogue']);
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);
        $collection = Collection::factory()->create([
            'context_id' => $context->id,
            'language_id' => $language->id,
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CollectionTranslationsRelationManager::class, [
                'ownerRecord' => $collection,
                'pageClass' => EditCollection::class,
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

    public function test_partner_translations_relation_manager_timestamp_columns_are_hidden_by_default(): void
    {
        $user = $this->createCrudUser();
        $partner = Partner::factory()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(PartnerTranslationsRelationManager::class, [
                'ownerRecord' => $partner,
                'pageClass' => EditPartner::class,
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

    public function test_glossary_spellings_relation_manager_timestamp_columns_are_hidden_by_default(): void
    {
        $user = $this->createCrudUser();
        $glossary = Glossary::factory()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(SpellingsRelationManager::class, [
                'ownerRecord' => $glossary,
                'pageClass' => EditGlossary::class,
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

    public function test_glossary_translations_relation_manager_timestamp_columns_are_hidden_by_default(): void
    {
        $user = $this->createCrudUser();
        $glossary = Glossary::factory()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(GlossaryTranslationsRelationManager::class, [
                'ownerRecord' => $glossary,
                'pageClass' => EditGlossary::class,
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

    // ── Convention 1: Primary column is searchable ────────────────────────────

    public function test_item_child_items_relation_manager_primary_column_is_searchable(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ChildItemsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->assertTableColumnExists(
                'internal_name',
                fn (TextColumn $column): bool => $column->isSearchable()
            );
    }

    public function test_collection_child_collections_relation_manager_primary_column_is_searchable(): void
    {
        $user = $this->createCrudUser();
        $context = Context::factory()->create(['internal_name' => 'Catalogue']);
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);
        $collection = Collection::factory()->create([
            'context_id' => $context->id,
            'language_id' => $language->id,
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ChildCollectionsRelationManager::class, [
                'ownerRecord' => $collection,
                'pageClass' => EditCollection::class,
            ])
            ->assertTableColumnExists(
                'internal_name',
                fn (TextColumn $column): bool => $column->isSearchable()
            );
    }

    public function test_partner_owned_items_relation_manager_primary_column_is_searchable(): void
    {
        $user = $this->createCrudUser();
        $partner = Partner::factory()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(OwnedItemsRelationManager::class, [
                'ownerRecord' => $partner,
                'pageClass' => EditPartner::class,
            ])
            ->assertTableColumnExists(
                'internal_name',
                fn (TextColumn $column): bool => $column->isSearchable()
            );
    }

    public function test_partner_collection_participations_relation_manager_primary_column_is_searchable(): void
    {
        $user = $this->createCrudUser();
        $partner = Partner::factory()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CollectionParticipationsRelationManager::class, [
                'ownerRecord' => $partner,
                'pageClass' => EditPartner::class,
            ])
            ->assertTableColumnExists(
                'internal_name',
                fn (TextColumn $column): bool => $column->isSearchable()
            );
    }

    public function test_project_items_relation_manager_primary_column_is_searchable(): void
    {
        $user = $this->createCrudUser();
        $project = Project::factory()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ProjectItemsRelationManager::class, [
                'ownerRecord' => $project,
                'pageClass' => ViewProject::class,
            ])
            ->assertTableColumnExists(
                'internal_name',
                fn (TextColumn $column): bool => $column->isSearchable()
            );
    }

    public function test_project_collections_relation_manager_primary_column_is_searchable(): void
    {
        $user = $this->createCrudUser();
        $project = Project::factory()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ProjectCollectionsRelationManager::class, [
                'ownerRecord' => $project,
                'pageClass' => ViewProject::class,
            ])
            ->assertTableColumnExists(
                'internal_name',
                fn (TextColumn $column): bool => $column->isSearchable()
            );
    }

    public function test_glossary_spellings_relation_manager_primary_column_is_searchable(): void
    {
        $user = $this->createCrudUser();
        $glossary = Glossary::factory()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(SpellingsRelationManager::class, [
                'ownerRecord' => $glossary,
                'pageClass' => EditGlossary::class,
            ])
            ->assertTableColumnExists(
                'spelling',
                fn (TextColumn $column): bool => $column->isSearchable()
            );
    }

    public function test_role_permissions_relation_manager_primary_column_is_searchable(): void
    {
        $user = $this->createManagerUser();
        $role = Role::firstOrCreate(['name' => 'Reviewer', 'guard_name' => 'web']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(PermissionsRelationManager::class, [
                'ownerRecord' => $role,
                'pageClass' => EditRole::class,
            ])
            ->assertTableColumnExists(
                'name',
                fn (TextColumn $column): bool => $column->isSearchable()
            );
    }

    public function test_role_users_relation_manager_primary_column_is_searchable(): void
    {
        $user = $this->createManagerUser();
        $role = Role::firstOrCreate(['name' => 'Reviewer', 'guard_name' => 'web']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(UsersRelationManager::class, [
                'ownerRecord' => $role,
                'pageClass' => EditRole::class,
            ])
            ->assertTableColumnExists(
                'name',
                fn (TextColumn $column): bool => $column->isSearchable()
            );
    }

    // ── Convention 2: Row action order ────────────────────────────────────────

    public function test_item_images_relation_manager_row_actions_are_in_convention_order(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ItemImagesRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->assertTableActionsExistInOrder(['view_image', 'download', 'edit', 'detach', 'delete']);
    }

    public function test_partner_images_relation_manager_row_actions_are_in_convention_order(): void
    {
        $user = $this->createCrudUser();
        $partner = Partner::factory()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(PartnerImagesRelationManager::class, [
                'ownerRecord' => $partner,
                'pageClass' => EditPartner::class,
            ])
            ->assertTableActionsExistInOrder(['view_image', 'download', 'edit', 'detach', 'delete']);
    }

    public function test_partner_translation_images_relation_manager_row_actions_are_in_convention_order(): void
    {
        $user = $this->createCrudUser();
        $partner = Partner::factory()->create();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);
        $context = Context::factory()->create(['internal_name' => 'Catalogue']);
        $partnerTranslation = $partner->translations()->create([
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Jordan Museum EN',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(PartnerTranslationImagesRelationManager::class, [
                'ownerRecord' => $partnerTranslation,
                'pageClass' => EditPartnerTranslation::class,
            ])
            ->assertTableActionsExistInOrder(['view_image', 'download', 'edit', 'detach', 'delete']);
    }

    public function test_item_translations_relation_manager_row_actions_are_in_convention_order(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ItemTranslationsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->assertTableActionsExistInOrder(['viewTranslation', 'editTranslation', 'viewParentItem', 'delete']);
    }

    public function test_collection_items_relation_manager_row_actions_are_in_convention_order(): void
    {
        $user = $this->createCrudUser();
        $context = Context::factory()->create(['internal_name' => 'Catalogue']);
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);
        $collection = Collection::factory()->create([
            'context_id' => $context->id,
            'language_id' => $language->id,
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CollectionItemsRelationManager::class, [
                'ownerRecord' => $collection,
                'pageClass' => EditCollection::class,
            ])
            ->assertTableActionsExistInOrder(['detach']);
    }

    public function test_role_permissions_relation_manager_row_actions_are_in_convention_order(): void
    {
        $user = $this->createManagerUser();
        $role = Role::firstOrCreate(['name' => 'Reviewer', 'guard_name' => 'web']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(PermissionsRelationManager::class, [
                'ownerRecord' => $role,
                'pageClass' => EditRole::class,
            ])
            ->assertTableActionsExistInOrder(['edit', 'detach', 'deletePermission']);
    }

    // ── Convention 3: Bounded server-side attach search ───────────────────────

    public function test_collection_items_relation_manager_attach_action_uses_bounded_search(): void
    {
        $user = $this->createCrudUser();
        $context = Context::factory()->create(['internal_name' => 'Catalogue']);
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);
        $collection = Collection::factory()->create([
            'context_id' => $context->id,
            'language_id' => $language->id,
        ]);
        $item = Item::factory()->Object()->create(['internal_name' => 'Temple relief']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CollectionItemsRelationManager::class, [
                'ownerRecord' => $collection,
                'pageClass' => EditCollection::class,
            ])
            ->callTableAction('attach', data: ['recordId' => $item->id])
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('collection_item', [
            'collection_id' => $collection->id,
            'item_id' => $item->id,
        ]);
    }

    public function test_collection_partners_relation_manager_attach_action_uses_bounded_search(): void
    {
        $user = $this->createCrudUser();
        $context = Context::factory()->create(['internal_name' => 'Catalogue']);
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);
        $collection = Collection::factory()->create([
            'context_id' => $context->id,
            'language_id' => $language->id,
        ]);
        $partner = Partner::factory()->create(['internal_name' => 'Jordan Museum']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CollectionPartnersRelationManager::class, [
                'ownerRecord' => $collection,
                'pageClass' => EditCollection::class,
            ])
            ->callTableAction('attach', data: ['recordId' => $partner->id, 'level' => 'partner'])
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('collection_partner', [
            'collection_id' => $collection->id,
            'partner_id' => $partner->id,
        ]);
    }

    public function test_item_tags_relation_manager_attach_action_uses_bounded_search(): void
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
    }

    // ── Convention 5: Consistent pagination defaults ──────────────────────────

    public function test_glossary_spellings_relation_manager_uses_pagination_defaults(): void
    {
        $user = $this->createCrudUser();
        $glossary = Glossary::factory()->create(['internal_name' => 'Mashrabiya']);
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);

        foreach (range(1, 5) as $i) {
            $glossary->spellings()->create([
                'language_id' => $language->id,
                'spelling' => "Spelling {$i}",
            ]);
        }

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(SpellingsRelationManager::class, [
                'ownerRecord' => $glossary,
                'pageClass' => EditGlossary::class,
            ])
            ->assertSuccessful();
    }

    public function test_glossary_translations_relation_manager_uses_pagination_defaults(): void
    {
        $user = $this->createCrudUser();
        $glossary = Glossary::factory()->create(['internal_name' => 'Mashrabiya']);
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);
        $glossary->translations()->create([
            'language_id' => $language->id,
            'definition' => 'A projecting oriel window.',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(GlossaryTranslationsRelationManager::class, [
                'ownerRecord' => $glossary,
                'pageClass' => EditGlossary::class,
            ])
            ->assertSuccessful();
    }

    public function test_role_users_relation_manager_uses_pagination_defaults(): void
    {
        $user = $this->createManagerUser();
        $role = Role::firstOrCreate(['name' => 'Reviewer', 'guard_name' => 'web']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(UsersRelationManager::class, [
                'ownerRecord' => $role,
                'pageClass' => EditRole::class,
            ])
            ->assertSuccessful();
    }

    // ── Convention 6: Consistent label terms ──────────────────────────────────

    public function test_partner_translation_images_delete_action_is_labelled_delete_permanently(): void
    {
        $user = $this->createCrudUser();
        $partner = Partner::factory()->create();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);
        $context = Context::factory()->create(['internal_name' => 'Catalogue']);
        $partnerTranslation = $partner->translations()->create([
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Jordan Museum EN',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(PartnerTranslationImagesRelationManager::class, [
                'ownerRecord' => $partnerTranslation,
                'pageClass' => EditPartnerTranslation::class,
            ])
            ->assertTableActionHasLabel('delete', 'Delete permanently');
    }

    public function test_item_images_delete_action_is_labelled_delete_permanently(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ItemImagesRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->assertTableActionHasLabel('delete', 'Delete permanently');
    }

    public function test_partner_images_delete_action_is_labelled_delete_permanently(): void
    {
        $user = $this->createCrudUser();
        $partner = Partner::factory()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(PartnerImagesRelationManager::class, [
                'ownerRecord' => $partner,
                'pageClass' => EditPartner::class,
            ])
            ->assertTableActionHasLabel('delete', 'Delete permanently');
    }
}
