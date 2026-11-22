<?php

namespace Tests\Filament\Authorization;

use App\Enums\Permission;
use App\Models\Language;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LanguageResourceAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_users_without_reference_data_permission_cannot_see_language_navigation_or_pages(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo(Permission::ACCESS_ADMIN_PANEL->value);

        $dashboard = $this->actingAs($user)->get('/admin');

        $dashboard
            ->assertOk()
            ->assertDontSee('Languages');

        $this->actingAs($user)->get('/admin/languages')
            ->assertForbidden();
    }

    public function test_users_with_reference_data_permission_can_access_language_resource(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo([
            Permission::ACCESS_ADMIN_PANEL->value,
            ...Permission::dataOperations(),
        ]);

        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);

        $dashboard = $this->actingAs($user)->get('/admin');
        $index = $this->actingAs($user)->get('/admin/languages');
        $edit = $this->actingAs($user)->get("/admin/languages/{$language->getKey()}/edit");

        $dashboard
            ->assertOk()
            ->assertSee('Languages');

        $index
            ->assertOk()
            ->assertSee('English')
            ->assertSee('Set as default')
            ->assertSee('Create');

        $edit
            ->assertOk()
            ->assertSee('Delete');
    }
}
