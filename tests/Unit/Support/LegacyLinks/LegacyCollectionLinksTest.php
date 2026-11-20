<?php

namespace Tests\Unit\Support\LegacyLinks;

use App\Enums\LegacyLinkConfidence;
use App\Enums\LegacyLinkType;
use App\Models\Collection;
use App\Models\Country;
use App\Models\Item;
use App\Models\Partner;
use App\Models\Project;
use App\Services\LegacyUrlResolver;
use App\Support\LegacyLinks\LegacyLink;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The records the importer added for the mwnf3 exhibitions and artistic
 * introduction, the Sharing History exhibitions and "about" pages, monument
 * details, schools and the marker collections.
 */
class LegacyCollectionLinksTest extends TestCase
{
    use RefreshDatabase;

    private LegacyUrlResolver $resolver;

    protected function setUp(): void
    {
        parent::setUp();

        $this->resolver = new LegacyUrlResolver;
    }

    public function test_mwnf3_exhibition_resolves_to_its_folder_and_back_office_record(): void
    {
        $exhibition = $this->collection('mwnf3:exhibitions:10', $this->collection('mwnf3:exhibitions:root'), 1);

        $links = $this->resolver->resolveFor($exhibition)->links;

        $this->assertPublic($links, 'https://islamicart.museumwnf.org/exhibitions/ISL/the_umayyads/index.php?lng=en', LegacyLinkConfidence::EXACT);
        $this->assertBackoffice($links, 'https://virtual-office.museumwnf.org/?section=database/exhibitions&edit=1;10&');
    }

    public function test_mwnf3_exhibition_theme_and_page_resolve_by_their_legacy_position(): void
    {
        $exhibition = $this->collection('mwnf3:exhibitions:46', $this->collection('mwnf3:exhibitions:root:BAR'), 1);
        $this->collection('mwnf3:exhibition_themes:150', $exhibition, 1);
        $theme = $this->collection('mwnf3:exhibition_themes:151', $exhibition, 2);
        $this->collection('mwnf3:exhibition_pages:500', $theme, 1);
        // Legacy's n need not be contiguous: the position counts, not n.
        $page = $this->collection('mwnf3:exhibition_pages:502', $theme, 4);

        $themeLinks = $this->resolver->resolveFor($theme)->links;
        $pageLinks = $this->resolver->resolveFor($page, 'fr')->links;

        $this->assertPublic($themeLinks, 'https://baroqueart.museumwnf.org/exhibitions/BAR/absolutism/exhibition.php?theme=2&page=1&lng=en', LegacyLinkConfidence::EXACT);
        $this->assertBackoffice($themeLinks, 'https://virtual-office.museumwnf.org/?section=database/exhibitions&edit=2;46;151&');
        $this->assertPublic($pageLinks, 'https://baroqueart.museumwnf.org/exhibitions/BAR/absolutism/exhibition.php?theme=2&page=2&lng=fr', LegacyLinkConfidence::EXACT);
        $this->assertBackoffice($pageLinks, 'https://virtual-office.museumwnf.org/?section=database/exhibitions&edit=3;46;151;502&');
    }

    public function test_mwnf3_exhibition_lists_resolve_per_project(): void
    {
        $this->assertPublic($this->resolver->resolveFor($this->collection('mwnf3:exhibitions:root'))->links, 'https://islamicart.museumwnf.org/exhibitions/ISL/index.php?lng=en', LegacyLinkConfidence::EXACT);
        $this->assertPublic($this->resolver->resolveFor($this->collection('mwnf3:exhibitions:root:BAR'))->links, 'https://baroqueart.museumwnf.org/exhibitions/BAR/index.php?lng=en', LegacyLinkConfidence::EXACT);
    }

    public function test_unconfigured_mwnf3_exhibition_returns_a_diagnostic_and_its_back_office_record(): void
    {
        $links = $this->resolver->resolveFor($this->collection('mwnf3:exhibitions:999'))->links;

        $this->assertSame(LegacyLinkType::DIAGNOSTIC, $links[0]->type);
        $this->assertSame(LegacyLinkConfidence::REQUIRES_LOOKUP, $links[0]->confidence);
        $this->assertBackoffice($links, 'https://virtual-office.museumwnf.org/?section=database/exhibitions&edit=1;999&');
    }

