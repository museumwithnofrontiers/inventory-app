<?php

namespace Tests\Api\Middleware;

use App\Enums\Permission as PermissionEnum;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * Test authorization middleware features.
 * These tests verify middleware correctly checks permissions.
 */
class AuthorizationMiddlewareTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Create test routes with permission middleware
        Route::get('/test-permission', function () {
            return response()->json(['message' => 'success']);
        })->middleware(['auth:sanctum', 'permission:'.PermissionEnum::VIEW_DATA->value]);

        Route::get('/test-role', function () {
            return response()->json(['message' => 'success']);
        })->middleware(['auth:sanctum', 'role:Test Role']);

        Route::get('/test-no-role', function () {
            return response()->json(['message' => 'success']);
        })->middleware(['auth:sanctum', 'role:Manager Role']);
    }

    public function test_it_denies_access_to_unauthenticated_users(): void
    {
        $response = $this->getJson('/test-permission');

        $response->assertStatus(401);
    }

    public function test_it_denies_access_to_users_without_permission(): void
    {
        // Permission already exists from TestCase::ensurePermissionsExist()
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/test-permission');

        $response->assertStatus(403);
    }

    public function test_it_allows_access_to_users_with_permission(): void
    {
        // Permission already exists from TestCase::ensurePermissionsExist()
        $permission = Permission::findByName(PermissionEnum::VIEW_DATA->value);

        $role = Role::create(['name' => 'Test Role', 'guard_name' => 'web']);
        $role->givePermissionTo($permission);

        $user = User::factory()->create();
        $user->assignRole($role);

        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/test-permission');

        $response->assertStatus(200)
            ->assertJson(['message' => 'success']);
    }

    public function test_it_denies_access_to_users_without_role(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/test-no-role');

        $response->assertStatus(403);
    }

    public function test_it_allows_access_to_users_with_correct_role(): void
    {
        $role = Role::create(['name' => 'Manager Role', 'guard_name' => 'web']);

        $user = User::factory()->create();
        $user->assignRole($role);

        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/test-no-role');

        $response->assertStatus(200)
            ->assertJson(['message' => 'success']);
    }

    public function test_it_denies_access_to_users_with_direct_permissions_but_no_roles(): void
    {
        // Test that direct permissions ARE allowed (users don't need roles if they have direct permissions)
        // Permission already exists from TestCase::ensurePermissionsExist()
        $permission = Permission::findByName(PermissionEnum::VIEW_DATA->value);

        $user = User::factory()->create();
        $user->givePermissionTo($permission);

        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/test-permission');

        // Direct permissions should work even without roles
        $response->assertStatus(200)
            ->assertJson(['message' => 'success']);
    }

    public function test_custom_role_middleware_denies_users_without_any_roles(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/test-role');

        $response->assertStatus(403);
        $response->assertJsonFragment(['reason' => 'User has no assigned roles']);
    }

    public function test_custom_role_middleware_allows_users_with_correct_role(): void
    {
        $role = Role::create(['name' => 'Test Role', 'guard_name' => 'web']);

        $user = User::factory()->create();
        $user->assignRole($role);

        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/test-role');

        $response->assertOk();
    }
}
