<?php

namespace Tests\Api\Traits;

use App\Enums\OAuthScope;
use App\Enums\Permission;
use App\Models\User;
use Laravel\Passport\Passport;
use Spatie\Permission\PermissionRegistrar;

/**
 * Trait for testing API permission enforcement
 *
 * Provides helper methods to test that routes properly enforce permissions
 */
trait TestsApiPermissions
{
    /**
     * Create a user without any permissions
     */
    protected function createUserWithoutPermissions(): User
    {
        return User::factory()->create();
    }

    /**
     * Create a user with specific permission
     */
    protected function createUserWithPermission(Permission $permission): User
    {
        $user = User::factory()->create();
        $user->givePermissionTo($permission);

        // Clear permission cache
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        return $user;
    }

    /**
     * Create a user with multiple permissions
     */
    protected function createUserWithPermissions(array $permissions): User
    {
        $user = User::factory()->create();

        foreach ($permissions as $permission) {
            $user->givePermissionTo($permission);
        }

        // Clear permission cache
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        return $user;
    }

    /**
     * Assert that a route requires a specific permission
     */
    protected function assertRouteRequiresPermission(
        string $method,
        string $route,
        Permission $requiredPermission,
        array $routeParams = [],
        array $data = []
    ): void {
        // Generate minimal data for POST/PATCH requests if not provided
        if (empty($data) && in_array(strtoupper($method), ['POST', 'PATCH', 'PUT'])) {
            $data = ['_placeholder' => 'test'];
        }

        // Test 1: User without permission gets 403
        $userWithoutPermission = $this->createUserWithoutPermissions();
        Passport::actingAs($userWithoutPermission, [OAuthScope::API_READ->value, OAuthScope::API_WRITE->value]);

        $response = $this->{strtolower($method).'Json'}(route($route, $routeParams), $data);
        $response->assertForbidden();

        // Test 2: User with permission is allowed (may fail for other reasons, but not 403)
        $userWithPermission = $this->createUserWithPermission($requiredPermission);
        Passport::actingAs($userWithPermission, [OAuthScope::API_READ->value, OAuthScope::API_WRITE->value]);

        $response = $this->{strtolower($method).'Json'}(route($route, $routeParams), $data);

        // For file responses (download/view), we can't call status() on BinaryFileResponse
        // Just verify it's not a TestResponse with 403
        if (method_exists($response, 'status')) {
            $this->assertNotEquals(403, $response->status(),
                "Route should not return 403 when user has {$requiredPermission->value} permission");
        }
        // If it's a BinaryFileResponse, the permission check passed (no 403 thrown)
    }

    /**
     * Get route parameters for model-based routes
     */
    protected function getRouteParams(?string $modelClass): array
    {
        if (! $modelClass) {
            return [];
        }

        return [$modelClass::factory()->create()];
    }
}
