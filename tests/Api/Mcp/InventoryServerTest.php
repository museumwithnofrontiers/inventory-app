<?php

namespace Tests\Api\Mcp;

use App\Enums\OAuthScope;
use App\Enums\Permission;
use App\Filament\Pages\AuthorizeApplicationPage;
use App\Mcp\LocalUser;
use App\Mcp\Servers\InventoryServer;
use App\Mcp\Tools\WhoAmI;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Filament\Facades\Filament;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Illuminate\Testing\Fluent\AssertableJson;
use Illuminate\Testing\TestResponse;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;
use Laravel\Mcp\Server\Transport\StdioTransport;
use Laravel\Passport\Passport;
use ReflectionClass;
use RuntimeException;
use Spatie\Permission\Models\Role;
use Tests\TestCase;
use Tests\Traits\IssuesOAuthTokens;

/**
 * The read-only inventory MCP server: who may reach it over HTTP and through
 * Artisan, and what whoami reports.
 */
class InventoryServerTest extends TestCase
{
    use IssuesOAuthTokens;
    use RefreshDatabase;

    public function test_every_tool_is_annotated_read_only(): void
    {
        foreach (InventoryServer::TOOLS as $tool) {
            $this->assertNotEmpty(
                (new ReflectionClass($tool))->getAttributes(IsReadOnly::class),
                "{$tool} must carry #[IsReadOnly]: the inventory MCP server only reads.",
            );
        }
    }

    public function test_whoami_reports_the_user_roles_permissions_and_tools(): void
    {
        $user = $this->mcpUser();
        $user->assignRole('Visitor');

        InventoryServer::actingAs($user)
            ->tool(WhoAmI::class)
            ->assertOk()
            ->assertStructuredContent(fn (AssertableJson $json): AssertableJson => $json
                ->where('user.email', $user->email)
                ->where('roles', fn (Collection $roles): bool => $roles->contains('Visitor'))
                ->where('permissions', fn (Collection $permissions): bool => $permissions->contains(Permission::ACCESS_MCP->value))
                ->where('tools', fn (Collection $tools): bool => $tools->contains('whoami'))
                ->where('connection.transport', 'local')
                ->etc());
    }

    public function test_the_http_server_wants_an_oauth_token_and_says_where_to_get_one(): void
    {
        $response = $this->mcpCall('tools/call', ['name' => 'whoami', 'arguments' => []]);

        $response->assertUnauthorized();
        $this->assertStringContainsString(
            route('mcp.oauth.protected-resource.nested', ['path' => 'mcp/inventory']),
            (string) $response->headers->get('WWW-Authenticate'),
        );
    }

    public function test_a_token_without_the_mcp_scope_is_refused(): void
    {
        Passport::actingAs($this->mcpUser(), [OAuthScope::API_READ->value]);

        $this->mcpCall('tools/call', ['name' => 'whoami', 'arguments' => []])->assertForbidden();
    }

    public function test_a_user_without_access_mcp_is_refused(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo(Permission::ACCESS_ADMIN_PANEL->value);
        Passport::actingAs($user, [OAuthScope::MCP->value]);

        $this->mcpCall('tools/call', ['name' => 'whoami', 'arguments' => []])->assertForbidden();
    }

    public function test_an_app_approved_through_the_consent_page_calls_whoami_over_http(): void
    {
        $user = $this->mcpUser();
        $user->givePermissionTo(Permission::ACCESS_ADMIN_PANEL->value);
        $token = $this->issueOAuthToken($user, $this->createPublicOAuthClient('Claude'), OAuthScope::MCP->value);
        $this->forgetBearerGuards();

        $response = $this->withToken($token)->mcpCall('tools/call', ['name' => 'whoami', 'arguments' => []]);

        $response->assertOk();
        $whoami = $this->structuredContentOf($response);
        $this->assertSame($user->email, $whoami['user']['email']);
        $this->assertSame('http', $whoami['connection']['transport']);
        $this->assertSame('Claude', $whoami['connection']['client']);
        $this->assertSame([OAuthScope::MCP->value], $whoami['connection']['scopes']);
    }

    public function test_approving_the_mcp_scope_needs_access_mcp(): void
    {
        Filament::setCurrentPanel(Filament::getPanel('admin'));
        $user = User::factory()->create();
        $user->givePermissionTo(Permission::ACCESS_ADMIN_PANEL->value);
        $this->actingAs($user, 'web');

        $this->get($this->oauthAuthorizeUrl($this->createPublicOAuthClient(), Str::random(64), ['scope' => OAuthScope::MCP->value]));

        $this->get(AuthorizeApplicationPage::getUrl())->assertForbidden();
    }

