<?php

namespace Tests\Unit\Traits;

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
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class DeletesImageFilesOnDeleteTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return list<list<class-string<Model>>>
     */
    public static function registeredModelProvider(): array
    {
        return [
            [ItemImage::class],
            [CollectionImage::class],
            [PartnerImage::class],
            [PartnerTranslationImage::class],
            [ContributorImage::class],
            [TimelineEventImage::class],
            [PartnerLogo::class],
        ];
    }

    #[DataProvider('registeredModelProvider')]
    public function test_deleting_removes_both_the_private_original_and_the_public_cache(string $class): void
    {
        Storage::fake('image-originals');
        Storage::fake('public');

        $image = $this->makeImage($class, 'delete-both.jpg');

        $originalPath = trim(config('localstorage.available.images.directory'), '/').'/delete-both.jpg';
        Storage::disk(config('localstorage.available.images.disk'))->put($originalPath, 'original-bytes');

        $picturesDir = trim(config('localstorage.pictures.directory'), '/');
        Storage::disk(config('localstorage.pictures.disk'))->put($picturesDir.'/delete-both.jpg', 'burned-bytes');

        $image->delete();

        Storage::disk(config('localstorage.available.images.disk'))->assertMissing($originalPath);
        Storage::disk(config('localstorage.pictures.disk'))->assertMissing($picturesDir.'/delete-both.jpg');
    }

    #[DataProvider('registeredModelProvider')]
    public function test_deleting_when_no_public_cache_file_exists_does_not_error(string $class): void
    {
        Storage::fake('image-originals');
        Storage::fake('public');

        $image = $this->makeImage($class, 'delete-no-cache.jpg');

        $originalPath = trim(config('localstorage.available.images.directory'), '/').'/delete-no-cache.jpg';
        Storage::disk(config('localstorage.available.images.disk'))->put($originalPath, 'original-bytes');

        // No file ever put on the pictures disk - deletion must still succeed.
        $image->delete();

        $this->assertModelMissing($image);
        Storage::disk(config('localstorage.available.images.disk'))->assertMissing($originalPath);
    }

    /**
     * @param  class-string<Model>  $class
     */
    private function makeImage(string $class, string $path): Model
    {
        return match ($class) {
            ItemImage::class => ItemImage::factory()->create(['item_id' => Item::factory()->create()->id, 'path' => $path]),
            CollectionImage::class => CollectionImage::factory()->create(['collection_id' => Collection::factory()->create()->id, 'path' => $path]),
            PartnerImage::class => PartnerImage::factory()->create(['partner_id' => Partner::factory()->create()->id, 'path' => $path]),
            PartnerTranslationImage::class => PartnerTranslationImage::factory()->create(['partner_translation_id' => PartnerTranslation::factory()->create()->id, 'path' => $path]),
            ContributorImage::class => ContributorImage::factory()->create(['contributor_id' => Contributor::factory()->create()->id, 'path' => $path]),
            TimelineEventImage::class => TimelineEventImage::factory()->create(['timeline_event_id' => TimelineEvent::factory()->create()->id, 'path' => $path]),
            PartnerLogo::class => PartnerLogo::factory()->create(['partner_id' => Partner::factory()->create()->id, 'path' => $path]),
            default => throw new \InvalidArgumentException("Unhandled class: {$class}"),
        };
    }
}
