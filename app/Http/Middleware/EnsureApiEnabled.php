<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;
use Symfony\Component\HttpFoundation\Response;

/**
 * Answers 404 for every /api route while the API is switched off
 * (config/api.php). It runs first in the api group and ahead of
 * authentication in the priority list, so a switched-off API reveals
 * nothing: not whether a route exists, nor whether a token is valid.
 */
class EnsureApiEnabled
{
    /**
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (! Config::boolean('api.enabled')) {
            abort(404);
        }

        return $next($request);
    }
}
