<?php

namespace Tests\Filament\Authorization;

use App\Enums\Permission;
use App\Models\Context;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ContextResourceAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_users_without_reference_data_permission_cannot_see_context_navigation_or_pages(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo(Permission::ACCESS_ADMIN_PANEL->value);

        $dashboard = $this->actingAs($user)->get('/admin');

        $dashboard
            ->assertOk()
            ->assertDontSee('Contexts')
            ->assertDontSee('Shared Data');

        $this->actingAs($user)->get('/admin/contexts')
            ->assertForbidden();
    }

    public function test_users_with_reference_data_permission_can_access_context_resource(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo([
            Permission::ACCESS_ADMIN_PANEL->value,
            ...Permission::dataOperations(),
        ]);

        $context = Context::factory()->create(['internal_name' => 'Catalogue']);

        $dashboard = $this->actingAs($user)->get('/admin');
        $index = $this->actingAs($user)->get('/admin/contexts');
        $edit = $this->actingAs($user)->get("/admin/contexts/{$context->getKey()}/edit");

        $dashboard
            ->assertOk()
            ->assertSee('Shared Data')
            ->assertSee('Contexts');

        $index
            ->assertOk()
            ->assertSee('Catalogue')
            ->assertSee('Set as default')
            ->assertSee('Create');

        $edit
            ->assertOk()
            ->assertSee('Delete');
    }
}
