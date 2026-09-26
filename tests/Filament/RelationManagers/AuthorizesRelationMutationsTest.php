<?php

namespace Tests\Filament\RelationManagers;

use App\Enums\Permission;
use App\Filament\Resources\CollectionResource\Pages\EditCollection;
use App\Filament\Resources\CollectionResource\RelationManagers\ItemsRelationManager as CollectionItemsRelationManager;
use App\Filament\Resources\CollectionResource\RelationManagers\PartnersRelationManager as CollectionPartnersRelationManager;
use App\Filament\Resources\CollectionResource\RelationManagers\TranslationsRelationManager as CollectionTranslationsRelationManager;
use App\Filament\Resources\ItemResource\Pages\EditItem;
use App\Filament\Resources\ItemResource\RelationManagers\ArtistsRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\DocumentsRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\DynastiesRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\ImagesRelationManager as ItemImagesRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\IncomingLinksRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\MediaRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\OutgoingLinksRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\TagsRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\TranslationsRelationManager as ItemTranslationsRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\WorkshopsRelationManager;
use App\Filament\Resources\PartnerResource\Pages\EditPartner;
use App\Filament\Resources\PartnerResource\RelationManagers\TranslationsRelationManager as PartnerTranslationsRelationManager;
use App\Filament\Resources\TimelineEventResource\Pages\EditTimelineEvent;
use App\Filament\Resources\TimelineEventResource\RelationManagers\ItemsRelationManager as TimelineEventItemsRelationManager;
use App\Models\Artist;
use App\Models\Collection;
use App\Models\Context;
use App\Models\Dynasty;
use App\Models\Item;
use App\Models\ItemDocument;
use App\Models\ItemImage;
use App\Models\ItemItemLink;
use App\Models\ItemMedia;
use App\Models\Language;
use App\Models\Partner;
use App\Models\Tag;
use App\Models\TimelineEvent;
use App\Models\User;
use App\Models\Workshop;
use Filament\Facades\Filament;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

/**
 * Story #1890 (M7 epic #1871): every relation manager that mutates data uses
 * App\Filament\Concerns\AuthorizesRelationMutations, which gates every
 * mutating action on `update` of the HOST record (the resource being edited),
 * plus the related entity's own policy for Create/Edit/Delete of an entity
 * that carries one. This asserts, per manager, that:
 *
 * - a `view data`-only user (who therefore cannot `update` the host record)
 *   sees no mutating action, and
 * - a `create/update/delete data` user keeps every mutating action the
 *   manager exposed before this story.
 */
class AuthorizesRelationMutationsTest extends TestCase
{
    use RefreshDatabase;

    // ── Helpers ──────────────────────────────────────────────────────────────

    protected function createCrudUser(): User
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo([
            Permission::ACCESS_ADMIN_PANEL->value,
            Permission::VIEW_DATA->value,
            Permission::CREATE_DATA->value,
            Permission::UPDATE_DATA->value,
            Permission::DELETE_DATA->value,
        ]);

