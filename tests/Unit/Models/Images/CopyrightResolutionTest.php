<?php

namespace Tests\Unit\Models\Images;

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
use App\Models\Project;
use App\Models\TimelineEvent;
use App\Models\TimelineEventImage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CopyrightResolutionTest extends TestCase
{
    use RefreshDatabase;

    public function test_own_copyright_wins_over_everything(): void
    {
        $project = Project::factory()->create(['copyright' => '© Project']);
        $item = Item::factory()->create(['project_id' => $project->id]);
        $image = ItemImage::factory()->create(['item_id' => $item->id, 'copyright' => '© Own']);

        $this->assertSame('© Own', $image->resolveCopyright());
    }

    public function test_item_image_falls_back_to_its_items_project(): void
    {
        $project = Project::factory()->create(['copyright' => '© Discover Islamic Art']);
        $item = Item::factory()->create(['project_id' => $project->id]);
        $image = ItemImage::factory()->create(['item_id' => $item->id, 'copyright' => null]);

        $this->assertSame('© Discover Islamic Art', $image->resolveCopyright());
    }

    public function test_item_image_falls_back_to_global_default_when_project_has_no_copyright(): void
    {
        $project = Project::factory()->create(['copyright' => null]);
        $item = Item::factory()->create(['project_id' => $project->id]);
        $image = ItemImage::factory()->create(['item_id' => $item->id, 'copyright' => null]);

        $this->assertSame(ItemImage::GLOBAL_FALLBACK, $image->resolveCopyright());
    }

    public function test_item_image_falls_back_to_global_default_when_item_has_no_project(): void
    {
        $item = Item::factory()->create(['project_id' => null]);
        $image = ItemImage::factory()->create(['item_id' => $item->id, 'copyright' => null]);

        $this->assertSame(ItemImage::GLOBAL_FALLBACK, $image->resolveCopyright());
    }

    public function test_partner_image_falls_back_to_its_partners_project(): void
    {
        $project = Project::factory()->create(['copyright' => '© Baroque Art']);
        $partner = Partner::factory()->create(['project_id' => $project->id]);
        $image = PartnerImage::factory()->create(['partner_id' => $partner->id, 'copyright' => null]);

        $this->assertSame('© Baroque Art', $image->resolveCopyright());
    }

    public function test_partner_logo_falls_back_to_its_partners_project(): void
    {
        $project = Project::factory()->create(['copyright' => '© Sharing History']);
        $partner = Partner::factory()->create(['project_id' => $project->id]);
        $logo = PartnerLogo::factory()->create(['partner_id' => $partner->id, 'copyright' => null]);

        $this->assertSame('© Sharing History', $logo->resolveCopyright());
    }

    public function test_partner_translation_image_falls_back_through_partner_translation_to_project(): void
    {
        $project = Project::factory()->create(['copyright' => '© Water in Islam']);
        $partner = Partner::factory()->create(['project_id' => $project->id]);
        $translation = PartnerTranslation::factory()->create(['partner_id' => $partner->id]);
        $image = PartnerTranslationImage::factory()->create([
            'partner_translation_id' => $translation->id,
            'copyright' => null,
        ]);

        $this->assertSame('© Water in Islam', $image->resolveCopyright());
    }

    public function test_collection_image_never_reaches_a_project(): void
    {
        $collection = Collection::factory()->create();
        $image = CollectionImage::factory()->create(['collection_id' => $collection->id, 'copyright' => null]);

        $this->assertSame(CollectionImage::GLOBAL_FALLBACK, $image->resolveCopyright());
    }

    public function test_contributor_image_never_reaches_a_project(): void
    {
        $contributor = Contributor::factory()->create();
        $image = ContributorImage::factory()->create(['contributor_id' => $contributor->id, 'copyright' => null]);

        $this->assertSame(ContributorImage::GLOBAL_FALLBACK, $image->resolveCopyright());
    }

    public function test_timeline_event_image_never_reaches_a_project(): void
    {
        $timelineEvent = TimelineEvent::factory()->create();
        $image = TimelineEventImage::factory()->create(['timeline_event_id' => $timelineEvent->id, 'copyright' => null]);

        $this->assertSame(TimelineEventImage::GLOBAL_FALLBACK, $image->resolveCopyright());
    }
}
