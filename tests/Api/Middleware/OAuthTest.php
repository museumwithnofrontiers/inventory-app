<?php

namespace Tests\Api\Middleware;

use App\Enums\OAuthScope;
use App\Enums\Permission;
use App\Models\User;
use App\Support\OAuth\AuthorizationCodeClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Laravel\Passport\ClientRepository;
use Laravel\Passport\Passport;
use Tests\TestCase;

/**
 * The API authenticates with OAuth (Passport) only: a token needs the right
 * scope, the user still needs the permission, and the authorization-code
 * grant is the only way to obtain a token.
 */
class OAuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_request_without_a_token_is_unauthenticated(): void
    {
        $this->getJson(route('item.index'))->assertUnauthorized();
    }

    public function test_a_panel_session_does_not_authenticate_the_api(): void
    {
        $this->actingAs($this->userWith(Permission::VIEW_DATA), 'web');

        $this->getJson(route('item.index'))->assertUnauthorized();
        $this->getJson(route('user.permissions'))->assertUnauthorized();
    }

    public function test_a_token_without_the_read_scope_cannot_read(): void
    {
        Passport::actingAs($this->userWith(Permission::VIEW_DATA), [OAuthScope::MCP->value]);

        $this->getJson(route('item.index'))->assertForbidden();
    }

    public function test_a_read_token_cannot_write(): void
    {
        Passport::actingAs($this->userWith(Permission::VIEW_DATA, Permission::CREATE_DATA), [OAuthScope::API_READ->value]);

        $this->postJson(route('item.store'), ['internal_name' => 'x'])->assertForbidden();
    }

    public function test_the_scope_does_not_replace_the_permission(): void
    {
        Passport::actingAs($this->userWith(), [OAuthScope::API_READ->value, OAuthScope::API_WRITE->value]);

        $this->getJson(route('item.index'))->assertForbidden();
        $this->postJson(route('item.store'), ['internal_name' => 'x'])->assertForbidden();
    }

    public function test_a_read_token_of_a_user_who_may_read_reads(): void
    {
        Passport::actingAs($this->userWith(Permission::VIEW_DATA), [OAuthScope::API_READ->value]);

        $this->getJson(route('item.index'))->assertOk();
    }

    public function test_a_user_on_the_api_guard_holds_the_same_permissions_as_on_the_web_guard(): void
    {
        $user = $this->userWith(Permission::VIEW_DATA);
        Passport::actingAs($user, [OAuthScope::API_READ->value], 'api');

        $apiUser = Auth::guard('api')->user();

        $this->assertInstanceOf(User::class, $apiUser);
        $this->assertTrue($apiUser->hasPermissionTo(Permission::VIEW_DATA->value));
        $this->assertFalse($apiUser->hasPermissionTo(Permission::DELETE_DATA->value));
    }

    public function test_every_client_is_limited_to_the_authorization_code_grant(): void
    {
        $this->assertSame(AuthorizationCodeClient::class, Passport::clientModel());

        $clients = app(ClientRepository::class);
        $authorizationCode = $clients->createAuthorizationCodeGrantClient('MCP client', ['http://localhost/callback'], false);
        $clientCredentials = $clients->createClientCredentialsGrantClient('Machine');

        $this->assertTrue($authorizationCode->hasGrantType('authorization_code'));
        $this->assertTrue($authorizationCode->hasGrantType('refresh_token'));
        $this->assertFalse($clientCredentials->hasGrantType('client_credentials'));
    }

    public function test_the_client_credentials_grant_issues_no_token(): void
    {
        $client = app(ClientRepository::class)->createClientCredentialsGrantClient('Machine');

        $this->postJson(route('passport.token'), [
            'grant_type' => 'client_credentials',
            'client_id' => $client->getKey(),
            'client_secret' => $client->plainSecret,
        ])->assertStatus(400)
            ->assertJsonPath('error', 'unauthorized_client')
            ->assertJsonMissingPath('access_token');
    }

    public function test_the_password_grant_is_not_offered(): void
    {
        $user = $this->userWith(Permission::VIEW_DATA);
        $client = app(ClientRepository::class)->createPasswordGrantClient('Password', 'users', true);

        $this->postJson(route('passport.token'), [
            'grant_type' => 'password',
            'client_id' => $client->getKey(),
            'client_secret' => $client->plainSecret,
            'username' => $user->email,
            'password' => 'password',
        ])->assertStatus(400)->assertJsonPath('error', 'unsupported_grant_type');
    }

    public function test_a_personal_access_token_cannot_be_created(): void
    {
        app(ClientRepository::class)->createPersonalAccessGrantClient('Personal', 'users');

        $this->expectException(\Throwable::class);

        $this->userWith(Permission::VIEW_DATA)->createToken('mine');
    }

    public function test_the_device_code_grant_is_not_offered(): void
    {
        $this->assertFalse(Passport::$deviceCodeGrantEnabled);
        $this->assertFalse(app('router')->has('passport.device'));
    }

    private function userWith(Permission ...$permissions): User
    {
        $user = User::factory()->create();
        $user->givePermissionTo(array_map(fn (Permission $permission): string => $permission->value, $permissions));

        return $user;
    }
}
