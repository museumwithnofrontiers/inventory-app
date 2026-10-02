<?php

namespace Tests\Web\Middleware;

use App\Models\Author;
use App\Models\Collection;
use App\Models\Context;
use App\Models\Item;
use App\Models\Language;
use App\Models\Partner;
use App\Models\Tag;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Test that Web routes properly enforce authentication middleware
 *
 * This test uses SAMPLING approach - tests representative routes to verify middleware is applied,
 * rather than testing every single route exhaustively.
 */
class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Data provider for protected Web routes (sample coverage)
     *
     * Tests one route per HTTP method + resource type to verify auth middleware works
     */
    public static function protectedRoutesProvider(): array
    {
        return [
            // Sample GET routes (different types)
            ['GET', 'items.index', null],
            ['GET', 'collections.show', Collection::class],
            ['GET', 'glossaries.create', null],
            ['GET', 'partners.edit', Partner::class],
            ['GET', 'authors.index', null],
            ['GET', 'available-images.index', null],
            ['GET', 'tags.show', Tag::class],

            // Sample POST routes
            ['POST', 'items.store', null],
            ['POST', 'collections.store', null],
            ['POST', 'glossaries.store', null],

            // Sample PATCH/PUT routes
            ['PATCH', 'languages.update', Language::class],
            ['PATCH', 'contexts.update', Context::class],
            ['PATCH', 'authors.update', Author::class],

            // Sample DELETE routes
            ['DELETE', 'tags.destroy', Tag::class],
            ['DELETE', 'partners.destroy', Partner::class],
            ['DELETE', 'items.destroy', Item::class],

            // Admin routes
            ['GET', 'admin.users.index', null],
            ['GET', 'admin.users.create', null],
            ['GET', 'admin.users.edit', User::class],
            ['GET', 'admin.roles.index', null],
            ['POST', 'admin.users.store', null],
            ['PATCH', 'admin.users.update', User::class],
            ['DELETE', 'admin.users.destroy', User::class],

            // Settings routes
            ['GET', 'settings.index', null],
        ];
    }

    /**
     * Data provider for public routes that should NOT require authentication
     */
    public static function publicRoutesProvider(): array
    {
        return [
            ['GET', 'login'],
            ['GET', 'password.request'],
        ];
    }

    #[DataProvider('protectedRoutesProvider')]
    public function test_protected_route_redirects_to_login(string $method, string $route, ?string $modelClass): void
    {
        $routeParams = $this->getRouteParams($modelClass);

        $response = $this->{strtolower($method)}(route($route, $routeParams), []);

        $response->assertRedirect(route('login'));
    }

    #[DataProvider('publicRoutesProvider')]
    public function test_public_route_accessible_without_authentication(string $method, string $route): void
    {
        $response = $this->{strtolower($method)}(route($route));

        $response->assertOk();
    }

    /**
     * Get route parameters for routes that need a model instance
     */
    private function getRouteParams(?string $modelClass): array
    {
        if (! $modelClass) {
            return [];
        }

        // Create model instance for route binding
        $model = $modelClass::factory()->create();

        return [$model];
    }
}
