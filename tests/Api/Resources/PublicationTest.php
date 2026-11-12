<?php

namespace Tests\Api\Resources;

use App\Enums\OAuthScope;
use App\Enums\Permission;
use App\Models\Collection;
use App\Models\Country;
use App\Models\Item;
use App\Models\Language;
use App\Models\Project;
use App\Models\Publication;
use App\Models\PublicationEdition;
use App\Models\PublicationTranslation;
use App\Models\Tag;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Gate;
use Laravel\Passport\Passport;
use Tests\Api\Fixtures\DenyingPublicationPolicy;
use Tests\Api\Traits\AuthenticatesApiRequests;
use Tests\Api\Traits\TestsApiCrud;
use Tests\TestCase;

class PublicationTest extends TestCase
{
    use AuthenticatesApiRequests;
    use RefreshDatabase;
    use TestsApiCrud;

    protected function getResourceName(): string
    {
        return 'publication';
    }

    protected function getModelClass(): string
    {
        return Publication::class;
    }

    // ── Validation ───────────────────────────────────────────────────────

    public function test_store_requires_the_mandatory_fields(): void
    {
        $this->postJson(route('publication.store'), [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['internal_name', 'category', 'language_id']);
    }

    public function test_store_refuses_an_unknown_category_and_status(): void
    {
        $language = Language::factory()->create();

        $this->postJson(route('publication.store'), [
            'internal_name' => 'Guide',
            'category' => 'catalogue',
            'status' => 'withdrawn',
            'language_id' => $language->id,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['category', 'status']);
    }

    public function test_store_defaults_the_status_to_published(): void
    {
        $language = Language::factory()->create();

        $this->postJson(route('publication.store'), [
            'internal_name' => 'Architectural Guide Tunis',
            'category' => 'other',
            'language_id' => $language->id,
        ])->assertCreated()
            ->assertJsonPath('data.status', 'published')
            ->assertJsonPath('data.category', 'other');
    }

    public function test_the_legacy_key_is_unique(): void
    {
        $existing = Publication::factory()->create(['backward_compatibility' => 'mwnf3:bookbase:48']);
        $data = Publication::factory()->make(['backward_compatibility' => 'mwnf3:bookbase:48'])->toArray();

        $this->postJson(route('publication.store'), $data)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['backward_compatibility']);

        // Updating the record that holds the key keeps it
        $this->patchJson(route('publication.update', $existing), ['backward_compatibility' => 'mwnf3:bookbase:48'])
            ->assertOk();
    }

    public function test_store_refuses_unknown_project_country_and_language(): void
    {
        $this->postJson(route('publication.store'), [
            'internal_name' => 'Guide',
            'category' => 'gallery',
            'project_id' => '00000000-0000-0000-0000-000000000000',
            'country_id' => 'zzz',
            'language_id' => 'zzz',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['project_id', 'country_id', 'language_id']);
    }

    // ── Includes and pagination ──────────────────────────────────────────

    public function test_show_loads_the_allowed_includes(): void
    {
        $project = Project::factory()->create();
        $country = Country::factory()->create();
        $publication = Publication::factory()->forProject($project)->forCountry($country)->create();
        PublicationTranslation::factory()->forPublication($publication)->create();
        PublicationEdition::factory()->forPublication($publication)->create();
        $publication->tags()->attach(Tag::factory()->create());

        $this->getJson(route('publication.show', ['publication' => $publication, 'include' => 'project,country,language,translations,editions,tags']))
            ->assertOk()
            ->assertJsonPath('data.project.id', $project->id)
            ->assertJsonPath('data.country.id', $country->id)
            ->assertJsonPath('data.language.id', $publication->language_id)
            ->assertJsonCount(1, 'data.translations')
            ->assertJsonCount(1, 'data.editions')
            ->assertJsonCount(1, 'data.tags');
    }

    public function test_an_unknown_include_is_refused(): void
    {
        $publication = Publication::factory()->create();

        $this->getJson(route('publication.show', ['publication' => $publication, 'include' => 'partners']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['include']);
    }

    public function test_index_paginates(): void
    {
        Publication::factory()->count(5)->create();

        $this->getJson(route('publication.index', ['per_page' => 2, 'page' => 2]))
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.current_page', 2)
            ->assertJsonPath('meta.per_page', 2)
            ->assertJsonPath('meta.total', 5);
    }

    // ── Links to collections, items and tags ─────────────────────────────

    public function test_a_collection_is_attached_with_its_pivot_and_detached(): void
    {
        $publication = Publication::factory()->create();
        $collection = Collection::factory()->create();

        $this->postJson(route('publication.attachCollection', ['publication' => $publication, 'include' => 'collections']), [
            'collection_id' => $collection->id,
            'display_order' => 3,
            'extra' => ['ref_trail' => 'IAM_JO_1'],
        ])->assertOk()
            ->assertJsonCount(1, 'data.collections');

        $pivot = $publication->collections()->firstOrFail()->getRelation('pivot');
        $this->assertSame(3, $pivot->getAttribute('display_order'));
        $this->assertSame(['ref_trail' => 'IAM_JO_1'], $pivot->getAttribute('extra'));

        $this->deleteJson(route('publication.detachCollection', $publication), ['collection_id' => $collection->id])
            ->assertOk();

        $this->assertDatabaseMissing('publication_collection', ['publication_id' => $publication->id]);
    }

    public function test_an_item_is_attached_and_detached(): void
    {
        $publication = Publication::factory()->create();
        $item = Item::factory()->Object()->create();

        $this->postJson(route('publication.attachItem', ['publication' => $publication, 'include' => 'items']), [
            'item_id' => $item->id,
            'extra' => ['code' => 'IAM_JO_EN_001'],
        ])->assertOk()
            ->assertJsonPath('data.items.0.id', $item->id);

        // Attaching again only updates the pivot
        $this->postJson(route('publication.attachItem', $publication), ['item_id' => $item->id, 'display_order' => 2])
            ->assertOk();
        $this->assertSame(1, $publication->items()->count());

        $this->deleteJson(route('publication.detachItem', $publication), ['item_id' => $item->id])
            ->assertOk();

        $this->assertDatabaseMissing('publication_item', ['publication_id' => $publication->id]);
    }

    public function test_tags_are_attached_and_detached_one_or_several_at_a_time(): void
    {
        $publication = Publication::factory()->create();
        [$subject, $theme, $audience] = [
            Tag::factory()->create(['category' => 'subject']),
            Tag::factory()->create(['category' => 'theme']),
            Tag::factory()->create(['category' => 'audience']),
        ];

        $this->postJson(route('publication.attachTag', $publication), ['tag_id' => $subject->id])->assertOk();
        $this->postJson(route('publication.attachTags', ['publication' => $publication, 'include' => 'tags']), ['tag_ids' => [$subject->id, $theme->id, $audience->id]])
            ->assertOk()
            ->assertJsonCount(3, 'data.tags');

        $this->deleteJson(route('publication.detachTag', $publication), ['tag_id' => $subject->id])->assertOk();
        $this->assertSame(2, $publication->tags()->count());

        $this->deleteJson(route('publication.detachTags', $publication), ['tag_ids' => [$theme->id, $audience->id]])->assertOk();
        $this->assertSame(0, $publication->tags()->count());
    }

    public function test_attach_validates_the_related_record(): void
    {
        $publication = Publication::factory()->create();

        $this->postJson(route('publication.attachCollection', $publication), ['collection_id' => '00000000-0000-0000-0000-000000000000'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['collection_id']);
        $this->postJson(route('publication.attachItem', $publication), [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['item_id']);
        $this->postJson(route('publication.attachTags', $publication), ['tag_ids' => []])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['tag_ids']);
    }

    public function test_deleting_a_publication_removes_its_translations_editions_and_links(): void
    {
        $publication = Publication::factory()->create();
        PublicationTranslation::factory()->forPublication($publication)->create();
        PublicationEdition::factory()->forPublication($publication)->create();
        $publication->tags()->attach(Tag::factory()->create());
        $collection = Collection::factory()->create();
        $publication->collections()->attach($collection);

        $this->deleteJson(route('publication.destroy', $publication))->assertNoContent();

        $this->assertDatabaseMissing('publication_translations', ['publication_id' => $publication->id]);
        $this->assertDatabaseMissing('publication_editions', ['publication_id' => $publication->id]);
        $this->assertDatabaseMissing('publication_tag', ['publication_id' => $publication->id]);
        $this->assertDatabaseMissing('publication_collection', ['publication_id' => $publication->id]);
        $this->assertDatabaseHas('collections', ['id' => $collection->id]);
    }

    // ── Authorization ────────────────────────────────────────────────────

    public function test_each_operation_needs_its_permission(): void
    {
        $publication = Publication::factory()->create();
        $tag = Tag::factory()->create();

        $this->actingAsUserWith(Permission::CREATE_DATA, Permission::DELETE_DATA);
        $this->getJson(route('publication.index'))->assertForbidden();
        $this->patchJson(route('publication.update', $publication), ['internal_name' => 'Renamed'])->assertForbidden();
        $this->postJson(route('publication.attachTag', $publication), ['tag_id' => $tag->id])->assertForbidden();

        $this->actingAsUserWith(Permission::VIEW_DATA);
        $this->getJson(route('publication.index'))->assertOk();
        $this->postJson(route('publication.store'), [])->assertForbidden();
        $this->deleteJson(route('publication.destroy', $publication))->assertForbidden();

        $this->actingAsUserWith(Permission::UPDATE_DATA);
        $this->postJson(route('publication.attachTag', $publication), ['tag_id' => $tag->id])->assertOk();
        $this->deleteJson(route('publication.detachTag', $publication), ['tag_id' => $tag->id])->assertOk();
    }

    public function test_the_links_need_update_on_the_publication_through_its_policy(): void
    {
        $publication = Publication::factory()->create();
        $tag = Tag::factory()->create();
        $this->denyPublicationUpdates();

        $this->postJson(route('publication.attachTag', $publication), ['tag_id' => $tag->id])->assertForbidden();
        $this->postJson(route('publication.attachCollection', $publication), ['collection_id' => Collection::factory()->create()->id])->assertForbidden();
        $this->postJson(route('publication.attachItem', $publication), ['item_id' => Item::factory()->Object()->create()->id])->assertForbidden();
        $this->assertSame(0, $publication->tags()->count());
    }

    private function actingAsUserWith(Permission ...$permissions): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo(array_map(fn (Permission $permission): string => $permission->value, $permissions));
        Passport::actingAs($user, [OAuthScope::API_READ->value, OAuthScope::API_WRITE->value]);
    }

    private function denyPublicationUpdates(): void
    {
        Gate::policy(Publication::class, DenyingPublicationPolicy::class);
    }
}
