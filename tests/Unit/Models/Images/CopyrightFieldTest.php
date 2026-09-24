<?php

namespace Tests\Unit\Models\Images;

use App\Models\AvailableImage;
use App\Models\CollectionImage;
use App\Models\ContributorImage;
use App\Models\ItemImage;
use App\Models\PartnerImage;
use App\Models\PartnerLogo;
use App\Models\PartnerTranslationImage;
use App\Models\TimelineEventImage;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class CopyrightFieldTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return list<list<class-string<Model>>>
     */
    public static function copyrightBearingModelProvider(): array
    {
        return [
            [AvailableImage::class],
            [ItemImage::class],
            [CollectionImage::class],
            [PartnerImage::class],
            [PartnerTranslationImage::class],
            [ContributorImage::class],
            [TimelineEventImage::class],
            [PartnerLogo::class],
        ];
    }

    #[DataProvider('copyrightBearingModelProvider')]
    public function test_copyright_is_fillable(string $class): void
    {
        $instance = new $class;

        $this->assertContains('copyright', $instance->getFillable());
    }

    #[DataProvider('copyrightBearingModelProvider')]
    public function test_copyright_persists_and_defaults_to_null(string $class): void
    {
        /** @var Model $record */
        $record = $class::factory()->create();

        $this->assertNull($record->fresh()?->getAttribute('copyright'));

        $record->forceFill(['copyright' => '© Test Museum'])->save();

        $this->assertSame('© Test Museum', $record->fresh()?->getAttribute('copyright'));
    }
}
