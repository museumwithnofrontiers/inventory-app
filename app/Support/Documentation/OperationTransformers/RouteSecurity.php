<?php

namespace App\Support\Documentation\OperationTransformers;

use Dedoc\Scramble\Contracts\OperationTransformer;
use Dedoc\Scramble\Support\Generator\Operation;
use Dedoc\Scramble\Support\Generator\SecurityRequirement;
use Dedoc\Scramble\Support\RouteInfo;
use Illuminate\Support\Str;

/**
 * Documents each operation's security from the middleware its route really runs.
 *
 * - No `auth` middleware: the operation is public (`security: []`).
 * - `scopes:a,b`: the token must carry every scope (one requirement listing them all).
 * - `scope:a,b`: any one of them will do (one requirement per scope).
 * - `auth` alone: any token.
 */
class RouteSecurity implements OperationTransformer
{
    /** The scheme AppServiceProvider declares (SecurityScheme::oauth2()). */
    public const SCHEME = 'oauth2';

    public function handle(Operation $operation, RouteInfo $routeInfo): void
    {
        $middleware = array_filter(
            $routeInfo->route->gatherMiddleware(),
            fn (mixed $m): bool => is_string($m),
        );

        $authenticated = false;
        $allOf = [];
        $anyOf = [];

        foreach ($middleware as $entry) {
            $name = Str::before($entry, ':');
            $parameters = Str::contains($entry, ':') ? explode(',', Str::after($entry, ':')) : [];

            match ($name) {
                'auth' => $authenticated = true,
                'scopes' => $allOf = [...$allOf, ...$parameters],
                'scope' => $anyOf = [...$anyOf, ...$parameters],
                default => null,
            };
        }

        if (! $authenticated) {
            $operation->security = [];

            return;
        }

        if ($anyOf === []) {
            $operation->security = [new SecurityRequirement([self::SCHEME => array_values(array_unique($allOf))])];

            return;
        }

        $operation->security = array_map(
            fn (string $scope): SecurityRequirement => new SecurityRequirement([self::SCHEME => array_values(array_unique([...$allOf, $scope]))]),
            array_values(array_unique($anyOf)),
        );
    }
}
