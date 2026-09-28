<?php

namespace Tests\Unit\Models;

use App\Models\Collection;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CollectionPurposeTest extends TestCase
{
    use RefreshDatabase;

    public function test_factory_creates_collections_without_purpose_by_default(): void
    {
        $collection = Collection::factory()->create();

        $this->assertNull($collection->purpose);
    }

    public function test_factory_with_purpose_state_sets_purpose(): void
    {
        $collection = Collection::factory()
            ->withPurpose(Collection::PURPOSE_EXHIBITIONS_ROOT)
            ->create();

        $this->assertEquals('exhibitions-root', $collection->purpose);
    }

    public function test_purposes_vocabulary_contains_all_purpose_constants(): void
    {
        $this->assertContains(Collection::PURPOSE_EXHIBITIONS_ROOT, Collection::PURPOSES);
        $this->assertContains(Collection::PURPOSE_ARTISTIC_INTRODUCTION_ROOT, Collection::PURPOSES);
        $this->assertContains(Collection::PURPOSE_HISTORICAL_PROFILES_ROOT, Collection::PURPOSES);
        $this->assertContains(Collection::PURPOSE_HISTORICAL_BACKGROUND_ROOT, Collection::PURPOSES);
        $this->assertContains(Collection::PURPOSE_TOPICS_ROOT, Collection::PURPOSES);
        $this->assertContains(Collection::PURPOSE_GALLERIES_ROOT, Collection::PURPOSES);
        $this->assertContains(Collection::PURPOSE_TRAVELS_ROOT, Collection::PURPOSES);
        $this->assertContains(Collection::PURPOSE_EXPLORE_ROOT, Collection::PURPOSES);
        $this->assertContains(Collection::PURPOSE_EXPLORE_THEMES_ROOT, Collection::PURPOSES);
        $this->assertContains(Collection::PURPOSE_EXPLORE_COUNTRIES_ROOT, Collection::PURPOSES);
        $this->assertContains(Collection::PURPOSE_EXPLORE_ITINERARIES_ROOT, Collection::PURPOSES);
        $this->assertContains(Collection::PURPOSE_NATIONAL_CONTEXT, Collection::PURPOSES);
    }

    public function test_purpose_is_mass_assignable(): void
    {
        $collection = Collection::factory()->create();
        $collection->update(['purpose' => Collection::PURPOSE_TOPICS_ROOT]);

        $this->assertEquals('topics-root', $collection->fresh()->purpose);
    }
}
