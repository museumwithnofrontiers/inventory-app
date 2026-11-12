<?php

use App\Http\Controllers\Doc\DocumentController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Public document URL
|--------------------------------------------------------------------------
|
| /doc/{filename}, the stable URL the Publications site links to for a
| publication's sample and credits PDFs (ADR 004). Registered in
| bootstrap/app.php outside the web middleware group, like /pub, with only
| its own throttle: no session, no cookie, no CSRF token.
|
| Serves PublicationDocument files only, by their bare stored filename: the
| document's UUID and `.pdf` (DocumentUploadListener stores a publication
| document under that name). Anything else is a 404.
|
*/

Route::get('/{filename}', [DocumentController::class, 'show'])
    ->where('filename', '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.pdf')
    ->name('document');
