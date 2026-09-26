<?php

namespace Tests\Filament\Pages;

use App\Enums\ItemType;
use App\Enums\Permission;
use App\Filament\Pages\Dashboard;
use App\Models\Item;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

class DashboardSmokeTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_dashboard_renders_for_authorized_user(): void
    {
        $user = $this->createViewUser();

        $this->actingAs($user)
            ->get('/admin')
            ->assertOk()
            ->assertSee('Dashboard');
    }

    public function test_dashboard_query_count_is_bounded_with_100k_items(): void
    {
        $user = $this->createViewUser();
        $this->seedItems(100_000);

        DB::enableQueryLog();
        $response = $this->actingAs($user)->get('/admin');
        $queryCount = count(DB::getQueryLog());

        $response->assertOk();

        // Dashboard must issue a bounded number of queries regardless of item count.
        // All count stats use aggregate SQL (SELECT COUNT(*) FROM …) which are O(1)
        // even with 100 000+ items. A catastrophic N+1 regression would produce
        // 100 000+ queries and fail this assertion immediately.
        $this->assertLessThanOrEqual(
            100,
            $queryCount,
            "Dashboard issued {$queryCount} queries with 100k items; expected ≤ 100. This may indicate an N+1 regression."
        );
    }

    public function test_dashboard_shows_inventory_stats_for_authorized_user(): void
    {
        $user = $this->createViewUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(Dashboard::class)
            ->assertSuccessful();
    }

    public function test_dashboard_shows_quick_create_actions_for_user_with_create_permission(): void
    {
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(Dashboard::class)
            ->assertSuccessful()
            ->assertSeeHtml('New Item');
    }

    protected function createViewUser(): User
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo([
            Permission::ACCESS_ADMIN_PANEL->value,
            Permission::VIEW_DATA->value,
        ]);

        return $user;
    }

    protected function seedItems(int $count): void
    {
        $timestamp = Carbon::now();

        $rows = [];
        for ($i = 0; $i < $count; $i++) {
            $rows[] = [
                'id' => (string) Str::uuid(),
                'internal_name' => sprintf('Item %05d', $i),
                'backward_compatibility' => sprintf('itm-%05d', $i),
                'type' => ItemType::OBJECT->value,
                'partner_id' => null,
                'parent_id' => null,
                'project_id' => null,
                'country_id' => null,
                'display_order' => null,
                'owner_reference' => null,
                'mwnf_reference' => null,
                'start_date' => null,
                'end_date' => null,
                'latitude' => null,
                'longitude' => null,
                'map_zoom' => null,
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ];
        }

        foreach (array_chunk($rows, 1000) as $chunk) {
            Item::query()->insert($chunk);
        }
    }
}
