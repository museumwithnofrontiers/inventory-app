<?php

use Illuminate\Support\Facades\Route;

// The application is the Filament panel
Route::redirect('/', '/admin')->name('root');

// Laravel sends a guest it turns away to the route named `login`: the
// authentication exception handler, and the permission and role middleware
Route::get('/login', fn () => redirect()->route('filament.admin.auth.login'))->name('login');

// The public picture URL, /pub/{filename}, is in routes/pub.php: outside the
// web middleware group, it starts no session and sets no cookie

// The OpenAPI document is published with the documentation site
// (docs/_openapi/api.json); the app serves it only through Scramble's own
// /docs/api routes, behind CustomRestrictedDocsAccess
