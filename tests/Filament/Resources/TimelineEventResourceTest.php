<?php

namespace Tests\Filament\Resources;

use App\Filament\Resources\TimelineEventResource\Pages\CreateTimelineEvent;
use App\Filament\Resources\TimelineEventResource\Pages\EditTimelineEvent;
use App\Filament\Resources\TimelineEventResource\Pages\ListTimelineEvent;
use App\Filament\Resources\TimelineEventResource\Pages\ViewTimelineEvent;
use App\Filament\Resources\TimelineEventResource\RelationManagers\ImagesRelationManager;
use App\Filament\Resources\TimelineEventResource\RelationManagers\ItemsRelationManager;
use App\Filament\Resources\TimelineEventResource\RelationManagers\TranslationsRelationManager;
use App\Models\Item;
use App\Models\Language;
use App\Models\Timeline;
use App\Models\TimelineEvent;
use App\Models\TimelineEventImage;
use Filament\Tables\Actions\DeleteAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

class TimelineEventResourceTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_authorized_users_can_render_all_timeline_event_resource_pages(): void
    {
        $user = $this->createCrudUser();
        $timeline = Timeline::factory()->create(['internal_name' => 'Test Timeline']);
        $event = TimelineEvent::factory()->create([
            'timeline_id' => $timeline->id,
            'internal_name' => 'Medieval Period',
        ]);

        $this->actingAs($user)->get('/admin/timeline-events')
            ->assertOk()
            ->assertSee('Timeline Events');

        $this->actingAs($user)->get('/admin/timeline-events/create')
            ->assertOk()
            ->assertSee('Create');

        $this->actingAs($user)->get("/admin/timeline-events/{$event->getKey()}/edit")
            ->assertOk()
            ->assertSee('Medieval Period');

        $this->actingAs($user)->get("/admin/timeline-events/{$event->getKey()}")
            ->assertOk()
            ->assertSee('Medieval Period')
            ->assertSee('Timeline Event');
    }

    public function test_authorized_users_can_create_edit_and_delete_timeline_events(): void
    {
        $user = $this->createCrudUser();
        $timeline = Timeline::factory()->create(['internal_name' => 'Test Timeline']);
        $event = TimelineEvent::factory()->create([
            'timeline_id' => $timeline->id,
            'internal_name' => 'Original Event',
            'backward_compatibility' => 'evt-01',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CreateTimelineEvent::class)
            ->fillForm([
                'timeline_id' => $timeline->id,
                'internal_name' => 'New Event',
                'year_from' => 700,
                'year_to' => 900,
                'display_order' => 1,
            ])
            ->call('create')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('timeline_events', [
            'timeline_id' => $timeline->id,
            'internal_name' => 'New Event',
            'year_from' => 700,
        ]);

        Livewire::actingAs($user)
            ->test(EditTimelineEvent::class, [
                'record' => $event->getRouteKey(),
            ])
            ->assertFormSet([
                'internal_name' => 'Original Event',
                'backward_compatibility' => 'evt-01',
            ])
            ->fillForm([
                'internal_name' => 'Edited Event',
                'backward_compatibility' => 'evt-11',
            ])
            ->call('save')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('timeline_events', [
            'id' => $event->id,
            'internal_name' => 'Edited Event',
            'backward_compatibility' => 'evt-11',
        ]);

        Livewire::actingAs($user)
            ->test(ListTimelineEvent::class)
            ->callTableAction(DeleteAction::class, $event)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('timeline_events', [
            'id' => $event->id,
        ]);
    }

    public function test_translations_relation_manager_renders(): void
    {
        $user = $this->createCrudUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);
        $timeline = Timeline::factory()->create(['internal_name' => 'Test Timeline']);
        $event = TimelineEvent::factory()->create([
            'timeline_id' => $timeline->id,
            'internal_name' => 'Test Event',
        ]);
        $translation = $event->translations()->create([
            'language_id' => $language->id,
            'name' => 'English Name',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(TranslationsRelationManager::class, [
                'ownerRecord' => $event,
                'pageClass' => ViewTimelineEvent::class,
            ])
            ->assertCanSeeTableRecords([$translation]);
    }

    public function test_translations_relation_manager_can_create_translation(): void
    {
        $user = $this->createCrudUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);
        $timeline = Timeline::factory()->create(['internal_name' => 'Test Timeline']);
        $event = TimelineEvent::factory()->create([
            'timeline_id' => $timeline->id,
            'internal_name' => 'Test Event',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(TranslationsRelationManager::class, [
                'ownerRecord' => $event,
                'pageClass' => EditTimelineEvent::class,
            ])
            ->mountTableAction('create')
            ->setTableActionData([
                'language_id' => $language->id,
                'name' => 'English Translation',
                'description' => 'A translation description.',
            ])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('timeline_event_translations', [
            'timeline_event_id' => $event->id,
            'language_id' => $language->id,
            'name' => 'English Translation',
        ]);
    }

    public function test_items_relation_manager_renders(): void
    {
        $user = $this->createCrudUser();
        $timeline = Timeline::factory()->create(['internal_name' => 'Test Timeline']);
        $event = TimelineEvent::factory()->create([
            'timeline_id' => $timeline->id,
            'internal_name' => 'Test Event',
        ]);
        $item = Item::factory()->Object()->create(['internal_name' => 'Ancient Artifact']);
        $event->items()->attach($item->id);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ItemsRelationManager::class, [
                'ownerRecord' => $event,
                'pageClass' => ViewTimelineEvent::class,
            ])
            ->assertCanSeeTableRecords([$item]);
    }

    public function test_items_relation_manager_supports_attach_and_detach(): void
    {
        $user = $this->createCrudUser();
        $timeline = Timeline::factory()->create(['internal_name' => 'Test Timeline']);
        $event = TimelineEvent::factory()->create([
            'timeline_id' => $timeline->id,
            'internal_name' => 'Test Event',
        ]);
        $item = Item::factory()->Object()->create(['internal_name' => 'Ancient Artifact']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ItemsRelationManager::class, [
                'ownerRecord' => $event,
                'pageClass' => EditTimelineEvent::class,
            ])
            ->callTableAction('attach', data: ['recordId' => $item->id])
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('timeline_event_item', [
            'timeline_event_id' => $event->id,
            'item_id' => $item->id,
        ]);

        Livewire::actingAs($user)
            ->test(ItemsRelationManager::class, [
                'ownerRecord' => $event,
                'pageClass' => EditTimelineEvent::class,
            ])
            ->callTableAction('detach', $item)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('timeline_event_item', [
            'timeline_event_id' => $event->id,
            'item_id' => $item->id,
        ]);
    }

    public function test_images_relation_manager_renders(): void
    {
        $user = $this->createCrudUser();
        $timeline = Timeline::factory()->create(['internal_name' => 'Test Timeline']);
        $event = TimelineEvent::factory()->create([
            'timeline_id' => $timeline->id,
            'internal_name' => 'Test Event',
        ]);
        $image = TimelineEventImage::factory()->create([
            'timeline_event_id' => $event->id,
            'path' => 'test-image.jpg',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ImagesRelationManager::class, [
                'ownerRecord' => $event,
                'pageClass' => ViewTimelineEvent::class,
            ])
            ->assertCanSeeTableRecords([$image]);
    }

    public function test_images_detach_action_moves_image_to_available_pool(): void
    {
        Storage::fake('public');

        $picturesDir = trim(config('localstorage.pictures.directory'), '/');
        $picturesDisk = config('localstorage.pictures.disk');
        Storage::disk($picturesDisk)->put($picturesDir.'/detach-test.jpg', 'fake-jpeg-data');

        $user = $this->createCrudUser();
        $timeline = Timeline::factory()->create(['internal_name' => 'Test Timeline']);
        $event = TimelineEvent::factory()->create([
            'timeline_id' => $timeline->id,
            'internal_name' => 'Test Event',
        ]);
        $image = TimelineEventImage::factory()->create([
            'timeline_event_id' => $event->id,
            'path' => 'detach-test.jpg',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ImagesRelationManager::class, [
                'ownerRecord' => $event,
                'pageClass' => ViewTimelineEvent::class,
            ])
            ->callTableAction('detach', $image)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('timeline_event_images', [
            'id' => $image->id,
        ]);

        $this->assertDatabaseHas('available_images', [
            'id' => $image->id,
        ]);
    }

    public function test_images_view_action_url_points_to_admin_route(): void
    {
        $user = $this->createCrudUser();
        $timeline = Timeline::factory()->create(['internal_name' => 'Test Timeline']);
        $event = TimelineEvent::factory()->create([
            'timeline_id' => $timeline->id,
            'internal_name' => 'Test Event',
        ]);
        $image = TimelineEventImage::factory()->create([
            'timeline_event_id' => $event->id,
            'path' => 'route-test.jpg',
        ]);

        $expectedUrl = route('filament.admin.timeline-event-image.view', [
            'timelineEvent' => $event->id,
            'timelineEventImage' => $image->id,
        ]);

        $this->assertStringContainsString('/admin/', $expectedUrl);
        $this->assertStringContainsString('timeline-events', $expectedUrl);
    }
}
