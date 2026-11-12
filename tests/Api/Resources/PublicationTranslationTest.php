<?php

namespace Tests\Api\Resources;

use App\Enums\OAuthScope;
use App\Enums\Permission;
use App\Models\Context;
use App\Models\Language;
use App\Models\Publication;
use App\Models\PublicationTranslation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Passport\Passport;
use Tests\Api\Traits\AuthenticatesApiRequests;
use Tests\Api\Traits\TestsApiCrud;
use Tests\TestCase;

class PublicationTranslationTest extends TestCase
{
    use AuthenticatesApiRequests;
    use RefreshDatabase;
    use TestsApiCrud;

    protected function getResourceName(): string
    {
        return 'publication-translation';
    }

    protected function getModelClass(): string
    {
        return PublicationTranslation::class;
    }

    public function test_store_requires_the_mandatory_fields(): void
    {
        $this->postJson(route('publication-translation.store'), [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['publication_id', 'language_id', 'context_id', 'title']);
    }

    public function test_one_translation_per_publication_language_and_context(): void
    {
        $existing = PublicationTranslation::factory()->create();

        $this->postJson(route('publication-translation.store'), [
            'publication_id' => $existing->publication_id,
            'language_id' => $existing->language_id,
            'context_id' => $existing->context_id,
            'title' => 'A second English text',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['language_id']);

        // Another context is another translation
        $this->postJson(route('publication-translation.store'), [
            'publication_id' => $existing->publication_id,
            'language_id' => $existing->language_id,
            'context_id' => Context::factory()->create()->id,
            'title' => 'The same language, another context',
        ])->assertCreated();

        // A translation keeps its own language and context on update
        $this->patchJson(route('publication-translation.update', $existing), [
            'language_id' => $existing->language_id,
            'title' => 'Renamed',
        ])->assertOk()
            ->assertJsonPath('data.title', 'Renamed');
    }

    public function test_the_credit_lines_are_kept_as_printed(): void
    {
        $publication = Publication::factory()->create();
        $language = Language::factory()->create();
        $context = Context::factory()->create();

        $this->postJson(route('publication-translation.store'), [
            'publication_id' => $publication->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'title' => 'Islamic Art in the Mediterranean',
            'subtitle' => 'Jordan',
            'author_credit' => 'Ed. by A. Author; texts by B. Writer',
            'photography_credit' => 'C. Photographer',
            'coordination_credit' => 'D. Coordinator',
        ])->assertCreated()
            ->assertJsonPath('data.author_credit', 'Ed. by A. Author; texts by B. Writer')
            ->assertJsonPath('data.photography_credit', 'C. Photographer')
            ->assertJsonPath('data.coordination_credit', 'D. Coordinator');
    }

    public function test_index_filters_by_publication_and_includes_it(): void
    {
        $publication = Publication::factory()->create();
        PublicationTranslation::factory()->forPublication($publication)->count(2)->create();
        PublicationTranslation::factory()->create();

        $this->getJson(route('publication-translation.index', ['publication_id' => $publication->id, 'include' => 'publication,language,context']))
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.publication.id', $publication->id);
    }

    public function test_each_operation_needs_its_permission(): void
    {
        $translation = PublicationTranslation::factory()->create();

        $user = User::factory()->create();
        $user->givePermissionTo(Permission::VIEW_DATA->value);
        Passport::actingAs($user, [OAuthScope::API_READ->value, OAuthScope::API_WRITE->value]);

        $this->getJson(route('publication-translation.show', $translation))->assertOk();
        $this->patchJson(route('publication-translation.update', $translation), ['title' => 'Renamed'])->assertForbidden();
        $this->deleteJson(route('publication-translation.destroy', $translation))->assertForbidden();
    }
}
