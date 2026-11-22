<?php

namespace Tests\Filament\Authorization;

use App\Enums\Permission;
use App\Models\Author;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthorResourceAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_users_without_reference_data_permission_cannot_see_author_navigation_or_pages(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo(Permission::ACCESS_ADMIN_PANEL->value);

        $dashboard = $this->actingAs($user)->get('/admin');

        $dashboard
            ->assertOk()
            ->assertDontSee('Authors')
            ->assertDontSee('Shared Data');

        $this->actingAs($user)->get('/admin/authors')
            ->assertForbidden();
    }

    public function test_users_with_reference_data_permission_can_access_author_resource(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo([
            Permission::ACCESS_ADMIN_PANEL->value,
            ...Permission::dataOperations(),
        ]);

        $author = Author::factory()->create([
            'name' => 'Jane Doe',
            'internal_name' => 'jane-doe',
        ]);

        $dashboard = $this->actingAs($user)->get('/admin');
        $index = $this->actingAs($user)->get('/admin/authors');
        $edit = $this->actingAs($user)->get("/admin/authors/{$author->getKey()}/edit");

        $dashboard
            ->assertOk()
            ->assertSee('Shared Data')
            ->assertSee('Authors');

        $index
            ->assertOk()
            ->assertSee('jane-doe')
            ->assertSee('Create');

        $edit
            ->assertOk()
            ->assertSee('Delete');
    }
}
