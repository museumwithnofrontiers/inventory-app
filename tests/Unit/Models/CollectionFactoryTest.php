<?php

namespace Tests\Unit\Models;

use App\Enums\CollectionType;
use App\Models\Collection;
use App\Models\Context;
use App\Models\Language;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Tests for Collection factory states and methods.
 */
class CollectionFactoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_factory_creates_valid_collection(): void
    {
        $collection = Collection::factory()->create();

        $this->assertInstanceOf(Collection::class, $collection);
        $this->assertNotEmpty($collection->id);
        $this->assertNotEmpty($collection->internal_name);
        $this->assertInstanceOf(CollectionType::class, $collection->type);
    }

    public function test_factory_states_produce_correct_types(): void
    {
        $collection = Collection::factory()->collection()->create();
        $exhibition = Collection::factory()->exhibition()->create();
        $gallery = Collection::factory()->gallery()->create();

        $this->assertSame(CollectionType::COLLECTION, $collection->type);
        $this->assertSame(CollectionType::EXHIBITION, $exhibition->type);
        $this->assertSame(CollectionType::GALLERY, $gallery->type);
    }

    public function test_factory_creates_with_context_and_language_relationships(): void
    {
        $collection = Collection::factory()->create();

        $this->assertNotNull($collection->context_id);
        $this->assertNotNull($collection->language_id);
        $this->assertInstanceOf(Context::class, $collection->context);
        $this->assertInstanceOf(Language::class, $collection->language);
    }
}
