<?php

namespace Tests\Api\Resources;

use App\Enums\ContributorCategory;
use App\Models\Collection;
use App\Models\Contributor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Api\Traits\AuthenticatesApiRequests;
use Tests\TestCase;

/**
 * The API accepts exactly ContributorCategory's values (#2795).
 */
class ContributorCategoryTest extends TestCase
{
    use AuthenticatesApiRequests;
    use RefreshDatabase;

    public function test_every_category_is_accepted_and_returned_as_its_value(): void
    {
        $collection = Collection::factory()->create();

        foreach (ContributorCategory::cases() as $category) {
            $this->postJson(route('contributor.store'), [
                'collection_id' => $collection->id,
                'category' => $category->value,
                'internal_name' => 'Contributor '.$category->value,
            ])
                ->assertCreated()
                ->assertJsonPath('data.category', $category->value);
        }
    }

    public function test_an_unknown_category_is_refused(): void
    {
        $collection = Collection::factory()->create();

        foreach (['travels_author', 'credits', 'cooperator', 'other_contributor'] as $old) {
            $this->postJson(route('contributor.store'), [
                'collection_id' => $collection->id,
                'category' => $old,
                'internal_name' => 'Contributor '.$old,
            ])
                ->assertUnprocessable()
                ->assertJsonValidationErrors(['category']);
        }
    }

    public function test_updating_to_an_unknown_category_is_refused(): void
    {
        $contributor = Contributor::factory()->create();

        $this->patchJson(route('contributor.update', $contributor), [
            'collection_id' => $contributor->collection_id,
            'category' => 'not-a-category',
            'internal_name' => $contributor->internal_name,
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['category']);
    }
}