    public function test_mwnf3_artistic_introduction_resolves_its_home_themes_and_pages(): void
    {
        $root = $this->collection('mwnf3:artintro:root');
        $artintro = $this->collection('mwnf3:artintros:1', $root);
        $this->collection('mwnf3:artintro_themes:1', $artintro, 1);
        $theme = $this->collection('mwnf3:artintro_themes:2', $artintro, 2);
        $this->collection('mwnf3:artintro_pages:3', $theme, 1);
        $page = $this->collection('mwnf3:artintro_pages:4', $theme, 2);

        $rootLinks = $this->resolver->resolveFor($root)->links;
        $artintroLinks = $this->resolver->resolveFor($artintro)->links;
        $pageLinks = $this->resolver->resolveFor($page)->links;

        $this->assertPublic($rootLinks, 'https://islamicart.museumwnf.org/gai/ISL/index.php?lng=en', LegacyLinkConfidence::INFERRED);
        $this->assertPublic($artintroLinks, 'https://islamicart.museumwnf.org/gai/ISL/index.php?lng=en', LegacyLinkConfidence::EXACT);
        $this->assertBackoffice($artintroLinks, 'https://virtual-office.museumwnf.org/?section=database/artintros&edit=1;1&');
        $this->assertPublic($this->resolver->resolveFor($theme)->links, 'https://islamicart.museumwnf.org/gai/ISL/page.php?theme=2&page=1&lng=en', LegacyLinkConfidence::EXACT);
        $this->assertPublic($pageLinks, 'https://islamicart.museumwnf.org/gai/ISL/page.php?theme=2&page=2&lng=en', LegacyLinkConfidence::EXACT);
        $this->assertBackoffice($pageLinks, 'https://virtual-office.museumwnf.org/?section=database/artintros&edit=3;1;2;4&');
    }

    public function test_mwnf3_page_without_order_returns_a_diagnostic(): void
    {
        $artintro = $this->collection('mwnf3:artintros:1');
        $theme = $this->collection('mwnf3:artintro_themes:2', $artintro);
        $page = $this->collection('mwnf3:artintro_pages:4', $theme, 1);

        $link = $this->resolver->resolveFor($page)->links[0];

        $this->assertSame(LegacyLinkType::DIAGNOSTIC, $link->type);
        $this->assertSame(LegacyLinkConfidence::REQUIRES_LOOKUP, $link->confidence);
    }

    public function test_mwnf3_projects_resolve_to_their_site_and_back_office_record(): void
    {
        $isl = $this->resolver->resolveFor($this->collection('mwnf3:projects:ISL'))->links;
        $ama = $this->resolver->resolveFor($this->collection('mwnf3:projects:AMA'))->links;

        $this->assertPublic($isl, 'https://islamicart.museumwnf.org/index.php', LegacyLinkConfidence::EXACT);
        $this->assertBackoffice($isl, 'https://virtual-office.museumwnf.org/?section=manage/projects&edit=1;ISL&');
        $this->assertSame(LegacyLinkType::DIAGNOSTIC, $ama[0]->type);
        $this->assertBackoffice($ama, 'https://virtual-office.museumwnf.org/?section=manage/projects&edit=1;AMA&');
    }

