<?php

namespace Tests\Filament\RelationManagers;

use App\Filament\Resources\GlossaryResource\Pages\ViewGlossary;
use App\Filament\Resources\ItemResource\Pages\ViewItem;
use App\Filament\Resources\ItemResource\RelationManagers\IncomingLinksRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\OutgoingLinksRelationManager;
use App\Models\Context;
use App\Models\Glossary;
use App\Models\GlossaryTranslation;
use App\Models\Item;
use App\Models\ItemItemLink;
use Filament\Tables\Actions\DeleteAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\Filament\Fixtures\GlossaryTranslationsWithoutConcernRelationManager;
use Tests\TestCase;

/**
 * M7 Story A0.6 (#1895): every entry point into an Item lands on its View
 * page (ItemResource's table `recordUrl` and every cross-resource link use
 * `getUrl('view')`), but Filament makes relation managers read-only on a
 * resource's View page by default. OutgoingLinksRelationManager and
 * IncomingLinksRelationManager use AuthorizesRelationMutations, so the fix
 * (App\Filament\Concerns\AuthorizesRelationMutations::isReadOnly()) unlocks
 * them there — this is the live check the story asks for, exercised through
 * Livewire against ViewItem instead of EditItem.
 */
class ItemLinksViewPageTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    // ── OutgoingLinksRelationManager on the View page ───────────────────────

    public function test_crud_user_creates_edits_and_deletes_an_outgoing_link_from_the_view_page(): void
    {
        $item = Item::factory()->Object()->create();
        $target = Item::factory()->Object()->create(['internal_name' => 'Target item']);
        $context = Context::factory()->create(['internal_name' => 'Catalogue']);
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(OutgoingLinksRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->mountTableAction('create')
            ->setTableActionData([
                'target_id' => $target->id,
                'context_id' => $context->id,
            ])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $link = $item->outgoingLinks()->firstOrFail();

        $this->assertDatabaseHas('item_item_links', [
            'source_id' => $item->id,
            'target_id' => $target->id,
            'context_id' => $context->id,
        ]);

        $newTarget = Item::factory()->Object()->create(['internal_name' => 'New target']);

        Livewire::actingAs($user)
            ->test(OutgoingLinksRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->mountTableAction('edit', $link)
            ->setTableActionData([
                'target_id' => $newTarget->id,
                'context_id' => $context->id,
            ])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('item_item_links', [
            'id' => $link->id,
            'target_id' => $newTarget->id,
        ]);

        Livewire::actingAs($user)
            ->test(OutgoingLinksRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->callTableAction(DeleteAction::class, $link->fresh())
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('item_item_links', [
            'id' => $link->id,
        ]);
    }

    public function test_view_only_user_sees_no_outgoing_link_mutations_on_the_view_page(): void
    {
        $item = Item::factory()->Object()->create();
        $target = Item::factory()->Object()->create();
        $link = ItemItemLink::factory()->between($item, $target)->create();
        $user = $this->createViewOnlyUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(OutgoingLinksRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->assertTableActionHidden('create')
            ->assertTableActionHidden('edit', $link)
            ->assertTableActionHidden('delete', $link);
    }

    // ── IncomingLinksRelationManager on the View page ───────────────────────

    public function test_crud_user_creates_edits_and_deletes_an_incoming_link_from_the_view_page(): void
    {
        $item = Item::factory()->Object()->create();
        $source = Item::factory()->Object()->create(['internal_name' => 'Source item']);
        $context = Context::factory()->create(['internal_name' => 'Catalogue']);
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(IncomingLinksRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->mountTableAction('create')
            ->setTableActionData([
                'source_id' => $source->id,
                'context_id' => $context->id,
            ])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $link = $item->incomingLinks()->firstOrFail();

        $this->assertDatabaseHas('item_item_links', [
            'source_id' => $source->id,
            'target_id' => $item->id,
            'context_id' => $context->id,
        ]);

        $newSource = Item::factory()->Object()->create(['internal_name' => 'New source']);

        Livewire::actingAs($user)
            ->test(IncomingLinksRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->mountTableAction('edit', $link)
            ->setTableActionData([
                'source_id' => $newSource->id,
                'context_id' => $context->id,
            ])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('item_item_links', [
            'id' => $link->id,
            'source_id' => $newSource->id,
        ]);

        Livewire::actingAs($user)
            ->test(IncomingLinksRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->callTableAction(DeleteAction::class, $link->fresh())
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('item_item_links', [
            'id' => $link->id,
        ]);
    }

    public function test_view_only_user_sees_no_incoming_link_mutations_on_the_view_page(): void
    {
        $item = Item::factory()->Object()->create();
        $source = Item::factory()->Object()->create();
        $link = ItemItemLink::factory()->between($source, $item)->create();
        $user = $this->createViewOnlyUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(IncomingLinksRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->assertTableActionHidden('create')
            ->assertTableActionHidden('edit', $link)
            ->assertTableActionHidden('delete', $link);
    }

    // ── Control: a manager WITHOUT AuthorizesRelationMutations stays ───────
    // ── read-only on its resource's View page ──────────────────────────────

    /**
     * The concern unlocks View pages only for managers that use it; any
     * other manager stays governed by Filament's panel-wide default
     * (read-only relation managers on View pages). A test-only manager
     * without the concern stands in, so this control never depends on which
     * real managers have adopted it. A full `manage-reference-data` user is
     * used, rather than a view-only one, so this isolates the View-page
     * read-only effect from any permission gate.
     */
    public function test_a_relation_manager_without_the_concern_stays_read_only_on_a_view_page(): void
    {
        $glossary = Glossary::factory()->create();
        $translation = GlossaryTranslation::factory()->create(['glossary_id' => $glossary->id]);
        $user = $this->createReferenceDataUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(GlossaryTranslationsWithoutConcernRelationManager::class, [
                'ownerRecord' => $glossary,
                'pageClass' => ViewGlossary::class,
            ])
            ->assertTableActionHidden('create')
            ->assertTableActionHidden('edit', $translation->getKey())
            ->assertTableActionHidden('delete', $translation->getKey());
    }
}
