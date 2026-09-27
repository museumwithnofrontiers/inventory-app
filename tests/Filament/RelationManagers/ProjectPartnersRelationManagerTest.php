<?php

namespace Tests\Filament\RelationManagers;

use App\Filament\Resources\PartnerResource\Pages\CreatePartner;
use App\Filament\Resources\ProjectResource\Pages\ViewProject;
use App\Filament\Resources\ProjectResource\RelationManagers\PartnersRelationManager;
use App\Models\Partner;
use App\Models\Project;
use Filament\Actions\MountableAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Features\SupportTesting\Testable;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * M7 story A5.3 (epic #1876): the has-many convention on a project's partners
 * (App\Filament\Resources\ProjectResource\RelationManagers\PartnersRelationManager).
 * Mounted on ViewProject — that's where users land on a Project and where
 * every action here must work per AuthorizesRelationMutations (A0.1), which
 * also makes the manager editable on the resource's View page.
 */
class ProjectPartnersRelationManagerTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    // ── Header: Create ──────────────────────────────────────────────────────

    public function test_create_action_url_carries_the_project_id(): void
    {
        $user = $this->createCrudUser();
        $project = Project::factory()->create(['internal_name' => 'The project']);

        $this->setCurrentPanel();

        $component = Livewire::actingAs($user)->test(PartnersRelationManager::class, [
            'ownerRecord' => $project,
            'pageClass' => ViewProject::class,
        ]);

        $create = $this->headerAction($component, 'create');

        $this->assertStringContainsString('/admin/partners/create', (string) $create->getUrl());
        $this->assertStringContainsString("project_id={$project->id}", (string) $create->getUrl());
    }

    /**
     * The Create page the header action navigates to actually shows the
     * project once landed on, via CreatePartner's own
     * PrefillsCreateFormFromQuery wiring
     * (App\Filament\Resources\PartnerResource\Pages\CreatePartner).
     */
    public function test_prefilled_create_page_shows_the_project(): void
    {
        $user = $this->createCrudUser();
        $project = Project::factory()->create(['internal_name' => 'The project']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->withQueryParams(['project_id' => $project->id])
            ->test(CreatePartner::class)
            ->assertFormSet(['project_id' => $project->id]);
    }

    // ── Header: Attach existing ──────────────────────────────────────────────

    public function test_associate_action_sets_project_id_on_the_attached_partner(): void
    {
        $user = $this->createCrudUser();
        $project = Project::factory()->create();
        $target = Partner::factory()->create(['internal_name' => 'soon-to-be-project-partner']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(PartnersRelationManager::class, [
                'ownerRecord' => $project,
                'pageClass' => ViewProject::class,
            ])
            ->callTableAction('associate', data: ['recordId' => $target->id])
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('partners', [
            'id' => $target->id,
            'project_id' => $project->id,
        ]);
    }

    // ── Row: Detach / Delete ─────────────────────────────────────────────────

    public function test_dissociate_clears_project_id_without_deleting_the_record(): void
    {
        $user = $this->createCrudUser();
        $project = Project::factory()->create();
        $partner = Partner::factory()->create(['internal_name' => 'project-partner', 'project_id' => $project->id]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(PartnersRelationManager::class, [
                'ownerRecord' => $project,
                'pageClass' => ViewProject::class,
            ])
            ->callTableAction('dissociate', $partner)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('partners', [
            'id' => $partner->id,
            'project_id' => null,
        ]);
    }

    public function test_delete_action_removes_the_partner(): void
    {
        $user = $this->createCrudUser();
        $project = Project::factory()->create();
        $partner = Partner::factory()->create(['internal_name' => 'project-partner', 'project_id' => $project->id]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(PartnersRelationManager::class, [
                'ownerRecord' => $project,
                'pageClass' => ViewProject::class,
            ])
            ->callTableAction('delete', $partner)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('partners', ['id' => $partner->id]);
    }

    // ── Authorization: view-only user sees no mutating action ──────────────

    public function test_view_only_user_sees_no_mutating_action(): void
    {
        $viewer = $this->createViewOnlyUser();
        $project = Project::factory()->create();
        $partner = Partner::factory()->create(['internal_name' => 'project-partner', 'project_id' => $project->id]);

        $this->setCurrentPanel();

        Livewire::actingAs($viewer)
            ->test(PartnersRelationManager::class, [
                'ownerRecord' => $project,
                'pageClass' => ViewProject::class,
            ])
            ->assertTableActionHidden('create')
            ->assertTableActionHidden('associate')
            ->assertTableActionHidden('edit', $partner)
            ->assertTableActionHidden('dissociate', $partner)
            ->assertTableActionHidden('delete', $partner)
            ->assertTableBulkActionHidden('dissociate');
    }

    public function test_crud_user_keeps_every_mutating_action(): void
    {
        $user = $this->createCrudUser();
        $project = Project::factory()->create();
        $partner = Partner::factory()->create(['internal_name' => 'project-partner', 'project_id' => $project->id]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(PartnersRelationManager::class, [
                'ownerRecord' => $project,
                'pageClass' => ViewProject::class,
            ])
            ->assertTableActionVisible('create')
            ->assertTableActionVisible('associate')
            ->assertTableActionVisible('edit', $partner)
            ->assertTableActionVisible('dissociate', $partner)
            ->assertTableActionVisible('delete', $partner)
            ->assertTableBulkActionVisible('dissociate');
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
}
