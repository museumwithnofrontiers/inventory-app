<?php

use App\Http\Controllers\Pub\PictureController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Public picture URL
|--------------------------------------------------------------------------
|
| /pub/{filename}, the stable URL the data packages link to. Registered in
| bootstrap/app.php outside the web middleware group, with only its
| throttle: no session, no cookie, no CSRF token. The sites load these
| pictures from another origin and send no cookie with them, so the web group
| would start a new session for every picture, and put its cookies on
| responses marked Cache-Control: public.
|
| Serves any attached image by its bare stored filename: a UUID for synced
| legacy images, a ULID (admin uploads) or a 40-character hash name (API
| uploads), in any raster format the image pipeline produces. The extension
| keeps the case the upload came with; anything else is a 404.
|
*/

Route::get('/{filename}', [PictureController::class, 'show'])
    ->where('filename', '[0-9A-Za-z-]+\.(?:[jJ][pP][eE]?[gG]|[pP][nN][gG]|[gG][iI][fF]|[wW][eE][bB][pP])')
    ->name('picture');
