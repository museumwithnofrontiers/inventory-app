<?php

use Dedoc\Scramble\Generator;
use Dedoc\Scramble\Scramble;
use Illuminate\Support\Facades\Route;

// The application is the Filament panel
Route::redirect('/', '/admin')->name('root');

// Laravel sends a guest it turns away to the route named `login`: the
// authentication exception handler, and the permission and role middleware
Route::get('/login', fn () => redirect()->route('filament.admin.auth.login'))->name('login');

// The public picture URL, /pub/{filename}, is in routes/pub.php: outside the
// web middleware group, it starts no session and sets no cookie

// Expose our OpenApi/Swagger documentation as JSON with caching
Route::get('/api.json', function (Generator $generator) {
    $config = Scramble::getGeneratorConfig('default');

    return response()->json($generator($config), 200, [
        'Cache-Control' => 'public, max-age=3600', // Cache for 1 hour
    ], JSON_PRETTY_PRINT);
})->name('api.documentation');
