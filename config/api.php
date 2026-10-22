<?php

return [

    /*
    |--------------------------------------------------------------------------
    | REST API switch
    |--------------------------------------------------------------------------
    |
    | Off unless explicitly turned on. While off, every route under /api
    | answers 404 before authentication runs (EnsureApiEnabled). The routes
    | stay registered so route names and the OpenAPI export keep working.
    |
    | The API has no client today: the Filament panel is the only UI. When a
    | client arrives it authenticates with OAuth (Passport); turning the API
    | on is this flag plus registering that client.
    |
    */

    'enabled' => (bool) env('API_ENABLED', false),

];
