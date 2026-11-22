<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Routing\Route;
use Symfony\Component\HttpFoundation\Response;

/**
 * Tier 3 for the REST API: every data route asks the model's policy, the
 * same policies the panel and the MCP server ask. The route group says what
 * kind of operation it holds (read, create, update, delete); the route's
 * controller names the model (ItemController: App\Models\Item); the bound
 * route parameters are the records.
 *
 * - Reading: view on the controller's own record when the route binds one,
 *   otherwise viewAny.
 * - Adding a record (a POST that binds none of the controller's own),
 *   whichever group it sits in: create.
 * - Deleting (a DELETE in the delete group): delete.
 * - Anything else, an action on an existing record included (attaching a
 *   tag to an item, detaching an image, clearing a default): update, on the
 *   record or, when the route binds none, on the model as a whole.
 * - Any other bound record is the parent: reading needs view on it, every
 *   change needs update on it (adding an image to an item updates the item).
 *
 * A controller without a model, or a model without a policy, is refused:
 * the policies are the only authorization mechanism.
 */
class AuthorizeApiRequest
{
    public const INTENTS = ['read', 'create', 'update', 'delete'];

    /**
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next, string $intent): Response
    {
        $user = $request->user();
        $route = $request->route();

        if (! $user instanceof User || ! $route instanceof Route || ! in_array($intent, self::INTENTS, true)) {
            return $this->forbidden();
        }

        foreach (self::checks($route, $intent, $request->method()) as [$ability, $subject]) {
            if (! $user->can($ability, $subject)) {
                return $this->forbidden();
            }
        }

        return $next($request);
    }

    /**
     * The abilities a route needs, as [ability, record or model class] pairs.
     * Empty when the route names no model, which then refuses everyone.
     *
     * @return array<int, array{0: string, 1: Model|class-string<Model>}>
     */
    public static function checks(Route $route, string $intent, string $method): array
    {
        $model = self::modelFor($route);

        if ($model === null) {
            return [['deny', User::class]];
        }

        $own = null;
        $parents = [];

        foreach ($route->parameters() as $value) {
            if (! $value instanceof Model) {
                continue;
            }

            if ($own === null && $value instanceof $model) {
                $own = $value;
            } else {
                $parents[] = $value;
            }
        }

        $method = strtoupper($method);

        $ownAbility = match (true) {
            $intent === 'read' => $own !== null ? 'view' : 'viewAny',
            // Adding a record, whichever group the route sits in (a publication's
            // document is added among the publication's updates)
            $own === null && $method === 'POST' => 'create',
            $intent === 'create' => 'update',
            $intent === 'delete' && $method === 'DELETE' => 'delete',
            default => 'update',
        };

        $checks = [[$ownAbility, $own ?? $model]];

        foreach ($parents as $parent) {
            $checks[] = [$intent === 'read' ? 'view' : 'update', $parent];
        }

        return $checks;
    }

    /**
     * @return class-string<Model>|null
     */
    public static function modelFor(Route $route): ?string
    {
        $controller = $route->getControllerClass();

        if (! is_string($controller) || ! str_ends_with($controller, 'Controller')) {
            return null;
        }

        $class = 'App\\Models\\'.substr(class_basename($controller), 0, -strlen('Controller'));

        return class_exists($class) && is_subclass_of($class, Model::class) ? $class : null;
    }

    private function forbidden(): Response
    {
        return response()->json(['message' => 'This action is unauthorized.'], 403);
    }
}
