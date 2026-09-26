<?php

namespace Tests\Filament\Resources;

use App\Filament\Resources\ItemItemLinkResource\Pages\CreateItemItemLink;
use App\Filament\Resources\ItemItemLinkResource\Pages\EditItemItemLink;
use App\Filament\Resources\ItemItemLinkResource\Pages\ListItemItemLink;
use App\Filament\Resources\ItemItemLinkResource\RelationManagers\TranslationsRelationManager;
use App\Filament\Resources\ItemResource\Pages\EditItem;
use App\Filament\Resources\ItemResource\RelationManagers\IncomingLinksRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\OutgoingLinksRelationManager;
use App\Models\Context;
use App\Models\Item;
use App\Models\ItemItemLink;
use App\Models\ItemItemLinkTranslation;
use App\Models\Language;
use Filament\Tables\Actions\DeleteAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

class ItemItemLinkResourceTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    // ── ItemItemLinkResource pages ────────────────────────────────────────────

    public function test_authorized_users_can_render_all_item_item_link_resource_pages(): void
    {
        $user = $this->createCrudUser();
        $source = Item::factory()->Object()->create(['internal_name' => 'Source item']);
        $target = Item::factory()->Object()->create(['internal_name' => 'Target item']);
        $context = Context::factory()->create(['internal_name' => 'Catalogue']);
        $link = ItemItemLink::factory()->create([
            'source_id' => $source->id,
            'target_id' => $target->id,
            'context_id' => $context->id,
        ]);

        $this->actingAs($user)->get('/admin/item-item-links')
            ->assertOk()
            ->assertSee('Item Links');

        $this->actingAs($user)->get('/admin/item-item-links/create')
            ->assertOk()
            ->assertSee('Create');

        $this->actingAs($user)->get("/admin/item-item-links/{$link->getKey()}/edit")
            ->assertOk()
            ->assertSee('Translations');

        $this->actingAs($user)->get("/admin/item-item-links/{$link->getKey()}")
            ->assertOk()
            ->assertSee('Translations');
    }

    public function test_authorized_users_can_create_edit_and_delete_item_item_links(): void
    {
        $user = $this->createCrudUser();
        $source = Item::factory()->Object()->create(['internal_name' => 'Source item']);
        $target = Item::factory()->Object()->create(['internal_name' => 'Target item']);
        $context = Context::factory()->create(['internal_name' => 'Catalogue']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CreateItemItemLink::class)
            ->fillForm([
                'source_id' => $source->id,
                'target_id' => $target->id,
                'context_id' => $context->id,
            ])
            ->call('create')
            ->assertHasNoFormErrors();

        $link = ItemItemLink::firstOrFail();

        $this->assertDatabaseHas('item_item_links', [
            'source_id' => $source->id,
            'target_id' => $target->id,
            'context_id' => $context->id,
        ]);

        $newTarget = Item::factory()->Object()->create(['internal_name' => 'New target']);

        Livewire::actingAs($user)
            ->test(EditItemItemLink::class, ['record' => $link->getRouteKey()])
            ->fillForm([
                'target_id' => $newTarget->id,
            ])
            ->call('save')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('item_item_links', [
            'id' => $link->id,
            'target_id' => $newTarget->id,
        ]);

        Livewire::actingAs($user)
            ->test(ListItemItemLink::class)
            ->callTableAction(DeleteAction::class, $link->fresh())
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('item_item_links', [
            'id' => $link->id,
        ]);
    }

    public function test_item_item_link_list_shows_source_and_target(): void
    {
        $user = $this->createCrudUser();
        $source = Item::factory()->Object()->create(['internal_name' => 'Source item']);
        $target = Item::factory()->Object()->create(['internal_name' => 'Target item']);
        $link = ItemItemLink::factory()->create([
            'source_id' => $source->id,
            'target_id' => $target->id,
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListItemItemLink::class)
            ->assertCanSeeTableRecords([$link]);
    }

    // ── TranslationsRelationManager ───────────────────────────────────────────

    public function test_translations_relation_manager_supports_crud_operations(): void
    {
        $user = $this->createCrudUser();
        $source = Item::factory()->Object()->create(['internal_name' => 'Source item']);
        $target = Item::factory()->Object()->create(['internal_name' => 'Target item']);
        $link = ItemItemLink::factory()->create([
            'source_id' => $source->id,
            'target_id' => $target->id,
        ]);
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(TranslationsRelationManager::class, [
                'ownerRecord' => $link,
                'pageClass' => EditItemItemLink::class,
            ])
            ->mountTableAction('create')
            ->setTableActionData([
                'language_id' => $language->id,
                'description' => 'Link description forward',
                'reciprocal_description' => 'Link description backward',
            ])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $translation = $link->translations()->firstOrFail();

        $this->assertDatabaseHas('item_item_link_translations', [
            'item_item_link_id' => $link->id,
            'language_id' => $language->id,
            'description' => 'Link description forward',
            'reciprocal_description' => 'Link description backward',
        ]);

        Livewire::actingAs($user)
            ->test(TranslationsRelationManager::class, [
                'ownerRecord' => $link,
                'pageClass' => EditItemItemLink::class,
            ])
            ->assertCanSeeTableRecords([$translation])
            ->callTableAction(DeleteAction::class, $translation->fresh())
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('item_item_link_translations', [
            'id' => $translation->id,
        ]);
    }

    public function test_translations_relation_manager_enforces_unique_language_per_link(): void
    {
        $user = $this->createCrudUser();
        $source = Item::factory()->Object()->create(['internal_name' => 'Source item']);
        $target = Item::factory()->Object()->create(['internal_name' => 'Target item']);
        $link = ItemItemLink::factory()->create([
            'source_id' => $source->id,
            'target_id' => $target->id,
        ]);
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        ItemItemLinkTranslation::factory()->create([
            'item_item_link_id' => $link->id,
            'language_id' => $language->id,
            'description' => 'Existing translation',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(TranslationsRelationManager::class, [
                'ownerRecord' => $link,
                'pageClass' => EditItemItemLink::class,
            ])
            ->mountTableAction('create')
            ->setTableActionData([
                'language_id' => $language->id,
                'description' => 'Duplicate translation',
            ])
            ->callMountedTableAction()
            ->assertHasTableActionErrors(['language_id']);
    }

    // ── OutgoingLinksRelationManager ──────────────────────────────────────────

    public function test_outgoing_links_relation_manager_shows_links_where_item_is_source(): void
    {
        $user = $this->createCrudUser();
        $source = Item::factory()->Object()->create(['internal_name' => 'Source item']);
        $target = Item::factory()->Object()->create(['internal_name' => 'Target item']);
        $unrelated = Item::factory()->Object()->create(['internal_name' => 'Unrelated item']);
        $outgoingLink = ItemItemLink::factory()->create([
            'source_id' => $source->id,
            'target_id' => $target->id,
        ]);
        $incomingLink = ItemItemLink::factory()->create([
            'source_id' => $unrelated->id,
            'target_id' => $source->id,
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(OutgoingLinksRelationManager::class, [
                'ownerRecord' => $source,
                'pageClass' => EditItem::class,
            ])
            ->assertCanSeeTableRecords([$outgoingLink])
            ->assertCanNotSeeTableRecords([$incomingLink]);
    }

    public function test_outgoing_links_relation_manager_supports_crud(): void
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
            ->callTableAction(DeleteAction::class, $link->fresh())
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('item_item_links', [
            'id' => $link->id,
        ]);
    }

    // ── IncomingLinksRelationManager ──────────────────────────────────────────

    public function test_incoming_links_relation_manager_shows_links_where_item_is_target(): void
    {
        $user = $this->createCrudUser();
        $source = Item::factory()->Object()->create(['internal_name' => 'Source item']);
        $target = Item::factory()->Object()->create(['internal_name' => 'Target item']);
        $unrelated = Item::factory()->Object()->create(['internal_name' => 'Unrelated item']);
        $outgoingLink = ItemItemLink::factory()->create([
            'source_id' => $source->id,
            'target_id' => $unrelated->id,
        ]);
        $incomingLink = ItemItemLink::factory()->create([
            'source_id' => $source->id,
            'target_id' => $target->id,
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(IncomingLinksRelationManager::class, [
                'ownerRecord' => $target,
                'pageClass' => EditItem::class,
            ])
            ->assertCanSeeTableRecords([$incomingLink])
            ->assertCanNotSeeTableRecords([$outgoingLink]);
    }

    public function test_incoming_links_relation_manager_supports_crud(): void
    {
        $user = $this->createCrudUser();
        $source = Item::factory()->Object()->create(['internal_name' => 'Source item']);
        $target = Item::factory()->Object()->create(['internal_name' => 'Target item']);
        $context = Context::factory()->create(['internal_name' => 'Catalogue']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(IncomingLinksRelationManager::class, [
                'ownerRecord' => $target,
                'pageClass' => EditItem::class,
            ])
            ->mountTableAction('create')
            ->setTableActionData([
                'source_id' => $source->id,
                'context_id' => $context->id,
            ])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $link = $target->incomingLinks()->firstOrFail();

        $this->assertDatabaseHas('item_item_links', [
            'source_id' => $source->id,
            'target_id' => $target->id,
            'context_id' => $context->id,
        ]);

        Livewire::actingAs($user)
            ->test(IncomingLinksRelationManager::class, [
                'ownerRecord' => $target,
                'pageClass' => EditItem::class,
            ])
            ->callTableAction(DeleteAction::class, $link->fresh())
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('item_item_links', [
            'id' => $link->id,
        ]);
    }
}
