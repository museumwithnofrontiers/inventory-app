<?php

namespace Tests\Api\Middleware;

use App\Enums\OAuthScope;
use App\Enums\Role;
use App\Http\Middleware\AuthorizeApiRequest;
use App\Models\Item;
use App\Models\ItemDocument;
use App\Models\Language;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Route as RoutingRoute;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Route;
use Laravel\Passport\Passport;
use Tests\TestCase;

/**
 * Tier 3 on the REST API: every data route asks the model's policy, the
 * same one the panel and the MCP server ask (AuthorizeApiRequest).
 */
class AuthorizeApiRequestTest extends TestCase
{
    use RefreshDatabase;

    private function tokenFor(?Role $role, array $attributes = []): User
    {
        $user = User::factory()->create($attributes);

        if ($role !== null) {
            $user->assignRole($role->value);
        }

        Passport::actingAs($user, [OAuthScope::API_READ->value, OAuthScope::API_WRITE->value]);

        return $user;
    }

    public function test_every_data_route_names_a_model_with_a_policy(): void
    {
        $checked = 0;

        foreach (Route::getRoutes()->getRoutes() as $route) {
            /** @var RoutingRoute $route */
            $guarded = collect($route->gatherMiddleware())
                ->contains(fn (mixed $middleware): bool => is_string($middleware) && str_starts_with($middleware, AuthorizeApiRequest::class));

            if (! $guarded) {
                continue;
            }

            $model = AuthorizeApiRequest::modelFor($route);
            $this->assertNotNull($model, "The route [{$route->uri()}] names no model.");
            $this->assertNotNull(Gate::getPolicyFor($model), "The model [{$model}] of [{$route->uri()}] has no policy.");
            $checked++;
        }

        $this->assertGreaterThan(300, $checked);
    }

    public function test_every_authenticated_api_route_except_the_users_own_is_guarded(): void
    {
        foreach (Route::getRoutes()->getRoutes() as $route) {
            /** @var RoutingRoute $route */
            $middleware = collect($route->gatherMiddleware())->filter(fn (mixed $m): bool => is_string($m));

            if (! $middleware->contains('auth:api') || ! str_starts_with($route->uri(), 'api/')) {
                continue;
            }

            if (in_array($route->uri(), ['api/user', 'api/user/permissions'], true)) {
                continue;
            }

            $this->assertTrue(
                $middleware->contains(fn (string $m): bool => str_starts_with($m, AuthorizeApiRequest::class)),
                "The route [{$route->uri()}] does not ask the policies.",
            );
        }
    }

    public function test_a_visitor_reads_everything_reference_data_included_and_changes_nothing(): void
    {
        $this->tokenFor(Role::VISITOR);
        $language = Language::factory()->create();

        $this->getJson(route('language.index'))->assertOk();
        $this->getJson(route('language.show', $language))->assertOk();
        $this->getJson(route('item.index'))->assertOk();

        $this->postJson(route('language.store'), [])->assertForbidden();
        $this->patchJson(route('language.update', $language), [])->assertForbidden();
        $this->deleteJson(route('language.destroy', $language))->assertForbidden();
    }

    public function test_a_visitor_downloads_an_item_document(): void
    {
        $this->tokenFor(Role::VISITOR);
        $document = ItemDocument::factory()->create();

        $this->assertNotSame(403, $this->get(route('item-document.download', $document))->status());
    }

    public function test_the_manager_of_data_changes_reference_data(): void
    {
        $this->tokenFor(Role::DATA_MANAGER);

        // Past authorization: validation answers
        $this->postJson(route('language.store'), [])->assertUnprocessable();
    }

    public function test_a_user_manager_reads_no_data(): void
    {
        $this->tokenFor(Role::USER_MANAGER);

        $this->getJson(route('item.index'))->assertForbidden();
        $this->getJson(route('language.index'))->assertForbidden();
    }

    public function test_an_account_with_no_role_reads_nothing(): void
    {
        $this->tokenFor(null);

        $this->getJson(route('item.index'))->assertForbidden();
    }

    public function test_a_suspended_account_is_refused(): void
    {
        $this->tokenFor(Role::DATA_MANAGER, ['suspended_at' => now()]);

        $this->getJson(route('item.index'))->assertForbidden();
    }

    public function test_changing_a_child_needs_update_on_its_parent(): void
    {
        $this->tokenFor(Role::DATA_MANAGER);
        $item = Item::factory()->Object()->create();
        Gate::before(fn (User $user, string $ability, array $arguments): ?bool => $ability === 'update' && ($arguments[0] ?? null) instanceof Item ? false : null);

        $this->postJson(route('item.attachImage', $item), [])->assertForbidden();
    }
}
