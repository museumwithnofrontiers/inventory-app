<?php

namespace Tests\Api\User;

use App\Enums\Permission;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class PermissionsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Permissions are already created by TestCase::ensurePermissionsExist()
        // No need to create them again here
    }

    /**
     * Test that authenticated users can retrieve their own permissions.
     */
    public function test_authenticated_user_can_get_their_permissions(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo([
            Permission::VIEW_DATA->value,
            Permission::CREATE_DATA->value,
        ]);

        $response = $this->actingAs($user, 'api')->getJson(route('user.permissions'));

        $response->assertOk()
            ->assertJsonStructure(['data' => ['permissions']])
            ->assertJson([
                'data' => [
                    'permissions' => [
                        Permission::VIEW_DATA->value,
                        Permission::CREATE_DATA->value,
                    ],
                ],
            ]);
    }

    /**
     * Test that user with no permissions gets empty array.
     */
    public function test_user_with_no_permissions_gets_empty_array(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'api')->getJson(route('user.permissions'));

        $response->assertOk()
            ->assertJson(['data' => []]);
    }

    /**
     * Test that permissions from roles are included.
     */
    public function test_permissions_from_roles_are_included(): void
    {
        // Create role with permissions
        $role = Role::create(['name' => 'Test Role']);
        $role->givePermissionTo([
            Permission::VIEW_DATA->value,
            Permission::MANAGE_USERS->value,
        ]);

        $user = User::factory()->create();
        $user->assignRole($role);

        $response = $this->actingAs($user, 'api')->getJson(route('user.permissions'));

        $response->assertOk()
            ->assertJsonCount(2, 'data.permissions')
            ->assertJsonFragment([
                'permissions' => [
                    Permission::VIEW_DATA->value,
                    Permission::MANAGE_USERS->value,
                ],
            ]);
    }

    /**
     * Test that direct permissions and role permissions are combined.
     */
    public function test_direct_and_role_permissions_are_combined(): void
    {
        // Create role with permissions
        $role = Role::create(['name' => 'Test Role']);
        $role->givePermissionTo(Permission::VIEW_DATA->value);

        $user = User::factory()->create();
        $user->assignRole($role);
        $user->givePermissionTo(Permission::CREATE_DATA->value);

        $response = $this->actingAs($user, 'api')->getJson(route('user.permissions'));

        $response->assertOk()
            ->assertJsonCount(2, 'data.permissions');

        $permissions = $response->json('data.permissions');
        $this->assertContains(Permission::VIEW_DATA->value, $permissions);
        $this->assertContains(Permission::CREATE_DATA->value, $permissions);
    }

    /**
     * Test that unauthenticated users cannot access the endpoint.
     */
    public function test_unauthenticated_user_cannot_access_permissions(): void
    {
        $response = $this->getJson(route('user.permissions'));

        $response->assertUnauthorized();
    }

    /**
     * Test that duplicate permissions are not returned.
     */
    public function test_duplicate_permissions_are_not_returned(): void
    {
        // Create two roles with same permission
        $role1 = Role::create(['name' => 'Role 1']);
        $role1->givePermissionTo(Permission::VIEW_DATA->value);

        $role2 = Role::create(['name' => 'Role 2']);
        $role2->givePermissionTo(Permission::VIEW_DATA->value);

        $user = User::factory()->create();
        $user->assignRole([$role1, $role2]);
        $user->givePermissionTo(Permission::VIEW_DATA->value); // Direct assignment too

        $response = $this->actingAs($user, 'api')->getJson(route('user.permissions'));

        $response->assertOk();
        $permissions = $response->json('data.permissions');

        // Should only have one instance of VIEW_DATA
        $this->assertEquals(1, count($permissions));
        $this->assertContains(Permission::VIEW_DATA->value, $permissions);
    }

    /**
     * Test that only permission names are returned (not full objects).
     */
    public function test_only_permission_names_are_returned(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo(Permission::VIEW_DATA->value);

        $response = $this->actingAs($user, 'api')->getJson(route('user.permissions'));

        $response->assertOk();
        $permissions = $response->json('data.permissions');

        // Should be array of strings
        $this->assertIsArray($permissions);
        foreach ($permissions as $permission) {
            $this->assertIsString($permission);
        }
    }

    /**
     * Test that response format is consistent (data wrapper).
     */
    public function test_response_format_has_data_wrapper(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'api')->getJson(route('user.permissions'));

        $response->assertOk()
            ->assertJsonStructure(['data']);
    }
}
