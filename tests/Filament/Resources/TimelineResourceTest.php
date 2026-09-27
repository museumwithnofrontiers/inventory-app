<?php

namespace Tests\Filament\Resources;

use App\Filament\Resources\TimelineResource\Pages\CreateTimeline;
use App\Filament\Resources\TimelineResource\Pages\EditTimeline;
use App\Filament\Resources\TimelineResource\Pages\ListTimeline;
use App\Models\Timeline;
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
}