    public function test_sharing_history_exhibition_theme_and_subtheme_resolve_on_the_awe_site(): void
    {
        $exhibition = $this->collection('mwnf3_sharing_history:sh_exhibitions:2', $this->shRoot('awe', 'sh_exhibitions'));
        $theme = $this->collection('mwnf3_sharing_history:sh_exhibition_themes:7', $exhibition);
        $subtheme = $this->collection('mwnf3_sharing_history:sh_exhibition_subthemes:31', $theme);

        $exhibitionLinks = $this->resolver->resolveFor($exhibition)->links;
        $themeLinks = $this->resolver->resolveFor($theme)->links;
        $subthemeLinks = $this->resolver->resolveFor($subtheme)->links;

        $this->assertPublic($exhibitionLinks, 'https://sharinghistory.museumwnf.org/exhibitions/AWE/exh_items.php?eId=2&lan=en', LegacyLinkConfidence::EXACT);
        $this->assertBackoffice($exhibitionLinks, 'https://virtual-office.museumwnf.org/?section=sh/sh_exhibitions&edit=1;2&');
        $this->assertPublic($themeLinks, 'https://sharinghistory.museumwnf.org/exhibitions/AWE/theme_items.php?tId=7&lan=en', LegacyLinkConfidence::EXACT);
        $this->assertBackoffice($themeLinks, 'https://virtual-office.museumwnf.org/?section=sh/sh_exhibitions&edit=2;2;7&');
        $this->assertPublic($subthemeLinks, 'https://sharinghistory.museumwnf.org/exhibitions/AWE/subtheme_items.php?tId=7&sId=31&lan=en', LegacyLinkConfidence::EXACT);
        $this->assertBackoffice($subthemeLinks, 'https://virtual-office.museumwnf.org/?section=sh/sh_exhibitions&edit=3;2;7;31&');
    }

    public function test_sharing_history_exhibition_of_another_project_has_no_public_page(): void
    {
        $exhibition = $this->collection('mwnf3_sharing_history:sh_exhibitions:14', $this->shRoot('usa', 'sh_exhibitions'));

        $links = $this->resolver->resolveFor($exhibition)->links;

        $this->assertSame(LegacyLinkType::DIAGNOSTIC, $links[0]->type);
        $this->assertStringContainsString('USA', (string) $links[0]->note);
        $this->assertBackoffice($links, 'https://virtual-office.museumwnf.org/?section=sh/sh_exhibitions&edit=1;14&');
    }

    public function test_sharing_history_national_context_resolves_to_its_exhibition(): void
    {
        $exhibition = $this->collection('mwnf3_sharing_history:sh_exhibitions:2', $this->shRoot('awe', 'sh_exhibitions'));
        $context = $this->collection('mwnf3_sharing_history:sh_national_context_exhibitions:eg:2', $exhibition);

        $links = $this->resolver->resolveFor($context)->links;

        $this->assertPublic($links, 'https://sharinghistory.museumwnf.org/exhibitions/AWE/exh_items.php?eId=2&lan=en', LegacyLinkConfidence::INFERRED);
        $this->assertBackoffice($links, 'https://virtual-office.museumwnf.org/?section=sh/sh_nc_countries&edit=21;eg;2&');
    }

    public function test_sharing_history_about_pages_and_their_roots(): void
    {
        $backgroundRoot = $this->shRoot('awe', 'sh_project_about_historical_background');
        $background = $this->collection('mwnf3_sharing_history:sh_project_about_historical_background:awe:2', $backgroundRoot, 2);
        $topicsRoot = $this->collection('mwnf3_sharing_history:sh_project_about_topics:root:awe', $backgroundRoot);
        $topic = $this->collection('mwnf3_sharing_history:sh_project_about_topics:awe:3', $topicsRoot, 3);

        $backgroundLinks = $this->resolver->resolveFor($background)->links;
        $topicLinks = $this->resolver->resolveFor($topic)->links;

        $this->assertPublic($backgroundLinks, 'https://sharinghistory.museumwnf.org/historical_background_pages.php?page=2&lng=en', LegacyLinkConfidence::EXACT);
        $this->assertBackoffice($backgroundLinks, 'https://virtual-office.museumwnf.org/?section=sh/sh_projects&edit=8;AWE;2&');
        $this->assertPublic($topicLinks, 'https://sharinghistory.museumwnf.org/about_hb_topics.php?tId=3&pId=AWE&lng=en', LegacyLinkConfidence::EXACT);
        $this->assertBackoffice($topicLinks, 'https://virtual-office.museumwnf.org/?section=sh/sh_projects&edit=9;AWE;3&');
        $this->assertPublic($this->resolver->resolveFor($backgroundRoot)->links, 'https://sharinghistory.museumwnf.org/historical_background_pages.php?lng=en', LegacyLinkConfidence::INFERRED);
        $this->assertPublic($this->resolver->resolveFor($topicsRoot)->links, 'https://sharinghistory.museumwnf.org/historical_background_readmore.php?lng=en', LegacyLinkConfidence::INFERRED);
    }

