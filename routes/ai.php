<?php

use App\Enums\OAuthScope;
use App\Enums\Permission;
use App\Mcp\Servers\InventoryServer;
use Illuminate\Support\Facades\Route;
use Laravel\Mcp\Facades\Mcp;
use Laravel\Mcp\Server\Http\Controllers\OAuthRegisterController;

// OAuth discovery for MCP clients (RFC 9728, RFC 8414); Passport is the
// authorization server
Mcp::oauthRoutes(registration: false);

// MCP clients register themselves (RFC 7591) as public clients limited to
// the authorization-code grant. Anyone may call it, hence the rate limit.
Route::post('oauth/register', OAuthRegisterController::class)
    ->middleware('throttle:oauth-register')
    ->name('mcp.oauth.register');

// The read-only inventory MCP server
Mcp::web('/mcp/inventory', InventoryServer::class)
    ->middleware([
        'auth:api',
        'scopes:'.OAuthScope::MCP->value,
        'permission:'.Permission::ACCESS_MCP->value,
    ])
    ->name('mcp.inventory');

Mcp::local('inventory', InventoryServer::class);
