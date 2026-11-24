<?php

namespace Tests\Filament\RelationManagers;

use Filament\Actions\CreateAction;
use Filament\Actions\EditAction;
use Filament\Actions\DeleteAction;
use App\Filament\Resources\ProjectResource\Pages\ViewProject;
use App\Filament\Resources\ProjectResource\RelationManagers\TranslationsRelationManager;
use App\Models\Language;
use App\Models\Project;
use App\Models\ProjectTranslation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * A project's name in each language, edited on the Project page.
 */
class ProjectTranslationsRelationManagerTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_crud_user_adds_edits_and_deletes_a_name(): void
    {
        $user = $this->createCrudUser();
        $english = $this->english();
        $project = Project::factory()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(TranslationsRelationManager::class, ['ownerRecord' => $project, 'pageClass' => ViewProject::class])
            ->callTableAction(CreateAction::class, data: [
                'language_id' => $english->id,
                'name' => 'Water in Islam',
            ])
            ->assertHasNoTableActionErrors();

        $translation = ProjectTranslation::query()->where('project_id', $project->id)->firstOrFail();
        $this->assertSame('Water in Islam', $translation->name);
        $this->assertSame('eng', $translation->language_id);

        Livewire::actingAs($user)
            ->test(TranslationsRelationManager::class, ['ownerRecord' => $project, 'pageClass' => ViewProject::class])
            ->callTableAction(EditAction::class, $translation, data: ['name' => 'Water in the Islamic world'])
            ->assertHasNoTableActionErrors();

        $this->assertSame('Water in the Islamic world', $translation->refresh()->name);

        Livewire::actingAs($user)
            ->test(TranslationsRelationManager::class, ['ownerRecord' => $project, 'pageClass' => ViewProject::class])
            ->callTableAction(DeleteAction::class, $translation)
            ->assertHasNoTableActionErrors();

        $this->assertModelMissing($translation);
    }

    public function test_a_name_is_required(): void
    {
        $english = $this->english();
        $project = Project::factory()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($this->createCrudUser())
            ->test(TranslationsRelationManager::class, ['ownerRecord' => $project, 'pageClass' => ViewProject::class])
            ->callTableAction(CreateAction::class, data: [
                'language_id' => $english->id,
                'name' => '',
            ])
            ->assertHasTableActionErrors(['name' => 'required']);
    }

    public function test_one_name_per_language(): void
    {
        $english = $this->english();
        $project = Project::factory()->create();
        ProjectTranslation::factory()->forLanguage($english->id)->create(['project_id' => $project->id]);

        $this->setCurrentPanel();

        Livewire::actingAs($this->createCrudUser())
            ->test(TranslationsRelationManager::class, ['ownerRecord' => $project, 'pageClass' => ViewProject::class])
            ->callTableAction(CreateAction::class, data: [
                'language_id' => $english->id,
                'name' => 'Again',
            ])
            ->assertHasTableActionErrors(['language_id' => 'unique']);
    }

    public function test_view_only_user_sees_the_names_but_cannot_change_them(): void
    {
        $english = $this->english();
        $project = Project::factory()->create();
        $translation = ProjectTranslation::factory()->forLanguage($english->id)->create(['project_id' => $project->id]);

        $this->setCurrentPanel();

        Livewire::actingAs($this->createViewOnlyUser())
            ->test(TranslationsRelationManager::class, ['ownerRecord' => $project, 'pageClass' => ViewProject::class])
            ->assertCanSeeTableRecords([$translation])
            ->assertTableActionHidden(CreateAction::class)
            ->assertTableActionHidden(EditAction::class, $translation)
            ->assertTableActionHidden(DeleteAction::class, $translation);
    }

    public function test_deleting_a_project_removes_its_names(): void
    {
        $project = Project::factory()->create();
        $translation = ProjectTranslation::factory()->forLanguage($this->english()->id)->create(['project_id' => $project->id]);

        $project->delete();

        $this->assertModelMissing($translation);
    }

    private function english(): Language
    {
        return Language::query()->find('eng')
            ?? Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
    }
}
