<?php

$redirectDomains = env('MCP_REDIRECT_DOMAINS');

return [

    /*
    |--------------------------------------------------------------------------
    | Redirect Domains
    |--------------------------------------------------------------------------
    |
    | Where an MCP client registering itself (POST /oauth/register) may ask
    | for the user's answer to be sent. Localhost covers Claude Code and other
    | local clients; claude.ai and claude.com cover Claude's connectors.
    | Override with MCP_REDIRECT_DOMAINS, a comma-separated list. Never "*":
    | any site could then register a client that looks like a known one.
    |
    */

    'redirect_domains' => is_string($redirectDomains) && $redirectDomains !== ''
        ? array_map(trim(...), explode(',', $redirectDomains))
        : [
            'http://localhost',
            'http://127.0.0.1',
            'https://claude.ai',
            'https://claude.com',
        ],

    /*
    |--------------------------------------------------------------------------
    | Allowed Custom Schemes
    |--------------------------------------------------------------------------
    |
    | Private-use URI schemes (RFC 8252) some desktop clients redirect to.
    | None is allowed until a client needs one.
    |
    */

    'custom_schemes' => [],

    /*
    |--------------------------------------------------------------------------
    | Authorization Server
    |--------------------------------------------------------------------------
    |
    | The OAuth issuer advertised in the discovery metadata. This app is its
    | own authorization server (Passport); null means url('/').
    |
    */

    'authorization_server' => null,

    /*
    |--------------------------------------------------------------------------
    | Tool Search
    |--------------------------------------------------------------------------
    */

    'tool_search' => [
        'max_tool_calls' => 10,
        'max_output_bytes' => 65_536,
    ],

    /*
    |--------------------------------------------------------------------------
    | MCP Clients
    |--------------------------------------------------------------------------
    |
    | External MCP servers this app would call. None: the app only serves.
    |
    */

    'clients' => [],

    /*
    |--------------------------------------------------------------------------
    | Local (Artisan) transport
    |--------------------------------------------------------------------------
    |
    | The e-mail of the user `php artisan mcp:start inventory` acts as. The
    | stdio transport has no sign-in, so this user's permissions and the
    | policies decide what the session sees, exactly as over HTTP. The server
    | refuses to start without it, or when that user lacks access-mcp.
    |
    */

    'local_user' => env('MCP_LOCAL_USER'),

];
