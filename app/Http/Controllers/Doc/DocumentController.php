<?php

namespace App\Http\Controllers\Doc;

use App\Http\Controllers\Controller;
use App\Models\PublicationDocument;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * /doc/{filename}: a publication's PDF, at the stable public URL the
 * Publications site links to (ADR 004).
 *
 * It serves PublicationDocument files only, from the private documents disk,
 * streamed as stored: never stamped, never an ItemDocument, never the public
 * disk. The browser renders it sandboxed, without sniffing its type.
 */
class DocumentController extends Controller
{
    /**
     * Clients and CDNs may keep a document but must revalidate it on every
     * use, as /pub does for pictures.
     */
    private const string CACHE_CONTROL = 'public, no-cache';

    /**
     * Set on a request that read a file: the doc-documents limiter counts
     * those, and errors, but not the 304s a revalidating client makes.
     */
    public const string SERVED = 'doc.served';

    public function show(Request $request, string $filename): Response|StreamedResponse
    {
        // Public document URLs are clean: no query string
        if ($request->query->count() > 0) {
            abort(400, 'Query parameters are not accepted.');
        }

        $document = PublicationDocument::query()->where('path', $filename)->first();

        if ($document === null) {
            abort(404);
        }

        $disk = Storage::disk(Config::string('localstorage.documents.disk'));
        $path = trim(Config::string('localstorage.documents.directory'), '/').'/'.$document->path;

        if (! $disk->exists($path)) {
            abort(404);
        }

        $size = $disk->size($path);
        $checksum = $disk->checksum($path);
        $etag = '"'.sha1($size.'|'.(is_string($checksum) ? $checksum : '')).'"';

        $headers = [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => self::inlineDisposition($document->original_name ?: $document->path),
            'X-Content-Type-Options' => 'nosniff',
            'Content-Security-Policy' => 'sandbox',
            'Cache-Control' => self::CACHE_CONTROL,
            'ETag' => $etag,
        ];

        if ($request->header('If-None-Match') === $etag) {
            // A 304 carries the headers the 200 would have had (RFC 9110 §15.4.5)
            return response('', 304, $headers);
        }

        $request->attributes->set(self::SERVED, true);

        return response()->stream(function () use ($disk, $path): void {
            $stream = $disk->readStream($path);

            if ($stream === null) {
                return;
            }

            fpassthru($stream);
            fclose($stream);
        }, 200, $headers + ['Content-Length' => (string) $size]);
    }

    /**
     * `inline; filename="…"` with the original name, made safe for a quoted
     * header value: no quote, backslash, slash or control character, and
     * plain ASCII, with the exact name as RFC 5987 `filename*` when it is not.
     */
    public static function inlineDisposition(string $originalName): string
    {
        $name = basename(str_replace('\\', '/', $originalName));
        $ascii = preg_replace('/[^\x20-\x7E]|["\\\\\/]/u', '_', $name) ?? '';
        $ascii = $ascii !== '' ? $ascii : 'document.pdf';

        $header = 'inline; filename="'.$ascii.'"';

        if (preg_match('/[^\x20-\x7E]/', $name) === 1) {
            $header .= "; filename*=UTF-8''".rawurlencode($name);
        }

        return $header;
    }
}
