<?php

namespace App\Http\Middleware;

use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken as Middleware;

class VerifyCsrfToken extends Middleware
{
    /**
     * The URIs that should be excluded from CSRF verification.
     *
     * @var array<int, string>
     */
    protected $except = [
        // Exclude all API routes from CSRF verification
        // API authentication uses OAuth bearer tokens (Passport), not session cookies
        'api/*',
    ];

    /**
     * No XSRF-TOKEN cookie. It exists for JavaScript that copies it into an
     * X-XSRF-TOKEN header, so it can't be HttpOnly, and nothing here reads it:
     * Livewire sends the page's token, and the API uses bearer tokens.
     *
     * @var bool
     */
    protected $addHttpCookie = false;
}
