<?php

namespace Tests\Unit\Models;

use App\Enums\CollectionPurpose;
use App\Models\Collection;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
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
            ->withPurpose(CollectionPurpose::EXHIBITIONS_ROOT)
            ->create();

        $this->assertSame(CollectionPurpose::EXHIBITIONS_ROOT, $collection->purpose);
    }

    public function test_the_enum_holds_the_purposes_in_use(): void
    {
        $this->assertSame([
            'exhibitions-root',
            'artistic-introduction-root',
            'historical-profiles-root',
            'historical-background-root',
            'topics-root',
            'galleries-root',
            'travels-root',
            'explore-root',
            'explore-themes-root',
            'explore-countries-root',
            'explore-itineraries-root',
            'national-context',
        ], array_column(CollectionPurpose::cases(), 'value'));
    }

    public function test_only_root_purposes_are_section_anchors(): void
    {
        foreach (CollectionPurpose::cases() as $purpose) {
            $this->assertSame(str_ends_with($purpose->value, '-root'), $purpose->isSectionRoot(), $purpose->value);
        }
        $this->assertFalse(CollectionPurpose::NATIONAL_CONTEXT->isSectionRoot());
    }

    public function test_options_give_every_purpose_a_label(): void
    {
        $options = CollectionPurpose::options();

        $this->assertSame(array_column(CollectionPurpose::cases(), 'value'), array_keys($options));
        $this->assertSame('National context', $options['national-context']);
    }

    public function test_the_type_migration_stops_on_a_purpose_outside_the_enum(): void
    {
        $collection = Collection::factory()->create();
        DB::table('collections')->where('id', $collection->id)->update(['purpose' => 'not-a-purpose']);
        /** @var Migration $migration */
        $migration = require database_path('migrations/2026_11_25_100000_change_collections_type_to_string.php');

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('not-a-purpose');

        $migration->up();
    }

    public function test_purpose_is_stored_as_its_string_value_and_read_back_as_the_enum(): void
    {
        $collection = Collection::factory()->create();
        $collection->update(['purpose' => CollectionPurpose::TOPICS_ROOT->value]);

        $this->assertSame('topics-root', DB::table('collections')->where('id', $collection->id)->value('purpose'));
        $this->assertSame(CollectionPurpose::TOPICS_ROOT, $collection->fresh()?->purpose);
    }
}
