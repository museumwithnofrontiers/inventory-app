<?php

namespace Tests\Filament\RelationManagers;

use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Resources\ProjectResource\Pages\EditProject;
use App\Filament\Resources\ProjectResource\RelationManagers\CollectionsRelationManager;
use App\Models\Project;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

class ProjectCollectionsRelationManagerTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_project_collections_relation_manager_uses_authorizes_relation_mutations(): void
    {
        $this->assertTrue(
            in_array(AuthorizesRelationMutations::class, class_uses_recursive(CollectionsRelationManager::class), true),
            'CollectionsRelationManager must use AuthorizesRelationMutations trait.'
        );
    }

    public function test_manager_renders_for_view_only_user(): void
    {
        $user = $this->createViewOnlyUser();
        $project = Project::factory()->create();

        $this->setCurrentPanel();

        $component = Livewire::actingAs($user)->test(CollectionsRelationManager::class, [
            'ownerRecord' => $project,
            'pageClass' => EditProject::class,
        ]);

        $component->assertSuccessful();
    }
}
