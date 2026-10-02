<?php

use App\Http\Middleware\RequirePermission;
use App\Http\Middleware\RequireRole;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Spatie\Permission\Middleware\PermissionMiddleware;
use Spatie\Permission\Middleware\RoleMiddleware;
use Spatie\Permission\Middleware\RoleOrPermissionMiddleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        // The public picture URL, outside the web group (see routes/pub.php)
        then: function () {
            Route::middleware('throttle:pub-pictures')
                ->prefix('pub')
                ->name('pub.')
                ->group(__DIR__.'/../routes/pub.php');
        },
    )
    ->withMiddleware(function (Middleware $middleware) {
        // Configure trusted proxies from environment variable
        $trustedProxies = env('TRUSTED_PROXIES', '');
        if (! empty($trustedProxies)) {
            $proxies = array_map('trim', explode(',', $trustedProxies));
            $middleware->trustProxies(
                at: $proxies,
                headers: Request::HEADER_X_FORWARDED_FOR |
                    Request::HEADER_X_FORWARDED_HOST |
                    Request::HEADER_X_FORWARDED_PORT |
                    Request::HEADER_X_FORWARDED_PROTO
            );
        }

        // Use custom CSRF verification middleware that excludes API routes
        $middleware->validateCsrfTokens(
            except: ['api/*']
        );

        // Register authorization middleware
        $middleware->alias([
            'permission' => RequirePermission::class,
            'role' => RequireRole::class,
            'role.spatie' => RoleMiddleware::class,
            'permission.spatie' => PermissionMiddleware::class,
            'role_or_permission' => RoleOrPermissionMiddleware::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();
