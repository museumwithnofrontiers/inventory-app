<?php

namespace Tests\Filament\Authorization;

use App\Enums\Permission;
use App\Models\Tag;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TagResourceAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_users_without_reference_data_permission_cannot_see_tag_navigation_or_pages(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo(Permission::ACCESS_ADMIN_PANEL->value);

        $dashboard = $this->actingAs($user)->get('/admin');

        $dashboard
            ->assertOk()
            ->assertDontSee('Tags')
            ->assertDontSee('Shared Data');

        $this->actingAs($user)->get('/admin/tags')
            ->assertForbidden();
    }

    public function test_users_with_reference_data_permission_can_access_tag_resource(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo([
            Permission::ACCESS_ADMIN_PANEL->value,
            ...Permission::dataOperations(),
        ]);

        $tag = Tag::factory()->keyword()->create([
            'internal_name' => 'woodwork',
            'description' => 'Woodwork',
        ]);

        $dashboard = $this->actingAs($user)->get('/admin');
        $index = $this->actingAs($user)->get('/admin/tags');
        $edit = $this->actingAs($user)->get("/admin/tags/{$tag->getKey()}/edit");

        $dashboard
            ->assertOk()
            ->assertSee('Shared Data')
            ->assertSee('Tags');

        $index
            ->assertOk()
            ->assertSee('Woodwork')
            ->assertSee('Create');

        $edit
            ->assertOk()
            ->assertSee('Delete');
    }
}
