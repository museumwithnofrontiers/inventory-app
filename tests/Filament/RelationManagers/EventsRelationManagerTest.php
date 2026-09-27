<?php

namespace Tests\Filament\RelationManagers;

use App\Filament\Resources\TimelineEventResource;
use App\Filament\Resources\TimelineResource\Pages\ViewTimeline;
use App\Filament\Resources\TimelineResource\RelationManagers\EventsRelationManager;
use App\Models\Timeline;
use App\Models\TimelineEvent;
use Filament\Actions\MountableAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Features\SupportTesting\Testable;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * M7 story A5.4 (#2090): the has-many convention adapted for a required
 * parent on EventsRelationManager. Mounted on ViewTimeline — that's where
 * users land on a Timeline and where every action here must work per
 * AuthorizesRelationMutations (A0.1), which also makes the manager editable
 * on the resource's View page. There is no `Attach existing`/`Detach` here:
 * timeline_events.timeline_id is NOT NULL, so an event is moved to another
 * timeline via its own Edit form instead.
 */
class EventsRelationManagerTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    // ── Row: table lists the timeline's own events ──────────────────────────

    public function test_events_relation_manager_renders_the_timelines_own_events(): void
    {
        $user = $this->createCrudUser();
        $timeline = Timeline::factory()->create(['internal_name' => 'Test Timeline']);
        $event = TimelineEvent::factory()->create([
            'timeline_id' => $timeline->id,
            'internal_name' => 'Medieval Period',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(EventsRelationManager::class, [
                'ownerRecord' => $timeline,
                'pageClass' => ViewTimeline::class,
            ])
            ->assertCanSeeTableRecords([$event]);
    }

    // ── Header: Create ───────────────────────────────────────────────────────

    public function test_create_action_url_carries_the_timeline_id(): void
    {
        $user = $this->createCrudUser();
        $timeline = Timeline::factory()->create(['internal_name' => 'Test Timeline']);

        $this->setCurrentPanel();

        $component = Livewire::actingAs($user)->test(EventsRelationManager::class, [
            'ownerRecord' => $timeline,
            'pageClass' => ViewTimeline::class,
        ]);

        $create = $this->headerAction($component, 'create');

        $this->assertStringContainsString('/admin/timeline-events/create', (string) $create->getUrl());
        $this->assertStringContainsString("timeline_id={$timeline->id}", (string) $create->getUrl());
    }

    // ── Row: View / Edit navigate to TimelineEventResource ──────────────────

    public function test_view_action_navigates_to_the_events_view_page(): void
    {
        $user = $this->createCrudUser();
        $timeline = Timeline::factory()->create();
        $event = TimelineEvent::factory()->create(['timeline_id' => $timeline->id]);

        $this->setCurrentPanel();

        $component = Livewire::actingAs($user)->test(EventsRelationManager::class, [
            'ownerRecord' => $timeline,
            'pageClass' => ViewTimeline::class,
        ]);

        $view = $this->rowAction($component, 'view', $event);

        $this->assertSame(TimelineEventResource::getUrl('view', ['record' => $event]), $view);
    }

    public function test_edit_action_navigates_to_the_events_edit_page(): void
    {
        $user = $this->createCrudUser();
        $timeline = Timeline::factory()->create();
        $event = TimelineEvent::factory()->create(['timeline_id' => $timeline->id]);

        $this->setCurrentPanel();

        $component = Livewire::actingAs($user)->test(EventsRelationManager::class, [
            'ownerRecord' => $timeline,
            'pageClass' => ViewTimeline::class,
        ]);

        $edit = $this->rowAction($component, 'edit', $event);

        $this->assertSame(TimelineEventResource::getUrl('edit', ['record' => $event]), $edit);
    }

    // ── Row: Delete ───────────────────────────────────────────────────────────

    public function test_delete_action_removes_the_event(): void
    {
        $user = $this->createCrudUser();
        $timeline = Timeline::factory()->create();
        $event = TimelineEvent::factory()->create([
            'timeline_id' => $timeline->id,
            'internal_name' => 'Event to delete',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(EventsRelationManager::class, [
                'ownerRecord' => $timeline,
                'pageClass' => ViewTimeline::class,
            ])
            ->callTableAction('delete', $event)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('timeline_events', [
            'id' => $event->id,
        ]);
    }

    // ── Authorization: view-only user sees no mutating action ──────────────

    public function test_view_only_user_sees_no_mutating_action(): void
    {
        $viewer = $this->createViewOnlyUser();
        $timeline = Timeline::factory()->create();
        $event = TimelineEvent::factory()->create(['timeline_id' => $timeline->id]);

        $this->setCurrentPanel();

        Livewire::actingAs($viewer)
            ->test(EventsRelationManager::class, [
                'ownerRecord' => $timeline,
                'pageClass' => ViewTimeline::class,
            ])
            ->assertTableActionHidden('create')
            ->assertTableActionHidden('edit', $event)
            ->assertTableActionHidden('delete', $event);
    }

    public function test_crud_user_keeps_every_mutating_action(): void
    {
        $user = $this->createCrudUser();
        $timeline = Timeline::factory()->create();
        $event = TimelineEvent::factory()->create(['timeline_id' => $timeline->id]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(EventsRelationManager::class, [
                'ownerRecord' => $timeline,
                'pageClass' => ViewTimeline::class,
            ])
            ->assertTableActionVisible('create')
            ->assertTableActionVisible('view', $event)
            ->assertTableActionVisible('edit', $event)
            ->assertTableActionVisible('delete', $event);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function headerAction(Testable $component, string $name): MountableAction
    {
        $table = $component->instance()->getTable();

        foreach ($table->getHeaderActions() as $action) {
            if ($action instanceof MountableAction && $action->getName() === $name) {
                return $action;
            }
        }

        $this->fail("Header action [{$name}] not found.");
    }

    private function rowAction(Testable $component, string $name, TimelineEvent $record): ?string
    {
        $action = $component->instance()->getTable()->getAction($name);
        $this->assertNotNull($action, "Row action [{$name}] not found.");

        $action->record($record);

        return $action->getUrl();
    }
}
