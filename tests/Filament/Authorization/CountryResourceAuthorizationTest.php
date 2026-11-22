<?php

namespace Tests\Filament\Authorization;

use App\Enums\Permission;
use App\Models\Country;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CountryResourceAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_users_without_reference_data_permission_cannot_see_country_navigation_or_pages(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo(Permission::ACCESS_ADMIN_PANEL->value);

        $dashboard = $this->actingAs($user)->get('/admin');

        $dashboard
            ->assertOk()
            ->assertDontSee('Countries');

        $this->actingAs($user)->get('/admin/countries')
            ->assertForbidden();
    }

    public function test_users_with_reference_data_permission_can_access_country_resource(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo([
            Permission::ACCESS_ADMIN_PANEL->value,
            ...Permission::dataOperations(),
        ]);

        $country = Country::factory()->create(['id' => 'jor', 'internal_name' => 'Jordan']);

        $dashboard = $this->actingAs($user)->get('/admin');
        $index = $this->actingAs($user)->get('/admin/countries');
        $edit = $this->actingAs($user)->get("/admin/countries/{$country->getKey()}/edit");

        $dashboard
            ->assertOk()
            ->assertSee('Countries');

        $index
            ->assertOk()
            ->assertSee('Jordan')
            ->assertSee('Create');

        $edit
            ->assertOk()
            ->assertSee('Delete');
    }
}
