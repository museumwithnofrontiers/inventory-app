<?php

namespace Tests\Unit\Models;

use App\Enums\ItemType;
use App\Models\Country;
use App\Models\Item;
use App\Models\Partner;
use App\Models\Project;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Tests for Partner factory states and methods.
 */
class PartnerFactoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_factory_creates_valid_partner(): void
    {
        $partner = Partner::factory()->create();

        $this->assertInstanceOf(Partner::class, $partner);
        $this->assertNotEmpty($partner->id);
        $this->assertNotEmpty($partner->internal_name);
        $this->assertContains($partner->type, ['museum', 'institution', 'individual', 'school']);
    }

    public function test_factory_states_produce_correct_types(): void
    {
        $museum = Partner::factory()->Museum()->create();
        $institution = Partner::factory()->Institution()->create();
        $individual = Partner::factory()->Individual()->create();

        $this->assertEquals('museum', $museum->type);
        $this->assertEquals('institution', $institution->type);
        $this->assertEquals('individual', $individual->type);
    }

    public function test_factory_with_country_creates_country_relationship(): void
    {
        $partner = Partner::factory()->withCountry()->create();

        $this->assertNotNull($partner->country_id);
        $this->assertInstanceOf(Country::class, $partner->country);
    }

    public function test_factory_with_gps_sets_coordinates(): void
    {
        $partner = Partner::factory()->withGPS()->create();

        $this->assertNotNull($partner->latitude);
        $this->assertNotNull($partner->longitude);
        $this->assertNotNull($partner->map_zoom);
        $this->assertGreaterThanOrEqual(14, $partner->map_zoom);
        $this->assertLessThanOrEqual(18, $partner->map_zoom);
    }

    public function test_factory_with_project_creates_project_relationship(): void
    {
        $partner = Partner::factory()->withProject()->create();

        $this->assertNotNull($partner->project_id);
        $this->assertInstanceOf(Project::class, $partner->project);
    }

    public function test_factory_with_monument_creates_monument_relationship(): void
    {
        $partner = Partner::factory()->withMonument()->create();

        $this->assertNotNull($partner->monument_item_id);
        $this->assertInstanceOf(Item::class, $partner->monumentItem);
        $this->assertEquals(ItemType::MONUMENT, $partner->monumentItem->type);
    }
}
