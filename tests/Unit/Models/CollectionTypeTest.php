<?php

namespace Tests\Unit\Models;

use App\Enums\CollectionType;
use App\Models\Collection;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class CollectionTypeTest extends TestCase
{
    use RefreshDatabase;

    public function test_factory_creates_theme_type(): void
    {
        $collection = Collection::factory()->theme()->create();

        $this->assertSame(CollectionType::THEME, $collection->type);
    }

    public function test_factory_creates_exhibition_trail_type(): void
    {
        $collection = Collection::factory()->exhibitionTrail()->create();

        $this->assertSame(CollectionType::EXHIBITION_TRAIL, $collection->type);
    }

    public function test_factory_creates_itinerary_type(): void
    {
        $collection = Collection::factory()->itinerary()->create();

        $this->assertSame(CollectionType::ITINERARY, $collection->type);
    }

    public function test_factory_creates_location_type(): void
    {
        $collection = Collection::factory()->location()->create();

        $this->assertSame(CollectionType::LOCATION, $collection->type);
    }

    public function test_scope_themes_returns_only_theme_type(): void
    {
        Collection::factory()->theme()->create();
        Collection::factory()->collection()->create();
        Collection::factory()->exhibition()->create();

        $themes = Collection::themes()->get();

        $this->assertCount(1, $themes);
        $this->assertSame(CollectionType::THEME, $themes->first()?->type);
    }

    public function test_scope_exhibition_trails_returns_only_exhibition_trail_type(): void
    {
        Collection::factory()->exhibitionTrail()->create();
        Collection::factory()->collection()->create();

        $trails = Collection::exhibitionTrails()->get();

        $this->assertCount(1, $trails);
        $this->assertSame(CollectionType::EXHIBITION_TRAIL, $trails->first()?->type);
    }

    public function test_scope_itineraries_returns_only_itinerary_type(): void
    {
        Collection::factory()->itinerary()->create();
        Collection::factory()->collection()->create();

        $itineraries = Collection::itineraries()->get();

        $this->assertCount(1, $itineraries);
        $this->assertSame(CollectionType::ITINERARY, $itineraries->first()?->type);
    }

    public function test_scope_locations_returns_only_location_type(): void
    {
        Collection::factory()->location()->create();
        Collection::factory()->collection()->create();

        $locations = Collection::locations()->get();

        $this->assertCount(1, $locations);
        $this->assertSame(CollectionType::LOCATION, $locations->first()?->type);
    }

    public function test_the_enum_holds_the_types_in_use(): void
    {
        $this->assertSame(
            ['collection', 'exhibition', 'gallery', 'theme', 'exhibition trail', 'itinerary', 'location', 'subtheme', 'region'],
            array_column(CollectionType::cases(), 'value')
        );
    }

    public function test_options_give_every_type_a_label(): void
    {
        $options = CollectionType::options();

        $this->assertSame(array_column(CollectionType::cases(), 'value'), array_keys($options));
        $this->assertSame('Exhibition trail', $options['exhibition trail']);
    }

    public function test_type_is_stored_as_its_string_value_and_read_back_as_the_enum(): void
    {
        $collection = Collection::factory()->create(['type' => 'exhibition trail']);

        $this->assertSame('exhibition trail', DB::table('collections')->where('id', $collection->id)->value('type'));
        $this->assertSame(CollectionType::EXHIBITION_TRAIL, $collection->fresh()?->type);
    }

    public function test_type_defaults_to_collection_in_the_database(): void
    {
        $collection = Collection::factory()->create();
        DB::table('collections')->insert([
            'id' => '00000000-0000-0000-0000-000000002794',
            'internal_name' => 'default-type-2794',
            'language_id' => $collection->language_id,
            'context_id' => $collection->context_id,
        ]);

        $this->assertSame(CollectionType::COLLECTION, Collection::find('00000000-0000-0000-0000-000000002794')?->type);
    }
}