        return $user;
    }

    protected function createViewOnlyUser(): User
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo([
            Permission::ACCESS_ADMIN_PANEL->value,
            Permission::VIEW_DATA->value,
        ]);

        return $user;
    }

    protected function setCurrentPanel(): void
    {
        Filament::setCurrentPanel(Filament::getPanel('admin'));
    }

    protected function makeCollection(): Collection
    {
        $context = Context::factory()->create();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);

        return Collection::factory()->create([
            'context_id' => $context->id,
            'language_id' => $language->id,
        ]);
    }

    // ── Collection: ItemsRelationManager (pivot) ────────────────────────────

    public function test_collection_items_relation_manager_hides_mutations_for_view_only_user(): void
    {
        $collection = $this->makeCollection();
        $item = Item::factory()->Object()->create();
        $user = $this->createViewOnlyUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CollectionItemsRelationManager::class, [
                'ownerRecord' => $collection,
                'pageClass' => EditCollection::class,
            ])
            ->assertTableActionHidden('attach')
            ->assertTableActionHidden('detach', $item)
            ->assertTableBulkActionHidden('detach');
    }

    public function test_collection_items_relation_manager_keeps_mutations_for_crud_user(): void
    {
        $collection = $this->makeCollection();
        $item = Item::factory()->Object()->create();
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CollectionItemsRelationManager::class, [
                'ownerRecord' => $collection,
                'pageClass' => EditCollection::class,
            ])
            ->assertTableActionVisible('attach')
            ->assertTableActionVisible('detach', $item)
            ->assertTableBulkActionVisible('detach');
    }

    // ── Collection: PartnersRelationManager (pivot) ─────────────────────────

    public function test_collection_partners_relation_manager_hides_mutations_for_view_only_user(): void
    {
        $collection = $this->makeCollection();
        $partner = Partner::factory()->create();
        $user = $this->createViewOnlyUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CollectionPartnersRelationManager::class, [
                'ownerRecord' => $collection,
                'pageClass' => EditCollection::class,
            ])
            ->assertTableActionHidden('attach')
            ->assertTableActionHidden('detach', $partner)
            ->assertTableBulkActionHidden('detach');
    }

    public function test_collection_partners_relation_manager_keeps_mutations_for_crud_user(): void
    {
        $collection = $this->makeCollection();
        $partner = Partner::factory()->create();
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CollectionPartnersRelationManager::class, [
                'ownerRecord' => $collection,
                'pageClass' => EditCollection::class,
            ])
            ->assertTableActionVisible('attach')
            ->assertTableActionVisible('detach', $partner)
            ->assertTableBulkActionVisible('detach');
    }

    // ── Collection: TranslationsRelationManager (has-many, own Resource) ───

    public function test_collection_translations_relation_manager_hides_mutations_for_view_only_user(): void
    {
        $collection = $this->makeCollection();
        $language = Language::factory()->create(['id' => 'fra', 'internal_name' => 'French']);
        $context = Context::factory()->create();
        $translation = $collection->translations()->create([
            'language_id' => $language->id,
            'context_id' => $context->id,
            'title' => 'Le titre',
        ]);
        $user = $this->createViewOnlyUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CollectionTranslationsRelationManager::class, [
                'ownerRecord' => $collection,
                'pageClass' => EditCollection::class,
            ])
            ->assertTableActionHidden('create')
            ->assertTableActionHidden('createDefaultTranslation')
            ->assertTableActionHidden('editTranslation', $translation)
            ->assertTableActionHidden('delete', $translation);
    }

    public function test_collection_translations_relation_manager_keeps_mutations_for_crud_user(): void
    {
        $collection = $this->makeCollection();
        $language = Language::factory()->create(['id' => 'fra', 'internal_name' => 'French']);
        $context = Context::factory()->create();
        $translation = $collection->translations()->create([
            'language_id' => $language->id,
            'context_id' => $context->id,
            'title' => 'Le titre',
        ]);
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CollectionTranslationsRelationManager::class, [
                'ownerRecord' => $collection,
                'pageClass' => EditCollection::class,
            ])
            ->assertTableActionVisible('create')
            ->assertTableActionVisible('editTranslation', $translation)
            ->assertTableActionVisible('delete', $translation);
    }

    // ── Item: TagsRelationManager (pivot) ───────────────────────────────────

    public function test_item_tags_relation_manager_hides_mutations_for_view_only_user(): void
    {
        $item = Item::factory()->Object()->create();
        $tag = Tag::factory()->create();
        $user = $this->createViewOnlyUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(TagsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->assertTableActionHidden('attach')
            ->assertTableActionHidden('detach', $tag)
            ->assertTableBulkActionHidden('detach');
    }

    public function test_item_tags_relation_manager_keeps_mutations_for_crud_user(): void
    {
        $item = Item::factory()->Object()->create();
        $tag = Tag::factory()->create();
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(TagsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->assertTableActionVisible('attach')
            ->assertTableActionVisible('detach', $tag)
            ->assertTableBulkActionVisible('detach');
    }

    /**
     * Tag has its own policy (TagPolicy), keyed on `manage-reference-data`, not
     * on the generic data permissions. Attach/Detach must ignore that policy
     * entirely and gate purely on the host Item's `update` — a user who is
     * fully authorized to manage tags directly still can't attach/detach one
     * from an Item they can't update. Before this story, Filament's default
     * `canAttach()`/`canDetach()` allowed this unconditionally, because
     * TagPolicy doesn't define `attach`/`detach` methods.
     */
    public function test_item_tags_relation_manager_ignores_tags_own_policy_and_requires_host_update(): void
    {
        $item = Item::factory()->Object()->create();
        $tag = Tag::factory()->create();
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo([
            Permission::ACCESS_ADMIN_PANEL->value,
            Permission::VIEW_DATA->value,
            Permission::MANAGE_REFERENCE_DATA->value,
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(TagsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->assertTableActionHidden('attach')
            ->assertTableActionHidden('detach', $tag)
            ->assertTableBulkActionHidden('detach');
    }

    // ── Item: ArtistsRelationManager (pivot) ────────────────────────────────

    public function test_item_artists_relation_manager_hides_mutations_for_view_only_user(): void
    {
        $item = Item::factory()->Object()->create();
        $artist = Artist::factory()->create();
        $user = $this->createViewOnlyUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ArtistsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->assertTableActionHidden('attach')
            ->assertTableActionHidden('detach', $artist)
            ->assertTableBulkActionHidden('detach');
    }

    public function test_item_artists_relation_manager_keeps_mutations_for_crud_user(): void
    {
        $item = Item::factory()->Object()->create();
        $artist = Artist::factory()->create();
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ArtistsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->assertTableActionVisible('attach')
            ->assertTableActionVisible('detach', $artist)
            ->assertTableBulkActionVisible('detach');
    }

    // ── Item: WorkshopsRelationManager (pivot) ──────────────────────────────

    public function test_item_workshops_relation_manager_hides_mutations_for_view_only_user(): void
    {
        $item = Item::factory()->Object()->create();
        $workshop = Workshop::factory()->create();
        $user = $this->createViewOnlyUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(WorkshopsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->assertTableActionHidden('attach')
            ->assertTableActionHidden('detach', $workshop)
            ->assertTableBulkActionHidden('detach');
    }

    public function test_item_workshops_relation_manager_keeps_mutations_for_crud_user(): void
    {
        $item = Item::factory()->Object()->create();
        $workshop = Workshop::factory()->create();
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(WorkshopsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->assertTableActionVisible('attach')
            ->assertTableActionVisible('detach', $workshop)
            ->assertTableBulkActionVisible('detach');
    }

    // ── Item: DynastiesRelationManager (pivot) ──────────────────────────────

    public function test_item_dynasties_relation_manager_hides_mutations_for_view_only_user(): void
    {
        $item = Item::factory()->Object()->create();
        $dynasty = Dynasty::factory()->create();
        $user = $this->createViewOnlyUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(DynastiesRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->assertTableActionHidden('attach')
            ->assertTableActionHidden('detach', $dynasty)
            ->assertTableBulkActionHidden('detach');
    }

    public function test_item_dynasties_relation_manager_keeps_mutations_for_crud_user(): void
    {
        $item = Item::factory()->Object()->create();
        $dynasty = Dynasty::factory()->create();
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(DynastiesRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->assertTableActionVisible('attach')
            ->assertTableActionVisible('detach', $dynasty)
            ->assertTableBulkActionVisible('detach');
    }

    // ── Item: MediaRelationManager (has-many, no policy of its own) ─────────

    /**
     * This is the gap #1864 found: ItemMedia has no policy of its own, so
     * Filament's default canCreate() allowed Create unconditionally. It must
     * now require `update` on the host Item.
     */
    public function test_item_media_relation_manager_hides_create_for_view_only_user(): void
    {
        $item = Item::factory()->Object()->create();
        $user = $this->createViewOnlyUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(MediaRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->assertTableActionHidden('create');
    }

    public function test_item_media_relation_manager_hides_all_mutations_for_view_only_user(): void
    {
        $item = Item::factory()->Object()->create();
        $media = ItemMedia::factory()->forItem($item)->create();
        $user = $this->createViewOnlyUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(MediaRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->assertTableActionHidden('create')
            ->assertTableActionHidden('edit', $media)
            ->assertTableActionHidden('delete', $media);
    }

    public function test_item_media_relation_manager_keeps_mutations_for_crud_user(): void
    {
        $item = Item::factory()->Object()->create();
        $media = ItemMedia::factory()->forItem($item)->create();
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(MediaRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->assertTableActionVisible('create')
            ->assertTableActionVisible('edit', $media)
            ->assertTableActionVisible('delete', $media);
    }

    // ── Item: DocumentsRelationManager (delete-only, no policy) ─────────────

    public function test_item_documents_relation_manager_hides_delete_for_view_only_user(): void
    {
        $item = Item::factory()->Object()->create();
        $document = ItemDocument::factory()->forItem($item)->create();
        $user = $this->createViewOnlyUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(DocumentsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->assertTableActionHidden('delete', $document);
    }

    public function test_item_documents_relation_manager_keeps_delete_for_crud_user(): void
    {
        $item = Item::factory()->Object()->create();
        $document = ItemDocument::factory()->forItem($item)->create();
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(DocumentsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->assertTableActionVisible('delete', $document);
    }

    // ── Item: OutgoingLinksRelationManager (has-many, own policy) ───────────

    public function test_item_outgoing_links_relation_manager_hides_mutations_for_view_only_user(): void
    {
        $item = Item::factory()->Object()->create();
        $target = Item::factory()->Object()->create();
        $link = ItemItemLink::factory()->between($item, $target)->create();
        $user = $this->createViewOnlyUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(OutgoingLinksRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->assertTableActionHidden('create')
            ->assertTableActionHidden('edit', $link)
            ->assertTableActionHidden('delete', $link);
    }

    public function test_item_outgoing_links_relation_manager_keeps_mutations_for_crud_user(): void
    {
        $item = Item::factory()->Object()->create();
        $target = Item::factory()->Object()->create();
        $link = ItemItemLink::factory()->between($item, $target)->create();
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(OutgoingLinksRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->assertTableActionVisible('create')
            ->assertTableActionVisible('edit', $link)
            ->assertTableActionVisible('delete', $link);
    }

    // ── Item: IncomingLinksRelationManager (has-many, own policy) ───────────

    public function test_item_incoming_links_relation_manager_hides_mutations_for_view_only_user(): void
    {
        $item = Item::factory()->Object()->create();
        $source = Item::factory()->Object()->create();
        $link = ItemItemLink::factory()->between($source, $item)->create();
        $user = $this->createViewOnlyUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(IncomingLinksRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->assertTableActionHidden('create')
            ->assertTableActionHidden('edit', $link)
            ->assertTableActionHidden('delete', $link);
    }

    public function test_item_incoming_links_relation_manager_keeps_mutations_for_crud_user(): void
    {
        $item = Item::factory()->Object()->create();
        $source = Item::factory()->Object()->create();
        $link = ItemItemLink::factory()->between($source, $item)->create();
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(IncomingLinksRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->assertTableActionVisible('create')
            ->assertTableActionVisible('edit', $link)
            ->assertTableActionVisible('delete', $link);
    }

    // ── Item: TranslationsRelationManager (has-many, own Resource) ─────────

    public function test_item_translations_relation_manager_hides_mutations_for_view_only_user(): void
    {
        $item = Item::factory()->Object()->create();
        $language = Language::factory()->create(['id' => 'fra', 'internal_name' => 'French']);
        $context = Context::factory()->create();
        $translation = $item->translations()->create([
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Nom',
        ]);
        $user = $this->createViewOnlyUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ItemTranslationsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->assertTableActionHidden('create')
            ->assertTableActionHidden('createDefaultTranslation')
            ->assertTableActionHidden('editTranslation', $translation)
            ->assertTableActionHidden('delete', $translation);
    }

    public function test_item_translations_relation_manager_keeps_mutations_for_crud_user(): void
    {
        $item = Item::factory()->Object()->create();
        $language = Language::factory()->create(['id' => 'fra', 'internal_name' => 'French']);
        $context = Context::factory()->create();
        $translation = $item->translations()->create([
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Nom',
        ]);
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ItemTranslationsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->assertTableActionVisible('create')
            ->assertTableActionVisible('editTranslation', $translation)
            ->assertTableActionVisible('delete', $translation);
    }

    // ── Partner: TranslationsRelationManager (has-many, own Resource) ──────

    public function test_partner_translations_relation_manager_hides_mutations_for_view_only_user(): void
    {
        $partner = Partner::factory()->create();
        $language = Language::factory()->create(['id' => 'fra', 'internal_name' => 'French']);
        $context = Context::factory()->create();
        $translation = $partner->translations()->create([
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Nom',
        ]);
        $user = $this->createViewOnlyUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(PartnerTranslationsRelationManager::class, [
                'ownerRecord' => $partner,
                'pageClass' => EditPartner::class,
            ])
            ->assertTableActionHidden('create')
            ->assertTableActionHidden('createDefaultTranslation')
            ->assertTableActionHidden('editTranslation', $translation)
            ->assertTableActionHidden('delete', $translation);
    }

    public function test_partner_translations_relation_manager_keeps_mutations_for_crud_user(): void
    {
        $partner = Partner::factory()->create();
        $language = Language::factory()->create(['id' => 'fra', 'internal_name' => 'French']);
        $context = Context::factory()->create();
        $translation = $partner->translations()->create([
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Nom',
        ]);
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(PartnerTranslationsRelationManager::class, [
                'ownerRecord' => $partner,
                'pageClass' => EditPartner::class,
            ])
            ->assertTableActionVisible('create')
            ->assertTableActionVisible('editTranslation', $translation)
            ->assertTableActionVisible('delete', $translation);
    }

    // ── TimelineEvent: ItemsRelationManager (pivot) ─────────────────────────

    public function test_timeline_event_items_relation_manager_hides_mutations_for_view_only_user(): void
    {
        $timelineEvent = TimelineEvent::factory()->create();
        $item = Item::factory()->Object()->create();
        $user = $this->createViewOnlyUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(TimelineEventItemsRelationManager::class, [
                'ownerRecord' => $timelineEvent,
                'pageClass' => EditTimelineEvent::class,
            ])
            ->assertTableActionHidden('attach')
            ->assertTableActionHidden('detach', $item)
            ->assertTableBulkActionHidden('detach');
    }

    public function test_timeline_event_items_relation_manager_keeps_mutations_for_crud_user(): void
    {
        $timelineEvent = TimelineEvent::factory()->create();
        $item = Item::factory()->Object()->create();
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(TimelineEventItemsRelationManager::class, [
                'ownerRecord' => $timelineEvent,
                'pageClass' => EditTimelineEvent::class,
            ])
            ->assertTableActionVisible('attach')
            ->assertTableActionVisible('detach', $item)
            ->assertTableBulkActionVisible('detach');
    }

    // ── BaseImagesRelationManager (image kind, via Item's ImagesRelationManager) ─

    public function test_item_images_relation_manager_hides_mutations_for_view_only_user(): void
    {
        $item = Item::factory()->Object()->create();
        $image = ItemImage::factory()->forItem($item)->create();
        $user = $this->createViewOnlyUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ItemImagesRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->assertTableActionHidden('attach')
            ->assertTableActionHidden('edit', $image)
            ->assertTableActionHidden('detach', $image)
            ->assertTableActionHidden('delete', $image);
    }

    public function test_item_images_relation_manager_keeps_mutations_for_crud_user(): void
    {
        $item = Item::factory()->Object()->create();
        $image = ItemImage::factory()->forItem($item)->create();
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ItemImagesRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => EditItem::class,
            ])
            ->assertTableActionVisible('attach')
            ->assertTableActionVisible('edit', $image)
            ->assertTableActionVisible('detach', $image)
            ->assertTableActionVisible('delete', $image);
    }
}