    public function test_sharing_history_historical_profiles_resolve_by_country(): void
    {
        $country = Country::factory()->create(['id' => 'rou', 'backward_compatibility' => 'rm']);
        $root = $this->shRoot('awe', 'sh_countries_historicalbackground');
        $profile = $this->collection('mwnf3_sharing_history:sh_countries_historicalbackground:6', $root, null, ['country_id' => $country->id]);
        $general = $this->collection('mwnf3_sharing_history:sh_countries_historicalbackground:1', $root->parent);

        $profileLinks = $this->resolver->resolveFor($profile)->links;

        $this->assertPublic($profileLinks, 'https://sharinghistory.museumwnf.org/hb_result.php?country=rm&page=1&lng=en', LegacyLinkConfidence::EXACT);
        $this->assertBackoffice($profileLinks, 'https://virtual-office.museumwnf.org/?section=sh/sh_hb&edit=1;6&');
        $this->assertPublic($this->resolver->resolveFor($general)->links, 'https://sharinghistory.museumwnf.org/hb_result.php?country=gn&page=1&lng=en', LegacyLinkConfidence::INFERRED);
        $this->assertPublic($this->resolver->resolveFor($root)->links, 'https://sharinghistory.museumwnf.org/historical_background_insight.php?lng=en', LegacyLinkConfidence::INFERRED);
    }

    public function test_sharing_history_exhibitions_root_resolves_per_project(): void
    {
        $this->assertPublic($this->resolver->resolveFor($this->shRoot('awe', 'sh_exhibitions'))->links, 'https://sharinghistory.museumwnf.org/exhibitions/AWE/index.php?lan=en', LegacyLinkConfidence::INFERRED);
        $this->assertSame(LegacyLinkType::DIAGNOSTIC, $this->resolver->resolveFor($this->shRoot('rus', 'sh_exhibitions'))->links[0]->type);
    }

    public function test_marker_collections_resolve_to_their_site_landing_page(): void
    {
        $cases = [
            'mwnf3_explore:root' => 'https://explore.museumwnf.org/',
            'mwnf3_explore:root:explore_by_country' => 'https://explore.museumwnf.org/',
            'mwnf3_travels:root' => 'https://travels.museumwnf.org/',
            'mwnf3_thematic_gallery:galleries_root' => 'https://galleries.museumwnf.org/',
            'mwnf3_thematic_gallery:exhibitions_root' => 'https://exhibitions.museumwnf.org/index.php/en/',
        ];

        foreach ($cases as $key => $url) {
            $this->assertPublic($this->resolver->resolveFor($this->collection($key))->links, $url, LegacyLinkConfidence::INFERRED);
        }
    }

    public function test_monument_details_and_their_pictures_resolve_to_the_parent_monument(): void
    {
        $detail = Item::factory()->Monument()->create(['backward_compatibility' => 'mwnf3:monument_details:BAR:at:Mon11:1:1']);
        $picture = Item::factory()->Picture()->create(['backward_compatibility' => 'mwnf3:monument_detail_pictures:BAR:at:Mon11:1:1:2']);

        foreach ([$detail, $picture] as $item) {
            $links = $this->resolver->resolveFor($item)->links;

            $this->assertPublic($links, 'https://baroqueart.museumwnf.org/database_item.php?id=monument;BAR;at;Mon11;1;en', LegacyLinkConfidence::INFERRED);
            $this->assertBackoffice($links, 'https://virtual-office.museumwnf.org/?section=database/dba_monuments&edit=1;BAR;at;Mon11;1&');
        }
    }

