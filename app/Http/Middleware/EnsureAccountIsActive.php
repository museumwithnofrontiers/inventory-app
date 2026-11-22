<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Refuses a token whose account may no longer be used: e-mail not verified,
 * not approved, or suspended. Suspending a user already revokes their tokens
 * (App\Support\Authorization\AccessRevoker); this keeps the REST API and the
 * MCP server on the same rule as the panel (User::isActive()) whatever
 * happened to the tokens.
 */
class EnsureAccountIsActive
{
    /**
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user instanceof User && ! $user->isActive()) {
            return response()->json(['message' => 'This account is not active.'], 403);
        }

        return $next($request);
    }
}
