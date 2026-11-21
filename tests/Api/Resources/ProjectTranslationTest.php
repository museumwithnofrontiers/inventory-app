<?php

namespace Tests\Api\Resources;

use App\Models\Project;
use App\Models\ProjectTranslation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Api\Traits\AuthenticatesApiRequests;
use Tests\Api\Traits\TestsApiCrud;
use Tests\TestCase;

class ProjectTranslationTest extends TestCase
{
    use AuthenticatesApiRequests;
    use RefreshDatabase;
    use TestsApiCrud;

    protected function getResourceName(): string
    {
        return 'project-translation';
    }

    protected function getModelClass(): string
    {
        return ProjectTranslation::class;
    }

    public function test_store_refuses_a_second_name_in_the_same_language(): void
    {
        $existing = ProjectTranslation::factory()->create();

        $this->postJson(route('project-translation.store'), [
            'project_id' => $existing->project_id,
            'language_id' => $existing->language_id,
            'name' => 'Another name',
        ])->assertUnprocessable()->assertJsonValidationErrors(['project_id']);
    }

    public function test_project_includes_its_names(): void
    {
        $translation = ProjectTranslation::factory()->create(['name' => 'Discover Islamic Art']);

        $this->getJson(route('project.show', ['project' => $translation->project_id, 'include' => 'translations']))
            ->assertOk()
            ->assertJsonPath('data.translations.0.name', 'Discover Islamic Art')
            ->assertJsonPath('data.translations.0.language_id', $translation->language_id);
    }

    public function test_deleting_a_project_removes_its_names(): void
    {
        $translation = ProjectTranslation::factory()->create();

        Project::query()->whereKey($translation->project_id)->firstOrFail()->delete();

        $this->assertModelMissing($translation);
    }
}
