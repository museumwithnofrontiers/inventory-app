<?php

namespace Tests\Filament\RelationManagers;

use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Resources\TimelineEventResource\Pages\EditTimelineEvent;
use App\Filament\Resources\TimelineEventResource\RelationManagers\TranslationsRelationManager;
use App\Models\TimelineEvent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

class TimelineEventTranslationsRelationManagerTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_timeline_event_translations_relation_manager_uses_authorizes_relation_mutations(): void
    {
        $this->assertTrue(
            in_array(AuthorizesRelationMutations::class, class_uses_recursive(TranslationsRelationManager::class), true),
            'TranslationsRelationManager must use AuthorizesRelationMutations trait.'
        );
    }

    public function test_manager_renders_for_crud_user(): void
    {
        $user = $this->createCrudUser();
        $timelineEvent = TimelineEvent::factory()->create();

        $this->setCurrentPanel();

        $component = Livewire::actingAs($user)->test(TranslationsRelationManager::class, [
            'ownerRecord' => $timelineEvent,
            'pageClass' => EditTimelineEvent::class,
        ]);

        $component->assertSuccessful();
    }

    public function test_manager_renders_for_view_only_user(): void
    {
        $user = $this->createViewOnlyUser();
        $timelineEvent = TimelineEvent::factory()->create();

        $this->setCurrentPanel();

        $component = Livewire::actingAs($user)->test(TranslationsRelationManager::class, [
            'ownerRecord' => $timelineEvent,
            'pageClass' => EditTimelineEvent::class,
        ]);

        $component->assertSuccessful();
    }
}
