<?php

namespace Tests\Api\Traits;

use App\Enums\OAuthScope;
use App\Enums\Permission;
use App\Models\User;
use Laravel\Passport\Passport;

/**
 * Provides authenticated API requests for tests
 */
trait AuthenticatesApiRequests
{
    protected function setUp(): void
    {
        parent::setUp();

        // Authenticate user with all permissions for API tests
        $user = User::factory()->create();
        $user->givePermissionTo(Permission::VIEW_DATA);
        $user->givePermissionTo(Permission::CREATE_DATA);
        $user->givePermissionTo(Permission::UPDATE_DATA);
        $user->givePermissionTo(Permission::DELETE_DATA);

        Passport::actingAs($user, [OAuthScope::API_READ->value, OAuthScope::API_WRITE->value]);
    }
}
