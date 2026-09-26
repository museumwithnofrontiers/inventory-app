<?php

namespace Tests\Filament\Resources;

use App\Enums\ItemType;
use App\Models\Collection;
use App\Models\Item;
use App\Models\Partner;
use App\Models\Project;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

class LegacyLinksInfolistTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_item_view_shows_resolved_legacy_links(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->create([
            'type' => ItemType::OBJECT,
            'internal_name' => 'Perfume sprinkler',
            'backward_compatibility' => 'mwnf3:objects:ISL:eg:Mus01:1',
        ]);

        $this->actingAs($user)
            ->get("/admin/items/{$item->getRouteKey()}")
            ->assertOk()
            ->assertSee('Legacy links')
            ->assertSee('Legacy object page')
            ->assertSee('islamicart.museumwnf.org')
            ->assertSee('Legacy object back-office record')
            ->assertSee('virtual-office.museumwnf.org');
    }

    public function test_collection_view_shows_resolved_legacy_links(): void
    {
        $user = $this->createCrudUser();
        $collection = Collection::factory()->exhibitionTrail()->create([
            'internal_name' => 'Portugal trail',
            'backward_compatibility' => 'mwnf3_travels:trail:IAM:pt:1',
        ]);

        $this->actingAs($user)
            ->get("/admin/collections/{$collection->getRouteKey()}")
            ->assertOk()
            ->assertSee('Legacy links')
            ->assertSee('Travels trail page')
            ->assertSee('travels.museumwnf.org')
            ->assertSee('Travels trail back-office record')
            ->assertSee('virtual-office.museumwnf.org');
    }

    public function test_partner_view_shows_resolved_legacy_links(): void
    {
        $user = $this->createCrudUser();
        $project = Project::factory()->create(['backward_compatibility' => 'ISL']);
        $partner = Partner::factory()->Museum()->create([
            'internal_name' => 'Museum of Islamic Art',
            'backward_compatibility' => 'mwnf3:museums:Mus01:eg',
            'project_id' => $project->id,
        ]);

        $this->actingAs($user)
            ->get("/admin/partners/{$partner->getRouteKey()}")
            ->assertOk()
            ->assertSee('Legacy links')
            ->assertSee('Legacy partner page')
            ->assertSee('islamicart.museumwnf.org')
            ->assertSee('Legacy partner back-office record')
            ->assertSee('virtual-office.museumwnf.org');
    }

    public function test_unresolved_mapping_shows_diagnostic(): void
    {
        $user = $this->createCrudUser();
        $partner = Partner::factory()->Museum()->create([
            'internal_name' => 'Museum without project',
            'backward_compatibility' => 'mwnf3:museums:Mus01:eg',
        ]);

        $this->actingAs($user)
            ->get("/admin/partners/{$partner->getRouteKey()}")
            ->assertOk()
            ->assertSee('Legacy links')
            ->assertSee('Requires lookup')
            ->assertSee('The partner legacy URL needs a project code');
    }
}
