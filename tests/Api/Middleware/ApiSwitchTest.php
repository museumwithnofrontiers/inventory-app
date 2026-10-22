<?php

namespace Tests\Api\Middleware;

use App\Enums\OAuthScope;
use App\Enums\Permission;
use App\Http\Middleware\EnsureApiEnabled;
use App\Models\Item;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Route;
use Illuminate\Routing\Router;
use Laravel\Passport\Passport;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * The REST API switch (config/api.php, EnsureApiEnabled): while the API is
 * off, every /api route answers 404 whoever asks; nothing outside /api is
 * affected.
 */
class ApiSwitchTest extends TestCase
{
    use RefreshDatabase;

    /**
     * A sample of every kind of /api route: each permission group, the
     * user endpoints and the unauthenticated utility endpoints.
     *
     * @return array<string, array{0: string, 1: string}>
     */
    public static function apiRoutesProvider(): array
    {
        return [
            'view data' => ['GET', 'item.index'],
            'create data' => ['POST', 'item.store'],
            'user' => ['GET', 'user.permissions'],
            'info' => ['GET', 'info.index'],
            'health' => ['GET', 'info.health'],
            'version' => ['GET', 'info.version'],
            'markdown' => ['POST', 'markdown.toHtml'],
            'markdown elements' => ['GET', 'markdown.allowedElements'],
        ];
    }

    #[DataProvider('apiRoutesProvider')]
    public function test_a_switched_off_api_answers_404_to_anonymous_requests(string $method, string $routeName): void
    {
        config(['api.enabled' => false]);

        $this->json($method, route($routeName))->assertNotFound();
    }

    #[DataProvider('apiRoutesProvider')]
    public function test_a_switched_off_api_answers_404_to_authenticated_requests(string $method, string $routeName): void
    {
        config(['api.enabled' => false]);
        Passport::actingAs($this->userWithAllDataPermissions(), [OAuthScope::API_READ->value, OAuthScope::API_WRITE->value]);

        $this->json($method, route($routeName))->assertNotFound();
    }

    #[DataProvider('apiRoutesProvider')]
    public function test_a_switched_on_api_routes_requests_normally(string $method, string $routeName): void
    {
        config(['api.enabled' => true]);
        Passport::actingAs($this->userWithAllDataPermissions(), [OAuthScope::API_READ->value, OAuthScope::API_WRITE->value]);

        $this->assertNotSame(404, $this->json($method, route($routeName))->getStatusCode());
    }

    public function test_a_switched_off_api_neither_reads_nor_deletes_a_record(): void
    {
        config(['api.enabled' => false]);
        Passport::actingAs($this->userWithAllDataPermissions(), [OAuthScope::API_READ->value, OAuthScope::API_WRITE->value]);
        $item = Item::factory()->create();

        $this->getJson(route('item.show', $item))->assertNotFound();
        $this->deleteJson(route('item.destroy', $item))->assertNotFound();

        $this->assertModelExists($item);
    }

    public function test_the_health_check_outside_the_api_still_answers(): void
    {
        config(['api.enabled' => false]);

        $this->get('/up')->assertOk();
    }

    public function test_every_api_route_and_only_api_routes_carry_the_switch(): void
    {
        $router = $this->app->make(Router::class);

        /** @var array<int, Route> $routes */
        $routes = $router->getRoutes()->getRoutes();

        foreach ($routes as $route) {
            $isApi = str_starts_with($route->uri(), 'api/');
            $hasSwitch = in_array(EnsureApiEnabled::class, $router->gatherRouteMiddleware($route), true);

            $this->assertSame($isApi, $hasSwitch, sprintf(
                'Route %s %s: %s',
                implode('|', $route->methods()),
                $route->uri(),
                $isApi ? 'is under /api but skips the API switch' : 'is outside /api but carries the API switch',
            ));
        }
    }

    private function userWithAllDataPermissions(): User
    {
        $user = User::factory()->create();
        $user->givePermissionTo([
            Permission::VIEW_DATA->value,
            Permission::CREATE_DATA->value,
            Permission::UPDATE_DATA->value,
            Permission::DELETE_DATA->value,
        ]);

        return $user;
    }
}
