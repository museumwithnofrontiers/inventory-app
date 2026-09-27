<?php

namespace Tests\Filament\RelationManagers;

use App\Filament\Resources\ItemResource\Pages\ViewItem;
use App\Filament\Resources\ItemResource\RelationManagers\TimelineEventsRelationManager;
use App\Filament\Resources\TimelineEventResource\Pages\ViewTimelineEvent;
use App\Filament\Resources\TimelineEventResource\RelationManagers\ItemsRelationManager as TimelineEventItemsRelationManager;
use App\Models\Item;
use App\Models\TimelineEvent;
use App\Models\TimelineEventItem;
use Filament\Tables\Actions\DetachAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * M7 Story A2.3 (#1902): the timeline_event_item pivot, both sides. Mounted
 * on the View pages (ViewItem, ViewTimelineEvent) — where every entry point
 * into an Item or TimelineEvent lands (M7 Story A0.6, #1895).
 */
class TimelineEventItemPivotTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    // ── Item side: TimelineEventsRelationManager ─────────────────────────────

    public function test_crud_user_attaches_edits_and_detaches_a_timeline_event_from_the_item_view_page(): void
    {
        $item = Item::factory()->Object()->create();
        $event = TimelineEvent::factory()->create();
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(TimelineEventsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->mountTableAction('attach')
            ->setTableActionData([
                'recordId' => $event->id,
                'display_order' => 3,
                'extra' => json_encode(['note' => 'first']),
            ])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('timeline_event_item', [
            'timeline_event_id' => $event->id,
            'item_id' => $item->id,
            'display_order' => 3,
        ]);

        $pivot = TimelineEventItem::query()
            ->where('timeline_event_id', $event->id)
            ->where('item_id', $item->id)
            ->firstOrFail();
        $this->assertSame(['note' => 'first'], $pivot->extra);
        $this->assertNull($pivot->backward_compatibility);

        $eventInternalNameBeforeEdit = $event->internal_name;

        Livewire::actingAs($user)
            ->test(TimelineEventsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->mountTableAction('edit', $event)
            ->setTableActionData([
                'display_order' => 7,
                'extra' => json_encode(['note' => 'updated']),
            ])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('timeline_event_item', [
            'timeline_event_id' => $event->id,
            'item_id' => $item->id,
            'display_order' => 7,
        ]);
        $pivot = TimelineEventItem::query()
            ->where('timeline_event_id', $event->id)
            ->where('item_id', $item->id)
            ->firstOrFail();
        $this->assertSame(['note' => 'updated'], $pivot->extra);
        // The edit-pivot modal must never touch the related TimelineEvent's own columns.
        $this->assertSame($eventInternalNameBeforeEdit, $event->fresh()->internal_name);

        Livewire::actingAs($user)
            ->test(TimelineEventsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->callTableAction(DetachAction::class, $event->fresh())
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('timeline_event_item', [
            'timeline_event_id' => $event->id,
            'item_id' => $item->id,
        ]);
        $this->assertModelExists($event);
    }

    public function test_item_side_attach_and_edit_never_expose_backward_compatibility(): void
    {
        $item = Item::factory()->Object()->create();
        $event = TimelineEvent::factory()->create();
        $item->timelineEvents()->attach($event->id, ['display_order' => 1, 'backward_compatibility' => 'mwnf3:legacy:1']);
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        $component = Livewire::actingAs($user)
            ->test(TimelineEventsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ]);

        $component->mountTableAction('attach');
        $attachFields = array_keys($component->instance()->getMountedTableActionForm()->getFlatFields());
        $component->call('unmountTableAction', false, false);
        $this->assertNotContains('backward_compatibility', $attachFields);

        $component->mountTableAction('edit', $event);
        $editFields = array_keys($component->instance()->getMountedTableActionForm()->getFlatFields());
        $component->call('unmountTableAction', false, false);
        $this->assertNotContains('backward_compatibility', $editFields);
    }

    public function test_view_only_user_sees_no_timeline_event_pivot_mutations_on_the_item_view_page(): void
    {
        $item = Item::factory()->Object()->create();
        $event = TimelineEvent::factory()->create();
        $item->timelineEvents()->attach($event->id, ['display_order' => 1]);
        $user = $this->createViewOnlyUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(TimelineEventsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->assertTableActionHidden('attach')
            ->assertTableActionHidden('edit', $event)
            ->assertTableActionHidden('detach', $event);
    }

    // ── TimelineEvent side: ItemsRelationManager ─────────────────────────────

    public function test_crud_user_attaches_edits_and_detaches_an_item_from_the_timeline_event_view_page(): void
    {
        $event = TimelineEvent::factory()->create();
        $item = Item::factory()->Object()->create();
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(TimelineEventItemsRelationManager::class, [
                'ownerRecord' => $event,
                'pageClass' => ViewTimelineEvent::class,
            ])
            ->mountTableAction('attach')
            ->setTableActionData([
                'recordId' => $item->id,
                'display_order' => 2,
                'extra' => json_encode(['note' => 'appearance']),
            ])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('timeline_event_item', [
            'timeline_event_id' => $event->id,
            'item_id' => $item->id,
            'display_order' => 2,
        ]);
        $pivot = TimelineEventItem::query()
            ->where('timeline_event_id', $event->id)
            ->where('item_id', $item->id)
            ->firstOrFail();
        $this->assertSame(['note' => 'appearance'], $pivot->extra);

        $itemInternalNameBeforeEdit = $item->internal_name;

        Livewire::actingAs($user)
            ->test(TimelineEventItemsRelationManager::class, [
                'ownerRecord' => $event,
                'pageClass' => ViewTimelineEvent::class,
            ])
            ->mountTableAction('edit', $item)
            ->setTableActionData([
                'display_order' => 9,
                'extra' => json_encode(['note' => 'appearance-updated']),
            ])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('timeline_event_item', [
            'timeline_event_id' => $event->id,
            'item_id' => $item->id,
            'display_order' => 9,
        ]);
        $pivot = TimelineEventItem::query()
            ->where('timeline_event_id', $event->id)
            ->where('item_id', $item->id)
            ->firstOrFail();
        $this->assertSame(['note' => 'appearance-updated'], $pivot->extra);
        $this->assertSame($itemInternalNameBeforeEdit, $item->fresh()->internal_name);

        Livewire::actingAs($user)
            ->test(TimelineEventItemsRelationManager::class, [
                'ownerRecord' => $event,
                'pageClass' => ViewTimelineEvent::class,
            ])
            ->callTableAction(DetachAction::class, $item->fresh())
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('timeline_event_item', [
            'timeline_event_id' => $event->id,
            'item_id' => $item->id,
        ]);
        $this->assertModelExists($item);
    }

    public function test_view_only_user_sees_no_item_pivot_mutations_on_the_timeline_event_view_page(): void
    {
        $event = TimelineEvent::factory()->create();
        $item = Item::factory()->Object()->create();
        $event->items()->attach($item->id, ['display_order' => 1]);
        $user = $this->createViewOnlyUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(TimelineEventItemsRelationManager::class, [
                'ownerRecord' => $event,
                'pageClass' => ViewTimelineEvent::class,
            ])
            ->assertTableActionHidden('attach')
            ->assertTableActionHidden('edit', $item)
            ->assertTableActionHidden('detach', $item);
    }
}
