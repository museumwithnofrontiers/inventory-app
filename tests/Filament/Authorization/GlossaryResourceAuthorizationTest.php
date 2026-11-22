<?php

namespace Tests\Filament\Authorization;

use App\Enums\Permission;
use App\Models\Glossary;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GlossaryResourceAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_users_without_reference_data_permission_cannot_see_glossary_navigation_or_pages(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo(Permission::ACCESS_ADMIN_PANEL->value);

        $dashboard = $this->actingAs($user)->get('/admin');

        $dashboard
            ->assertOk()
            ->assertDontSee('Glossaries')
            ->assertDontSee('Shared Data');

        $this->actingAs($user)->get('/admin/glossaries')
            ->assertForbidden();
    }

    public function test_users_with_reference_data_permission_can_access_glossary_resource(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo([
            Permission::ACCESS_ADMIN_PANEL->value,
            ...Permission::dataOperations(),
        ]);

        $glossary = Glossary::factory()->create(['internal_name' => 'Mashrabiya']);

        $dashboard = $this->actingAs($user)->get('/admin');
        $index = $this->actingAs($user)->get('/admin/glossaries');
        $edit = $this->actingAs($user)->get("/admin/glossaries/{$glossary->getKey()}/edit");

        $dashboard
            ->assertOk()
            ->assertSee('Shared Data')
            ->assertSee('Glossaries');

        $index
            ->assertOk()
            ->assertSee('Mashrabiya')
            ->assertSee('Create');

        $edit
            ->assertOk()
            ->assertSee('Translations')
            ->assertSee('Spellings');
    }
}
