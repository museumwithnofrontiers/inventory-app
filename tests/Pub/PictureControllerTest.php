<?php

namespace Tests\Pub;

use App\Models\Item;
use App\Models\ItemImage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class PictureControllerTest extends TestCase
{
    use RefreshDatabase;

    // A genuinely decodable minimal JPEG (unlike the old fixture, the burn
    // pipeline actually decodes this via Intervention Image/GD, not just
    // streams the bytes) - the same fixture ImageUploadListener's own test
    // already confirmed decodes successfully.
    private const MINIMAL_JPEG = '/9j/4AAQSkZJRgABAQEAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('image-originals');
        Storage::fake('public');

        config([
            'localstorage.available.images.disk' => 'image-originals',
            'localstorage.available.images.directory' => 'images',
            'localstorage.pictures.disk' => 'public',
            'localstorage.pictures.directory' => 'pictures',
        ]);
    }

    private function makeItemImage(string $filename, ?string $copyright = null): ItemImage
    {
        $item = Item::factory()->Object()->create();
        $image = ItemImage::factory()->forItem($item)->create([
            'path' => $filename,
            'copyright' => $copyright,
            'mime_type' => 'image/jpeg',
        ]);

        Storage::disk('image-originals')->put('images/'.$filename, base64_decode(self::MINIMAL_JPEG));

        return $image;
    }

    private function uuidJpgFilename(): string
    {
        return Str::uuid()->toString().'.jpg';
    }

    // ── Happy path ────────────────────────────────────────────────────────────

    public function test_serves_burned_image_with_caching_headers(): void
    {
        $filename = $this->uuidJpgFilename();
        $this->makeItemImage($filename, 'Original Owner');

        $response = $this->get(route('pub.picture', ['filename' => $filename]));

        $response->assertOk();
        $response->assertHeader('Content-Type', 'image/jpeg');
        $this->assertNotEmpty($response->headers->get('ETag'));
        $this->assertStringContainsString('public', $response->headers->get('Cache-Control'));
        Storage::disk('public')->assertExists('pictures/'.$filename);
    }

    // ── Conditional GET: ETag ─────────────────────────────────────────────────

    public function test_returns_304_when_etag_matches_and_serves_no_body(): void
    {
        $filename = $this->uuidJpgFilename();
        $this->makeItemImage($filename, 'Original Owner');

        $first = $this->get(route('pub.picture', ['filename' => $filename]));
        $etag = $first->headers->get('ETag');

        $response = $this->withHeaders(['If-None-Match' => $etag])
            ->get(route('pub.picture', ['filename' => $filename]));

        $response->assertStatus(304);
    }

    public function test_stale_etag_after_copyright_change_gets_fresh_body_and_new_etag(): void
    {
        $filename = $this->uuidJpgFilename();
        $image = $this->makeItemImage($filename, 'Original Owner');

        $first = $this->get(route('pub.picture', ['filename' => $filename]));
        $staleEtag = $first->headers->get('ETag');

        $image->update(['copyright' => 'New Owner']);

        $response = $this->withHeaders(['If-None-Match' => $staleEtag])
            ->get(route('pub.picture', ['filename' => $filename]));

        $response->assertOk();
        $this->assertNotSame($staleEtag, $response->headers->get('ETag'));
    }

    public function test_cache_hit_serves_existing_pictures_file_without_reburning(): void
    {
        $filename = $this->uuidJpgFilename();
        $this->makeItemImage($filename, 'Original Owner');

        $first = $this->get(route('pub.picture', ['filename' => $filename]));
        $etag = $first->headers->get('ETag');
        $firstBody = $first->getContent();

        // Overwrite the pictures-disk file with a distinct marker. If the
        // second request re-burns instead of serving the cache, the body
        // returned would be a fresh burn (matching $firstBody in dimensions
        // but freshly encoded), not this exact marker string.
        Storage::disk('public')->put('pictures/'.$filename, 'unchanged-cache-marker');

        $response = $this->withHeaders(['If-None-Match' => 'not-the-current-etag'])
            ->get(route('pub.picture', ['filename' => $filename]));

        $response->assertOk();
        $this->assertSame($etag, $response->headers->get('ETag'));
        $this->assertSame('unchanged-cache-marker', $response->getContent());
        $this->assertNotSame($firstBody, $response->getContent());
    }

    public function test_missing_pictures_cache_file_triggers_regeneration_even_when_etag_marker_matches(): void
    {
        $filename = $this->uuidJpgFilename();
        $this->makeItemImage($filename, 'Original Owner');

        $copyright = 'Original Owner';
        $etag = '"'.sha1($filename.'|'.$copyright).'"';
        Cache::forever('image-copyright-etag:'.$filename, $etag);

        // No file ever put on the pictures disk for this path.
        Storage::disk('public')->assertMissing('pictures/'.$filename);

        $response = $this->get(route('pub.picture', ['filename' => $filename]));

        $response->assertOk();
        Storage::disk('public')->assertExists('pictures/'.$filename);
    }

    // ── 404 paths ─────────────────────────────────────────────────────────────

    public function test_returns_404_for_a_filename_not_owned_by_any_registered_model(): void
    {
        $response = $this->get('/pub/00000000-0000-0000-0000-000000000000.jpg');

        $response->assertNotFound();
    }

    // ── 400 paths ─────────────────────────────────────────────────────────────

    public function test_returns_400_when_query_string_is_present(): void
    {
        $filename = $this->uuidJpgFilename();
        $this->makeItemImage($filename);

        $response = $this->get(route('pub.picture', ['filename' => $filename]).'?w=200');

        $response->assertStatus(400);
    }

    // ── Non-JPEG filename does not match the route ────────────────────────────

    public function test_non_jpg_extension_does_not_match_route(): void
    {
        $response = $this->get('/pub/00000000-0000-0000-0000-000000000000.png');

        $response->assertNotFound();
    }
}
