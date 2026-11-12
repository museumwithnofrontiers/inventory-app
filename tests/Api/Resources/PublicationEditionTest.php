<?php

namespace Tests\Api\Resources;

use App\Enums\OAuthScope;
use App\Enums\Permission;
use App\Models\Publication;
use App\Models\PublicationEdition;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Gate;
use Laravel\Passport\Passport;
use Tests\Api\Fixtures\DenyingPublicationPolicy;
use Tests\Api\Traits\AuthenticatesApiRequests;
use Tests\Api\Traits\TestsApiCrud;
use Tests\TestCase;

class PublicationEditionTest extends TestCase
{
    use AuthenticatesApiRequests;
    use RefreshDatabase;
    use TestsApiCrud;

    protected function getResourceName(): string
    {
        return 'publication-edition';
    }

    protected function getModelClass(): string
    {
        return PublicationEdition::class;
    }

    public function test_store_requires_the_mandatory_fields_and_a_known_format(): void
    {
        $this->postJson(route('publication-edition.store'), ['format' => 'paperback'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['publication_id', 'language_id', 'format']);
    }

    public function test_an_edition_is_visible_unless_told_otherwise_and_keeps_its_holding_area(): void
    {
        $data = PublicationEdition::factory()->make()->toArray();
        unset($data['visible']);
        $data['extra'] = [
            'shop_links' => [['name' => 'A shop', 'url' => 'https://shop.example.org/book']],
            'legacy_texts' => ['title' => 'A variant title'],
        ];

        $this->postJson(route('publication-edition.store'), $data)
            ->assertCreated()
            ->assertJsonPath('data.visible', true)
            ->assertJsonPath('data.extra.shop_links.0.name', 'A shop')
            ->assertJsonPath('data.extra.legacy_texts.title', 'A variant title');

        $hidden = PublicationEdition::factory()->hidden()->create();
        $this->getJson(route('publication-edition.show', $hidden))
            ->assertOk()
            ->assertJsonPath('data.visible', false);
    }

    public function test_an_edition_carries_no_commercial_field(): void
    {
        $edition = PublicationEdition::factory()->create();

        $response = $this->getJson(route('publication-edition.show', $edition))->assertOk();

        foreach (['price', 'discount', 'distributor', 'distributor_id', 'availability'] as $field) {
            $response->assertJsonMissingPath("data.{$field}");
        }
    }

    public function test_the_legacy_key_is_unique(): void
    {
        $existing = PublicationEdition::factory()->create(['backward_compatibility' => 'mwnf3:books:48:en:1:book:1']);
        $data = PublicationEdition::factory()->make(['backward_compatibility' => 'mwnf3:books:48:en:1:book:1'])->toArray();

        $this->postJson(route('publication-edition.store'), $data)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['backward_compatibility']);

        $this->patchJson(route('publication-edition.update', $existing), ['backward_compatibility' => 'mwnf3:books:48:en:1:book:1'])
            ->assertOk();
    }

    public function test_index_lists_the_editions_of_one_publication(): void
    {
        $publication = Publication::factory()->create();
        PublicationEdition::factory()->forPublication($publication)->count(2)->create();
        PublicationEdition::factory()->create();

        $this->getJson(route('publication-edition.index', ['publication_id' => $publication->id, 'include' => 'publication,language']))
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.publication.id', $publication->id);
    }

    public function test_every_change_is_an_update_of_the_publication(): void
    {
        $edition = PublicationEdition::factory()->create();
        $data = PublicationEdition::factory()->make(['publication_id' => $edition->publication_id])->toArray();

        // create-data and delete-data are not enough: an edition belongs to its publication
        $user = User::factory()->create();
        $user->givePermissionTo([Permission::VIEW_DATA->value, Permission::CREATE_DATA->value, Permission::DELETE_DATA->value]);
        Passport::actingAs($user, [OAuthScope::API_READ->value, OAuthScope::API_WRITE->value]);

        $this->postJson(route('publication-edition.store'), $data)->assertForbidden();
        $this->deleteJson(route('publication-edition.destroy', $edition))->assertForbidden();

        $user = User::factory()->create();
        $user->givePermissionTo([Permission::VIEW_DATA->value, Permission::UPDATE_DATA->value]);
        Passport::actingAs($user, [OAuthScope::API_READ->value, OAuthScope::API_WRITE->value]);

        $this->postJson(route('publication-edition.store'), $data)->assertCreated();
        $this->patchJson(route('publication-edition.update', $edition), ['isbn' => '978-0-00-000000-2'])->assertOk();
        $this->deleteJson(route('publication-edition.destroy', $edition))->assertNoContent();
    }

    public function test_the_publication_policy_decides(): void
    {
        $edition = PublicationEdition::factory()->create();
        $data = PublicationEdition::factory()->make(['publication_id' => $edition->publication_id])->toArray();
        Gate::policy(Publication::class, DenyingPublicationPolicy::class);

        $this->postJson(route('publication-edition.store'), $data)->assertForbidden();
        $this->patchJson(route('publication-edition.update', $edition), ['isbn' => '978-0-00-000000-2'])->assertForbidden();
        $this->deleteJson(route('publication-edition.destroy', $edition))->assertForbidden();
        $this->getJson(route('publication-edition.show', $edition))->assertOk();
    }
}