    public function test_picture_with_lower_case_project_code_resolves_on_the_project_site(): void
    {
        $picture = Item::factory()->Picture()->create(['backward_compatibility' => 'mwnf3:objects_pictures:bar:cz:Mus11_A:28:1']);

        $links = $this->resolver->resolveFor($picture)->links;

        $this->assertPublic($links, 'https://baroqueart.museumwnf.org/database_item.php?id=object;BAR;cz;Mus11_A;28;en', LegacyLinkConfidence::INFERRED);
        $this->assertBackoffice($links, 'https://virtual-office.museumwnf.org/?section=database/dba_objects&edit=1;BAR;cz;Mus11_A;28&');
    }

    public function test_custom_exhibition_picture_resolves_to_the_page_that_places_it(): void
    {
        $exhibition = $this->collection('mwnf3:exhibitions:10', $this->collection('mwnf3:exhibitions:root'), 1);
        $theme = $this->collection('mwnf3:exhibition_themes:7', $exhibition, 1);
        $page = $this->collection('mwnf3:exhibition_pages:9', $theme, 1);
        $picture = Item::factory()->Object()->create(['backward_compatibility' => 'mwnf3:exhibition_custom_pictures:custom/exhibition/127.jpg']);
        $unplaced = Item::factory()->Object()->create(['backward_compatibility' => 'mwnf3:exhibition_page_image_details:61']);
        $page->attachedItems()->attach($picture->id);

        $this->assertPublic($this->resolver->resolveFor($picture)->links, 'https://islamicart.museumwnf.org/exhibitions/ISL/the_umayyads/exhibition.php?theme=1&page=1&lng=en', LegacyLinkConfidence::INFERRED);
        $this->assertSame(LegacyLinkType::DIAGNOSTIC, $this->resolver->resolveFor($unplaced)->links[0]->type);
    }

    public function test_sharing_history_historical_profile_page_resolves_by_position(): void
    {
        $country = Country::factory()->create(['id' => 'aut', 'backward_compatibility' => 'at']);
        $profile = $this->collection('mwnf3_sharing_history:sh_countries_historicalbackground:2', $this->shRoot('awe', 'sh_countries_historicalbackground'), null, ['country_id' => $country->id]);
        $this->collection('mwnf3_sharing_history:sh_countries_historicalbackground_pages:4', $profile, 1);
        $page = $this->collection('mwnf3_sharing_history:sh_countries_historicalbackground_pages:60', $profile, 4);

        $links = $this->resolver->resolveFor($page)->links;

        $this->assertPublic($links, 'https://sharinghistory.museumwnf.org/hb_result.php?country=at&page=2&lng=en', LegacyLinkConfidence::EXACT);
        $this->assertBackoffice($links, 'https://virtual-office.museumwnf.org/?section=sh/sh_hb&edit=3;2;60&');
    }

    public function test_travels_monument_and_its_picture_resolve_to_the_itinerary_page(): void
    {
        $monument = Item::factory()->Monument()->create(['backward_compatibility' => 'mwnf3_travels:monument:IAM:sy:1:VI:1:h']);
        $picture = Item::factory()->Picture()->withParent($monument)->create(['backward_compatibility' => 'mwnf3_travels:monument_picture:iam:sy:1:vi:1:h:_:2']);

        foreach ([$monument, $picture] as $item) {
            $links = $this->resolver->resolveFor($item)->links;

            $this->assertPublic($links, 'https://travels.museumwnf.org/travel_et_itenary.php?id=IAM;sy;VI;en;1&fl=des', LegacyLinkConfidence::INFERRED);
            $this->assertBackoffice($links, 'https://virtual-office.museumwnf.org/?section=travel/trails&edit=2;IAM;sy;1;VI&');
        }
    }

