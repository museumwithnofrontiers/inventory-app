<?php

namespace Tests\Configuration;

use App\Enums\OAuthScope;
use App\Support\Documentation\OperationTransformers\RouteSecurity;
use Dedoc\Scramble\Generator;
use Dedoc\Scramble\Scramble;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Route;
use Illuminate\Support\Facades\Route as RouteFacade;
use Tests\TestCase;

/**
 * The OpenAPI document (docs/_openapi/api.json) is generated from the code by docs:openapi, and
 * CI fails when the committed file differs. These tests hold what the generation relies on and
 * what app/Support/Documentation adds to Scramble.
 */
class OpenApiDocumentTest extends TestCase
{
    use RefreshDatabase;

    /** @var array<string, mixed>|null Generated once: Scramble analyses every API route. */
    private static ?array $document = null;

    /**
     * @return array<string, mixed>
     */
    private function document(): array
    {
        if (self::$document === null) {
            /** @var array<string, mixed> $document */
            $document = json_decode((string) json_encode(app(Generator::class)(Scramble::getGeneratorConfig('default'))), true);
            self::$document = $document;
        }

        return self::$document;
    }

    /**
     * @return array<string, array<string, mixed>> Operations keyed "method /path".
     */
    private function operations(): array
    {
        $operations = [];
        foreach ($this->document()['paths'] as $path => $item) {
            foreach ($item as $method => $operation) {
                if (in_array($method, ['get', 'post', 'put', 'patch', 'delete'], true)) {
                    $operations["{$method} {$path}"] = $operation;
                }
            }
        }

        return $operations;
    }

    /**
     * @return list<Route>
     */
    private function apiRoutes(): array
    {
        return array_values(array_filter(
            RouteFacade::getRoutes()->getRoutes(),
            fn (Route $route): bool => str_starts_with($route->uri(), 'api/'),
        ));
    }

    /**
     * The route name is the operationId; without one Scramble falls back to a positional suffix
     * (`artist.update_226`) that changes whenever any route is added or removed.
     */
    public function test_every_api_route_has_a_name(): void
    {
        $unnamed = array_map(
            fn (Route $route): string => implode('|', $route->methods()).' '.$route->uri(),
            array_filter($this->apiRoutes(), fn (Route $route): bool => $route->getName() === null),
        );

        $this->assertSame([], array_values($unnamed));
    }

    public function test_operation_ids_are_unique_and_never_positional(): void
    {
        $ids = array_column($this->operations(), 'operationId');

        $this->assertCount(count($this->operations()), $ids, 'Every operation has an operationId');
        $this->assertSame(array_unique($ids), $ids);
        $this->assertSame([], array_values(preg_grep('/_\d+$/', $ids) ?: []));
        $this->assertSame('artist.update', $this->operations()['patch /artist/{artist}']['operationId']);
        $this->assertSame('artist.update.put', $this->operations()['put /artist/{artist}']['operationId']);
    }

    public function test_each_operation_states_the_scopes_its_route_requires(): void
    {
        $operations = $this->operations();
        $require = fn (string $scope): array => [[RouteSecurity::SCHEME => [$scope]]];

        $this->assertSame($require(OAuthScope::API_READ->value), $operations['get /artist']['security']);
        $this->assertSame($require(OAuthScope::API_WRITE->value), $operations['post /artist']['security']);
        $this->assertSame($require(OAuthScope::API_WRITE->value), $operations['delete /artist/{artist}']['security']);
        // scope: (any of) gives one alternative per scope
        $this->assertSame(
            [[RouteSecurity::SCHEME => [OAuthScope::API_READ->value]], [RouteSecurity::SCHEME => [OAuthScope::MCP->value]]],
            $operations['get /user']['security'],
        );

        foreach ($operations as $key => $operation) {
            $this->assertArrayHasKey('security', $operation, "{$key} states its security");
        }
    }

    public function test_routes_without_authentication_are_documented_as_public(): void
    {
        $public = array_keys(array_filter($this->operations(), fn (array $operation): bool => $operation['security'] === []));

        $expected = [];
        foreach ($this->apiRoutes() as $route) {
            $authenticated = collect($route->gatherMiddleware())
                ->contains(fn (mixed $middleware): bool => is_string($middleware) && ($middleware === 'auth' || str_starts_with($middleware, 'auth:')));
            if (! $authenticated) {
                foreach (array_diff($route->methods(), ['HEAD']) as $method) {
                    $expected[] = strtolower($method).' /'.substr($route->uri(), strlen('api/'));
                }
            }
        }

        sort($public);
        sort($expected);
        $this->assertContains('get /health', $public);
        $this->assertSame($expected, $public);
    }

    public function test_store_actions_answer_201(): void
    {
        foreach ($this->operations() as $key => $operation) {
            if (str_ends_with($operation['operationId'], '.store')) {
                $this->assertArrayHasKey('201', $operation['responses'], $key);
                $this->assertArrayNotHasKey('200', $operation['responses'], $key);
            }
        }

        $this->assertArrayHasKey('201', $this->operations()['post /item/{item}/links']['responses']);
    }

    public function test_file_responses_are_binary(): void
    {
        $operations = $this->operations();

        $view = $operations['get /item-image/{itemImage}/view']['responses']['200']['content'];
        $this->assertSame(['image/*'], array_keys($view));
        $this->assertSame(['type' => 'string', 'format' => 'binary'], $view['image/*']['schema']);

        $download = $operations['get /item-document/{itemDocument}/download']['responses']['200']['content'];
        $this->assertSame(['application/octet-stream'], array_keys($download));
    }
}
