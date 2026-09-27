<?php

namespace Tests\Filament\RelationManagers;

use App\Filament\Resources\TimelineEventResource\Pages\ViewTimelineEvent;
use App\Filament\Resources\TimelineEventResource\RelationManagers\TranslationsRelationManager;
use App\Models\TimelineEvent;
use App\Models\TimelineEventTranslation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * Every mutation of a timeline event's translations needs `update` on the
 * event, which TimelineEventPolicy grants with `update-data`.
 */
class TimelineEventTranslationsRelationManagerTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_view_only_user_sees_no_mutating_actions(): void
    {
        $event = TimelineEvent::factory()->create();
        $translation = TimelineEventTranslation::factory()->create(['timeline_event_id' => $event->id]);
        $user = $this->createViewOnlyUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(TranslationsRelationManager::class, [
                'ownerRecord' => $event,
                'pageClass' => ViewTimelineEvent::class,
            ])
            ->assertTableActionHidden('create')
            ->assertTableActionHidden('edit', $translation->getKey())
            ->assertTableActionHidden('delete', $translation->getKey());
    }

    public function test_crud_user_keeps_every_mutating_action(): void
    {
        $event = TimelineEvent::factory()->create();
        $translation = TimelineEventTranslation::factory()->create(['timeline_event_id' => $event->id]);
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(TranslationsRelationManager::class, [
                'ownerRecord' => $event,
                'pageClass' => ViewTimelineEvent::class,
            ])
            ->assertTableActionVisible('create')
            ->assertTableActionVisible('edit', $translation->getKey())
            ->assertTableActionVisible('delete', $translation->getKey());
    }
}