    public function test_the_local_server_acts_as_the_configured_user(): void
    {
        $user = $this->mcpUser();
        config(['mcp.local_user' => $user->email]);

        (new InventoryServer(new StdioTransport))->start();

        $this->assertTrue(Auth::user()?->is($user));
    }

    public function test_the_local_server_refuses_to_start_without_a_user(): void
    {
        config(['mcp.local_user' => null]);

        $this->expectException(RuntimeException::class);
        (new InventoryServer(new StdioTransport))->start();
    }

    public function test_the_local_server_refuses_an_unknown_user(): void
    {
        config(['mcp.local_user' => 'nobody@example.com']);

        $this->expectException(RuntimeException::class);
        LocalUser::resolve();
    }

    public function test_the_local_server_refuses_a_user_without_access_mcp(): void
    {
        config(['mcp.local_user' => User::factory()->create()->email]);

        $this->expectException(RuntimeException::class);
        LocalUser::resolve();
    }

    public function test_every_role_entering_the_panel_may_use_the_mcp_server(): void
    {
        $this->seed(RolePermissionSeeder::class);

        foreach (Role::all() as $role) {
            $this->assertSame(
                $role->hasPermissionTo(Permission::ACCESS_ADMIN_PANEL->value),
                $role->hasPermissionTo(Permission::ACCESS_MCP->value),
                "Role {$role->name}: access-mcp must follow access-admin-panel",
            );
        }
    }

    public function test_the_migration_grants_access_mcp_to_roles_entering_the_panel(): void
    {
        $role = Role::create(['name' => 'Panel role', 'guard_name' => 'web']);
        $role->givePermissionTo(Permission::ACCESS_ADMIN_PANEL->value);
        $outsider = Role::create(['name' => 'Outsider', 'guard_name' => 'web']);

        $migration = require database_path('migrations/2026_10_22_130000_grant_access_mcp_permission.php');
        $migration->up();

        $this->assertTrue($role->fresh()?->hasPermissionTo(Permission::ACCESS_MCP->value));
        $this->assertFalse($outsider->fresh()?->hasPermissionTo(Permission::ACCESS_MCP->value));
    }

    public function test_mcp_clients_discover_the_authorization_server(): void
    {
        $this->getJson(route('mcp.oauth.protected-resource.nested', ['path' => 'mcp/inventory']))
            ->assertOk()
            ->assertJsonPath('resource', url('/mcp/inventory'))
            ->assertJsonPath('authorization_servers.0', url('/'));

        $this->getJson(route('mcp.oauth.authorization-server'))
            ->assertOk()
            ->assertJsonPath('authorization_endpoint', route('passport.authorizations.authorize'))
            ->assertJsonPath('token_endpoint', route('passport.token'))
            ->assertJsonPath('registration_endpoint', route('mcp.oauth.register'))
            ->assertJsonPath('grant_types_supported', ['authorization_code', 'refresh_token']);
    }

    public function test_a_client_registers_itself_for_a_permitted_redirect_only(): void
    {
        $this->postJson(route('mcp.oauth.register'), [
            'client_name' => 'Claude Code',
            'redirect_uris' => ['http://localhost:54321/callback'],
        ])->assertCreated()
            ->assertJsonPath('grant_types', ['authorization_code', 'refresh_token'])
            ->assertJsonPath('token_endpoint_auth_method', 'none');

        $this->postJson(route('mcp.oauth.register'), [
            'client_name' => 'Look-alike',
            'redirect_uris' => ['https://attacker.example/callback'],
        ])->assertStatus(400)
            ->assertJsonPath('error', 'invalid_redirect_uri');
    }

    private function mcpUser(): User
    {
        $user = User::factory()->create();
        $user->givePermissionTo(Permission::ACCESS_MCP->value);

        return $user;
    }

    /**
     * @param  array<string, mixed>  $params
     */
    private function mcpCall(string $method, array $params): TestResponse
    {
        return $this->postJson('/mcp/inventory', [
            'jsonrpc' => '2.0',
            'id' => 1,
            'method' => $method,
            'params' => $params,
        ], ['Accept' => 'application/json, text/event-stream']);
    }

    /**
     * @return array<string, mixed>
     */
    private function structuredContentOf(TestResponse $response): array
    {
        $content = $response->json('result.structuredContent');

        $this->assertIsArray($content, 'The tool returned no structured content: '.$response->getContent());

        /** @var array<string, mixed> $content */
        return $content;
    }
}