    public function test_explore_monument_picture_resolves_to_its_monument(): void
    {
        $country = Country::factory()->create(['id' => 'egy', 'backward_compatibility' => 'eg']);
        $location = $this->collection('mwnf3_explore:location:2', null, null, ['country_id' => $country->id]);
        $monument = Item::factory()->Monument()->create(['backward_compatibility' => 'mwnf3_explore:monument:1406', 'collection_id' => $location->id]);
        $picture = Item::factory()->Picture()->withParent($monument)->create(['backward_compatibility' => 'mwnf3_explore:monument_picture:1406:_:1']);

        $links = $this->resolver->resolveFor($picture)->links;

        $this->assertPublic($links, 'https://explore.museumwnf.org/countries/c-eg/l-2/m-1406', LegacyLinkConfidence::INFERRED);
        $this->assertBackoffice($links, 'https://virtual-office.museumwnf.org/?section=explore/explore_monuments&edit=1;1406&');
    }

    public function test_explore_location_under_a_region_takes_the_country_above_it(): void
    {
        $country = $this->collection('mwnf3_explore:country:es');
        $region = $this->collection('mwnf3_explore:region:5', $country);
        $location = $this->collection('mwnf3_explore:location:433', $region);

        $this->assertPublic($this->resolver->resolveFor($location)->links, 'https://explore.museumwnf.org/countries/c-es/l-433', LegacyLinkConfidence::INFERRED);
    }

    public function test_partner_project_with_a_legacy_key_resolves_its_project_code(): void
    {
        $project = Project::factory()->create(['backward_compatibility' => 'mwnf3:projects:ISL']);
        $partner = Partner::factory()->Museum()->create(['backward_compatibility' => 'mwnf3:museums:Mus01:eg', 'project_id' => $project->id]);

        $this->assertPublic($this->resolver->resolveFor($partner)->links, 'https://islamicart.museumwnf.org/pm_partner.php?id=Mus01;eg&type=museum&theme=ISL', LegacyLinkConfidence::INFERRED);
    }

    public function test_school_resolves_to_its_back_office_record(): void
    {
        $school = Partner::factory()->School()->create(['backward_compatibility' => 'mwnf3:schools:Sch01:it']);

        $links = $this->resolver->resolveFor($school)->links;

        $this->assertSame(LegacyLinkType::DIAGNOSTIC, $links[0]->type);
        $this->assertBackoffice($links, 'https://virtual-office.museumwnf.org/?section=database/school&edit=1;Sch01;it&');
    }

    /** @param  array<string, mixed>  $attributes */
    private function collection(string $backwardCompatibility, ?Collection $parent = null, ?int $displayOrder = null, array $attributes = []): Collection
    {
        return Collection::factory()->create(array_merge([
            'backward_compatibility' => $backwardCompatibility,
            'parent_id' => $parent?->id,
            'display_order' => $displayOrder,
        ], $attributes));
    }

    /** A Sharing History project and one of the marker collections the importer puts under it. */
    private function shRoot(string $project, string $table): Collection
    {
        $projectCollection = Collection::query()->where('backward_compatibility', "mwnf3_sharing_history:sh_projects:{$project}")->first()
            ?? $this->collection("mwnf3_sharing_history:sh_projects:{$project}");

        return $this->collection("mwnf3_sharing_history:{$table}:root:{$project}", $projectCollection);
    }

    /** @param  array<int, LegacyLink>  $links */
    private function assertPublic(array $links, string $expectedUrl, LegacyLinkConfidence $confidence): void
    {
        $matching = array_values(array_filter(
            $links,
            fn (LegacyLink $link): bool => $link->type === LegacyLinkType::PUBLIC && $link->url === $expectedUrl,
        ));

        $this->assertNotEmpty($matching, "No public link {$expectedUrl} in: ".json_encode(array_map(fn (LegacyLink $link): array => $link->toArray(), $links)));
        $this->assertSame($confidence, $matching[0]->confidence);
    }

    /** @param  array<int, LegacyLink>  $links */
    private function assertBackoffice(array $links, string $expectedUrl): void
    {
        $this->assertContains($expectedUrl, array_map(
            fn (LegacyLink $link): ?string => $link->type === LegacyLinkType::BACKOFFICE ? $link->url : null,
            $links,
        ));
    }
}
