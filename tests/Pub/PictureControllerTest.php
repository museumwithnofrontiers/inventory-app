<?php

namespace Tests\Pub;

use App\Models\Collection;
use App\Models\CollectionImage;
use App\Models\Contributor;
use App\Models\ContributorImage;
use App\Models\Item;
use App\Models\ItemImage;
use App\Models\Partner;
use App\Models\PartnerImage;
use App\Models\PartnerLogo;
use App\Models\PartnerTranslation;
use App\Models\PartnerTranslationImage;
use App\Models\TimelineEvent;
use App\Models\TimelineEventImage;
use App\Support\Images\ImageBurner;
use App\Support\Images\PublicRenditions;
use Closure;
use finfo;
use Illuminate\Cache\ArrayLock;
use Illuminate\Cache\ArrayStore;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Intervention\Image\Drivers\Gd\Driver;
use Intervention\Image\Encoders\GifEncoder;
use Intervention\Image\Encoders\JpegEncoder;
use Intervention\Image\Encoders\PngEncoder;
use Intervention\Image\Encoders\WebpEncoder;
use Intervention\Image\ImageManager;
use Intervention\Image\Interfaces\EncoderInterface;
use Mockery;
use PHPUnit\Framework\Attributes\DataProvider;
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

    /**
     * A record of any registry model, with its original on the originals disk.
     *
     * @param  class-string<Model>  $class
     */
    private function makeRegisteredImage(string $class, string $filename): Model
    {
        $attributes = ['path' => $filename, 'mime_type' => 'image/jpeg'];

        $image = match ($class) {
            ItemImage::class => ItemImage::factory()->create($attributes + ['item_id' => Item::factory()->create()->id]),
            CollectionImage::class => CollectionImage::factory()->create($attributes + ['collection_id' => Collection::factory()->create()->id]),
            PartnerImage::class => PartnerImage::factory()->create($attributes + ['partner_id' => Partner::factory()->create()->id]),
            PartnerTranslationImage::class => PartnerTranslationImage::factory()->create($attributes + ['partner_translation_id' => PartnerTranslation::factory()->create()->id]),
            ContributorImage::class => ContributorImage::factory()->create($attributes + ['contributor_id' => Contributor::factory()->create()->id]),
            TimelineEventImage::class => TimelineEventImage::factory()->create($attributes + ['timeline_event_id' => TimelineEvent::factory()->create()->id]),
            PartnerLogo::class => PartnerLogo::factory()->create($attributes + ['partner_id' => Partner::factory()->create()->id]),
            default => throw new \InvalidArgumentException("Unhandled class: {$class}"),
        };

        Storage::disk('image-originals')->put('images/'.$filename, base64_decode(self::MINIMAL_JPEG));

        return $image;
    }

    /**
     * Make the default cache an array store whose lock runs $otherRequest
     * before it is acquired: what another request, holding the lock, does
     * while this one waits in block().
     */
    private function useCacheWhoseLockIsHeldUntil(Closure $otherRequest): void
    {
        $store = new class($otherRequest) extends ArrayStore
        {
            public function __construct(private readonly Closure $otherRequest)
            {
                parent::__construct();
            }

            public function lock($name, $seconds = 0, $owner = null)
            {
                return new class($this, $name, $seconds, $owner, $this->otherRequest) extends ArrayLock
                {
                    public function __construct($store, $name, $seconds, $owner, private readonly Closure $otherRequest)
                    {
                        parent::__construct($store, $name, $seconds, $owner);
                    }

                    public function block($seconds, $callback = null)
                    {
                        ($this->otherRequest)();

                        return parent::block($seconds, $callback);
                    }
                };
            }
        };

        Cache::extend('held-lock', fn () => Cache::repository($store));
        config(['cache.stores.held-lock' => ['driver' => 'held-lock'], 'cache.default' => 'held-lock']);
    }

    private function uuidJpgFilename(): string
    {
        return Str::uuid()->toString().'.jpg';
    }

    /**
     * `public, no-cache`: anyone may store the picture, but must ask before
     * each use - never a max-age that would hide a copyright edit.
     */
    private function assertRevalidatedOnEveryUse(TestResponse $response): void
    {
        $directives = array_map('trim', explode(',', (string) $response->headers->get('Cache-Control')));
        sort($directives);

        $this->assertSame(['no-cache', 'public'], $directives);
    }

    // ── Happy path ────────────────────────────────────────────────────────────

    public function test_serves_burned_image_with_caching_headers(): void
    {
        $filename = $this->uuidJpgFilename();
        $this->makeItemImage($filename, 'Original Owner');

        $response = $this->get(route('pub.picture', ['filename' => $filename]));

        $response->assertOk();
        $response->assertHeader('Content-Type', 'image/jpeg');
        // The burner's version is part of the ETag, so a change in its output
        // reaches clients that hold the previous rendition
        $response->assertHeader('ETag', '"'.sha1(ImageBurner::VERSION.'|'.$filename.'|Original Owner').'"');
        $this->assertRevalidatedOnEveryUse($response);
        Storage::disk('public')->assertExists('pictures/'.$filename);
    }

    public function test_a_cache_hit_is_also_revalidated_on_every_use(): void
    {
        $filename = $this->uuidJpgFilename();
        $this->makeItemImage($filename, 'Original Owner');

        $this->get(route('pub.picture', ['filename' => $filename]))->assertOk();
        $response = $this->get(route('pub.picture', ['filename' => $filename]));

        $response->assertOk();
        $this->assertRevalidatedOnEveryUse($response);
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
        $this->assertSame('', $response->getContent());
        // The headers the 200 would have had (RFC 9110 §15.4.5)
        $response->assertHeader('ETag', $etag);
        $this->assertRevalidatedOnEveryUse($response);
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
        $etag = '"'.sha1(ImageBurner::VERSION.'|'.$filename.'|'.$copyright).'"';
        Cache::forever('image-copyright-etag:'.$filename, $etag);

        // No file ever put on the pictures disk for this path.
        Storage::disk('public')->assertMissing('pictures/'.$filename);

        $response = $this->get(route('pub.picture', ['filename' => $filename]));

        $response->assertOk();
        Storage::disk('public')->assertExists('pictures/'.$filename);
    }

    public function test_a_failed_cache_write_still_serves_the_burn_but_records_no_marker(): void
    {
        $filename = $this->uuidJpgFilename();
        $this->makeItemImage($filename, 'Original Owner');

        // A pictures disk that refuses every write, as the public disk does
        // (throw => false) when it's full or not writable
        $pictures = Mockery::mock(Filesystem::class);
        $pictures->shouldReceive('exists')->andReturnFalse();
        $pictures->shouldReceive('put')->once()->andReturnFalse();
        Storage::set('public', $pictures);
        Log::spy();

        $response = $this->get(route('pub.picture', ['filename' => $filename]));

        $response->assertOk();
        $this->assertNotSame(base64_decode(self::MINIMAL_JPEG), $response->getContent());
        $response->assertHeader('ETag', '"'.sha1(ImageBurner::VERSION.'|'.$filename.'|Original Owner').'"');
        $this->assertNull(Cache::get('image-copyright-etag:'.$filename));
        Log::shouldHaveReceived('warning')->once()->withArgs(
            fn (string $message, array $context): bool => $context === [
                'disk' => 'public',
                'path' => 'pictures/'.$filename,
                'filename' => $filename,
            ]
        );
    }

    // ── Lock-coalesced regeneration ──────────────────────────────────────────

    public function test_a_request_that_waited_for_the_lock_serves_the_rendition_the_holder_just_burned(): void
    {
        $filename = $this->uuidJpgFilename();
        $image = $this->makeItemImage($filename, 'Original Owner');
        $etag = app(PublicRenditions::class)->etag($image);

        // A cache whose lock, while this request waits for it, lets another
        // request finish burning this very image: it writes the rendition
        // and records its ETag, as PublicRenditions does, then releases.
        $this->useCacheWhoseLockIsHeldUntil(function () use ($filename, $etag): void {
            Storage::disk('public')->put('pictures/'.$filename, 'burned-by-the-lock-holder');
            Cache::forever('image-copyright-etag:'.$filename, $etag);
        });

        // Coalescing is the re-check inside the lock: this request must
        // reuse that rendition, not burn a second one
        $this->partialMock(ImageBurner::class, fn ($mock) => $mock->shouldNotReceive('burn'));

        $response = $this->get(route('pub.picture', ['filename' => $filename]));

        $response->assertOk();
        $this->assertSame('burned-by-the-lock-holder', $response->getContent());
        $response->assertHeader('ETag', $etag);
    }

    public function test_after_an_invalidation_one_request_burns_and_the_next_ones_hit_the_cache(): void
    {
        $filename = $this->uuidJpgFilename();
        $image = $this->makeItemImage($filename, 'Original Owner');

        // The mock must be bound before the very first request hits this
        // route: Illuminate\Routing\Route caches its resolved controller
        // instance on first dispatch and reuses it for later requests to
        // the same route within this test, so a mock set up afterwards
        // would never actually be used by the already-resolved controller.
        // Two burns are expected in total: the baseline rendition below,
        // then one after the invalidation, which the requests that follow
        // it one by one find in the cache. (These requests are sequential,
        // so this is about cache hits; coalescing concurrent requests is
        // the lock test above.)
        $this->partialMock(ImageBurner::class, fn ($mock) => $mock->shouldReceive('burn')->twice()->passthru());

        $this->get(route('pub.picture', ['filename' => $filename]));
        $image->update(['copyright' => 'New Owner']);

        $responses = [];
        for ($i = 0; $i < 5; $i++) {
            $responses[] = $this->get(route('pub.picture', ['filename' => $filename]));
        }

        $expectedBody = $responses[0]->getContent();
        foreach ($responses as $response) {
            $response->assertOk();
            $this->assertSame($expectedBody, $response->getContent());
        }
    }

    public function test_when_lock_is_held_elsewhere_serves_the_existing_stale_cache_instead_of_burning(): void
    {
        $filename = $this->uuidJpgFilename();
        $image = $this->makeItemImage($filename, 'Original Owner');

        $first = $this->get(route('pub.picture', ['filename' => $filename]));
        $staleBody = $first->getContent();
        $staleEtag = $first->headers->get('ETag');

        $image->update(['copyright' => 'New Owner']);

        // Simulate another process already regenerating this exact image by
        // holding the same lock the controller itself acquires.
        $lock = Cache::lock('image-burn:'.$filename, 10);
        $lock->get();

        try {
            $this->partialMock(ImageBurner::class, fn ($mock) => $mock->shouldNotReceive('burn'));

            $response = $this->get(route('pub.picture', ['filename' => $filename]));

            $response->assertOk();
            $this->assertSame($staleBody, $response->getContent());
            // Labelled with the ETag these bytes were burned for, not the
            // current one a client would then keep them under
            $response->assertHeader('ETag', $staleEtag);
            $this->assertNotSame('"'.sha1(ImageBurner::VERSION.'|'.$filename.'|New Owner').'"', $staleEtag);
            $this->assertRevalidatedOnEveryUse($response);
        } finally {
            $lock->release();
        }
    }

    public function test_when_lock_is_held_elsewhere_a_cached_file_without_marker_is_served_uncacheable(): void
    {
        $filename = $this->uuidJpgFilename();
        $this->makeItemImage($filename, 'Original Owner');

        $this->get(route('pub.picture', ['filename' => $filename]))->assertOk();
        $cached = Storage::disk('public')->get('pictures/'.$filename);

        // The marker is gone (cache:clear, optimize:clear, an eviction):
        // nothing says which copyright the cached file was burned with
        Cache::forget('image-copyright-etag:'.$filename);

        $lock = Cache::lock('image-burn:'.$filename, 10);
        $lock->get();

        try {
            $this->partialMock(ImageBurner::class, fn ($mock) => $mock->shouldNotReceive('burn'));

            $response = $this->get(route('pub.picture', ['filename' => $filename]));

            $response->assertOk();
            $this->assertSame($cached, $response->getContent());
            $response->assertHeaderMissing('ETag');
            $this->assertStringContainsString('no-store', (string) $response->headers->get('Cache-Control'));
        } finally {
            $lock->release();
        }
    }

    public function test_when_lock_is_held_elsewhere_and_no_cache_exists_returns_503(): void
    {
        $filename = $this->uuidJpgFilename();
        $this->makeItemImage($filename, 'Original Owner');

        // No prior request yet - nothing on the pictures disk to fall back to.
        Storage::disk('public')->assertMissing('pictures/'.$filename);

        $lock = Cache::lock('image-burn:'.$filename, 10);
        $lock->get();

        try {
            $this->partialMock(ImageBurner::class, fn ($mock) => $mock->shouldNotReceive('burn'));

            $response = $this->get(route('pub.picture', ['filename' => $filename]));

            $response->assertStatus(503);
            $this->assertNotEmpty($response->headers->get('Retry-After'));
        } finally {
            $lock->release();
        }
    }

    // ── Burned or not: *Image models vs PartnerLogo ──────────────────────────

    /**
     * @return array<string, array{class-string<Model>}>
     */
    public static function burnedModelProvider(): array
    {
        return [
            'ItemImage' => [ItemImage::class],
            'CollectionImage' => [CollectionImage::class],
            'PartnerImage' => [PartnerImage::class],
            'PartnerTranslationImage' => [PartnerTranslationImage::class],
            'ContributorImage' => [ContributorImage::class],
            'TimelineEventImage' => [TimelineEventImage::class],
        ];
    }

    /**
     * @param  class-string<Model>  $class
     */
    #[DataProvider('burnedModelProvider')]
    public function test_every_image_model_is_served_burned(string $class): void
    {
        $filename = $this->uuidJpgFilename();
        $this->makeRegisteredImage($class, $filename);

        $response = $this->get(route('pub.picture', ['filename' => $filename]));

        $response->assertOk();
        $this->assertNotSame(base64_decode(self::MINIMAL_JPEG), $response->getContent());
        Storage::disk('public')->assertExists('pictures/'.$filename);
    }

    public function test_a_partner_logo_is_served_as_its_original_and_never_burned(): void
    {
        $this->partialMock(ImageBurner::class, fn ($mock) => $mock->shouldNotReceive('burn'));
        $filename = $this->uuidJpgFilename();
        $this->makeRegisteredImage(PartnerLogo::class, $filename);

        $response = $this->get(route('pub.picture', ['filename' => $filename]));

        $response->assertOk();
        $this->assertSame(base64_decode(self::MINIMAL_JPEG), $response->getContent());
        $response->assertHeader('Content-Type', 'image/jpeg');
        $this->assertNotEmpty($response->headers->get('ETag'));
        $this->assertRevalidatedOnEveryUse($response);
        Storage::disk('public')->assertMissing('pictures/'.$filename);
    }

    public function test_a_partner_logo_answers_a_conditional_request_with_304(): void
    {
        $filename = $this->uuidJpgFilename();
        $this->makeRegisteredImage(PartnerLogo::class, $filename);
        $etag = $this->get(route('pub.picture', ['filename' => $filename]))->headers->get('ETag');

        $response = $this->withHeaders(['If-None-Match' => $etag])
            ->get(route('pub.picture', ['filename' => $filename]));

        $response->assertStatus(304);
        $response->assertHeader('ETag', $etag);
        $this->assertRevalidatedOnEveryUse($response);
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

    // ── Formats and filenames the route accepts ──────────────────────────────

    /**
     * @return array<string, array{string, EncoderInterface, string}>
     */
    public static function rasterFormatProvider(): array
    {
        return [
            'png' => ['png', new PngEncoder, 'image/png'],
            'gif' => ['gif', new GifEncoder, 'image/gif'],
            'webp' => ['webp', new WebpEncoder, 'image/webp'],
            'jpeg' => ['jpeg', new JpegEncoder, 'image/jpeg'],
        ];
    }

    #[DataProvider('rasterFormatProvider')]
    public function test_every_raster_format_is_served_burned_in_its_own_format(string $extension, EncoderInterface $encoder, string $mimeType): void
    {
        $filename = Str::uuid()->toString().'.'.$extension;
        $original = (new ImageManager(new Driver))->create(160, 120)->fill('808080')->encode($encoder)->toString();
        ItemImage::factory()->forItem(Item::factory()->Object()->create())->create(['path' => $filename, 'mime_type' => $mimeType]);
        Storage::disk('image-originals')->put('images/'.$filename, $original);

        $response = $this->get(route('pub.picture', ['filename' => $filename]));

        $response->assertOk();
        $response->assertHeader('Content-Type', $mimeType);
        $this->assertSame($mimeType, (new finfo(FILEINFO_MIME_TYPE))->buffer((string) $response->getContent()));
        $this->assertNotSame($original, $response->getContent());
    }

    /**
     * @return array<string, array{string}>
     */
    public static function uploadedFilenameProvider(): array
    {
        return [
            // Filament's FileUpload: Str::ulid() and the client's extension
            'admin upload' => ['01J8ZKQ3M5X7Y9A2B4C6D8E0FG.JPG'],
            // The API's store(): a 40-character hash name
            'API upload' => ['aB3dE5fG7hJ9kL1mN3pQ5rS7tU9vW1xY3zA5bC7d.jpg'],
        ];
    }

    #[DataProvider('uploadedFilenameProvider')]
    public function test_uploaded_filenames_are_served(string $filename): void
    {
        $this->makeItemImage($filename);

        $this->get(route('pub.picture', ['filename' => $filename]))->assertOk();
    }

    /**
     * @return array<string, array{string}>
     */
    public static function unsupportedFilenameProvider(): array
    {
        return [
            'svg' => ['00000000-0000-0000-0000-000000000000.svg'],
            'bmp' => ['00000000-0000-0000-0000-000000000000.bmp'],
            'no extension' => ['00000000-0000-0000-0000-000000000000'],
            'double extension' => ['00000000-0000-0000-0000-000000000000.jpg.php'],
            'dot in the name' => ['legacy.name.jpg'],
        ];
    }

    #[DataProvider('unsupportedFilenameProvider')]
    public function test_other_filenames_do_not_match_the_route(string $filename): void
    {
        // Registered and on disk, so only the route can turn it away
        $this->makeItemImage($filename);

        $this->get('/pub/'.$filename)->assertNotFound();
    }
}
