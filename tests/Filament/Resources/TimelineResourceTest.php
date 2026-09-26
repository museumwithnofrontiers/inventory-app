<?php

namespace Tests\Filament\Resources;

use App\Filament\Resources\TimelineResource\Pages\CreateTimeline;
use App\Filament\Resources\TimelineResource\Pages\EditTimeline;
use App\Filament\Resources\TimelineResource\Pages\ListTimeline;
use App\Filament\Resources\TimelineResource\Pages\ViewTimeline;
use App\Filament\Resources\TimelineResource\RelationManagers\EventsRelationManager;
use App\Models\Timeline;
use App\Models\TimelineEvent;
use Filament\Tables\Actions\DeleteAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

class TimelineResourceTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_authorized_users_can_render_all_timeline_resource_pages(): void
    {
        $user = $this->createCrudUser();
        $timeline = Timeline::factory()->create([
            'internal_name' => 'Islamic Timeline',
        ]);

        $this->actingAs($user)->get('/admin/timelines')
            ->assertOk()
            ->assertSee('Timelines');

        $this->actingAs($user)->get('/admin/timelines/create')
            ->assertOk()
            ->assertSee('Create');

        $this->actingAs($user)->get("/admin/timelines/{$timeline->getKey()}/edit")
            ->assertOk()
            ->assertSee('Islamic Timeline');

        $this->actingAs($user)->get("/admin/timelines/{$timeline->getKey()}")
            ->assertOk()
            ->assertSee('Islamic Timeline')
            ->assertSee('Timeline')
            ->assertSee('Events');
    }

    public function test_authorized_users_can_create_edit_and_delete_timelines(): void
    {
        $user = $this->createCrudUser();
        $timeline = Timeline::factory()->create([
            'internal_name' => 'Original Timeline',
            'backward_compatibility' => 'tl-01',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CreateTimeline::class)
            ->fillForm([
                'internal_name' => 'New Timeline',
                'backward_compatibility' => 'tl-02',
            ])
            ->call('create')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('timelines', [
            'internal_name' => 'New Timeline',
            'backward_compatibility' => 'tl-02',
        ]);

        Livewire::actingAs($user)
            ->test(EditTimeline::class, [
                'record' => $timeline->getRouteKey(),
            ])
            ->assertFormSet([
                'internal_name' => 'Original Timeline',
                'backward_compatibility' => 'tl-01',
            ])
            ->fillForm([
                'internal_name' => 'Edited Timeline',
                'backward_compatibility' => 'tl-11',
            ])
            ->call('save')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('timelines', [
            'id' => $timeline->id,
            'internal_name' => 'Edited Timeline',
            'backward_compatibility' => 'tl-11',
        ]);

        Livewire::actingAs($user)
            ->test(ListTimeline::class)
            ->callTableAction(DeleteAction::class, $timeline)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('timelines', [
            'id' => $timeline->id,
        ]);
    }

    public function test_events_relation_manager_renders(): void
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

    public function test_events_relation_manager_can_create_event(): void
    {
        $user = $this->createCrudUser();
        $timeline = Timeline::factory()->create(['internal_name' => 'Test Timeline']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(EventsRelationManager::class, [
                'ownerRecord' => $timeline,
                'pageClass' => EditTimeline::class,
            ])
            ->mountTableAction('create')
            ->setTableActionData([
                'internal_name' => 'New Event',
                'year_from' => 700,
                'year_to' => 900,
                'display_order' => 1,
            ])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('timeline_events', [
            'timeline_id' => $timeline->id,
            'internal_name' => 'New Event',
            'year_from' => 700,
        ]);
    }

    public function test_events_relation_manager_can_delete_event(): void
    {
        $user = $this->createCrudUser();
        $timeline = Timeline::factory()->create(['internal_name' => 'Test Timeline']);
        $event = TimelineEvent::factory()->create([
            'timeline_id' => $timeline->id,
            'internal_name' => 'Event to delete',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(EventsRelationManager::class, [
                'ownerRecord' => $timeline,
                'pageClass' => EditTimeline::class,
            ])
            ->callTableAction(DeleteAction::class, $event)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('timeline_events', [
            'id' => $event->id,
        ]);
    }
}
