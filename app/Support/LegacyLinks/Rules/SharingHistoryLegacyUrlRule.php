<?php

namespace App\Support\LegacyLinks\Rules;

use App\Enums\LegacyLinkConfidence;
use App\Models\Collection;
use App\Models\Item;
use App\Models\Partner;
use App\Support\LegacyLinks\LegacyLink;
use App\Support\LegacyLinks\LegacyReference;
use App\Support\LegacyLinks\Rules\Concerns\BuildsLegacyUrls;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Config;

class SharingHistoryLegacyUrlRule implements LegacyUrlRule
{
    use BuildsLegacyUrls;

    public function supports(Model $record, LegacyReference $reference): bool
    {
        return $reference->schema === 'mwnf3_sharing_history'
            && ($record instanceof Item || $record instanceof Collection || $record instanceof Partner);
    }

    public function resolve(Model $record, LegacyReference $reference, string $legacyLanguage): array
    {
        if ($record instanceof Item) {
            return $this->resolveItem($reference, $legacyLanguage);
        }

        if ($record instanceof Collection) {
            return $this->resolveCollection($record, $reference, $legacyLanguage);
        }

        if ($record instanceof Partner) {
            return $this->resolvePartner($record, $reference);
        }

        return [];
    }

    /** @return array<int, LegacyLink> */
    private function resolveItem(LegacyReference $reference, string $legacyLanguage): array
    {
        $type = match ($reference->table) {
            'sh_objects', 'sh_object_images' => 'object',
            'sh_monuments', 'sh_monument_images' => 'monument',
            default => null,
        };

        if ($type === null || ! $reference->hasParts(3)) {
            return [];
        }

        [$project, $country, $number] = array_slice($reference->parts, 0, 3);
        $confidence = str_contains($reference->table, '_images') ? LegacyLinkConfidence::INFERRED : LegacyLinkConfidence::EXACT;
        $note = $confidence === LegacyLinkConfidence::INFERRED ? 'Image items resolve to the parent legacy page.' : null;

        return [
            LegacyLink::public(
                label: "Sharing History {$type} page",
                url: $this->host('sharing_history')."/database_item.php?id={$type};{$project};{$country};{$number};{$legacyLanguage}",
                confidence: $confidence,
                source: $reference->raw,
                note: $note,
            ),
            LegacyLink::backoffice(
                label: "Sharing History {$type} back-office record",
                url: $this->backofficeUrl($type === 'object' ? 'sh/sh_objects' : 'sh/sh_monuments', '1;'.strtoupper($project).";{$country};{$number}"),
                confidence: $confidence,
                source: $reference->raw,
                note: $note,
            ),
        ];
    }

    /** @return array<int, LegacyLink> */
    private function resolveCollection(Collection $collection, LegacyReference $reference, string $legacyLanguage): array
    {
        $host = $this->host('sharing_history');

        return match ($reference->table) {
            'sh_projects' => $reference->hasParts(1)
                ? [
                    LegacyLink::public('Sharing History landing page', "{$host}/index.php", LegacyLinkConfidence::EXACT, $reference->raw),
                    LegacyLink::backoffice('Sharing History project back-office record', $this->backofficeUrl('sh/sh_projects', '1;'.strtoupper((string) $reference->part(0))), LegacyLinkConfidence::EXACT, $reference->raw),
                ]
                : [],
            'sh_exhibitions' => $reference->part(0) === 'root'
                ? $this->resolveRoot($collection, $reference, '/exhibitions/AWE/index.php?lan=', 'Sharing History virtual exhibitions page', $legacyLanguage)
                : $this->resolveExhibition($collection, $reference, $legacyLanguage),
            'sh_exhibition_themes' => $this->resolveThemeCollection($collection, $reference, $legacyLanguage),
            'sh_exhibition_subthemes' => $this->resolveSubthemeCollection($collection, $reference, $legacyLanguage),
            'sh_national_context_exhibitions' => $this->resolveNationalContext($collection, $reference, $legacyLanguage),
            'sh_project_about_historical_background' => $reference->part(0) === 'root'
                ? $this->resolveRoot($collection, $reference, '/historical_background_pages.php?lng=', 'Sharing History historical background page', $legacyLanguage)
                : $this->resolveAboutPage($collection, $reference, $legacyLanguage, 'historical_background'),
            'sh_project_about_topics' => $reference->part(0) === 'root'
                ? $this->resolveRoot($collection, $reference, '/historical_background_readmore.php?lng=', 'Sharing History "read more" page', $legacyLanguage)
                : $this->resolveAboutPage($collection, $reference, $legacyLanguage, 'topics'),
            'sh_countries_historicalbackground' => $reference->part(0) === 'root'
                ? $this->resolveRoot($collection, $reference, '/historical_background_insight.php?lng=', 'Sharing History historical profiles page', $legacyLanguage)
                : $this->resolveHistoricalProfile($collection, $reference, $legacyLanguage),
            'sh_countries_historicalbackground_pages' => $this->resolveHistoricalProfilePage($collection, $reference, $legacyLanguage),
            default => [],
        };
    }

    /**
     * The legacy site shows one Sharing History project only (its PROJECTID,
     * AWE); the records of the other projects have no public page.
     */
    private function isPublicProject(?string $project): bool
    {
        return $project !== null
            && strcasecmp($project, Config::string('legacy.links.sharing_history_project', 'AWE')) === 0;
    }

    private function projectOf(Collection $collection): ?string
    {
        $reference = $this->ancestorReference($collection, 'mwnf3_sharing_history', 'sh_projects');

        return $reference === null ? null : (string) $reference->part(0);
    }

    private function notPublic(LegacyReference $reference, string $label, ?string $project): LegacyLink
    {
        $project = $project === null ? 'unknown' : strtoupper($project);

        return LegacyLink::diagnostic($label, LegacyLinkConfidence::UNSUPPORTED, $reference->raw, "The legacy site shows the AWE project only; this record belongs to project {$project}.");
    }

    /**
     * A marker collection the importer adds (…:root:<project>): the page that
     * lists its children.
     *
     * @return array<int, LegacyLink>
     */
    private function resolveRoot(Collection $collection, LegacyReference $reference, string $path, string $label, string $legacyLanguage): array
    {
        $project = $reference->part(1) ?? $this->projectOf($collection);

        if (! $this->isPublicProject($project)) {
            return [$this->notPublic($reference, $label, $project)];
        }

        return [
            LegacyLink::public($label, $this->host('sharing_history').$path.$legacyLanguage, LegacyLinkConfidence::INFERRED, $reference->raw, 'The marker collection resolves to the page that lists its records.'),
        ];
    }

    /** @return array<int, LegacyLink> */
    private function resolveExhibition(Collection $collection, LegacyReference $reference, string $legacyLanguage): array
    {
        if (! $reference->hasParts(1)) {
            return [];
        }

        $project = $this->projectOf($collection);

        return [
            $this->isPublicProject($project)
                ? LegacyLink::public('Sharing History exhibition page', $this->exhibitionUrl((string) $reference->part(0), $legacyLanguage), LegacyLinkConfidence::EXACT, $reference->raw)
                : $this->notPublic($reference, 'Sharing History exhibition page', $project),
            LegacyLink::backoffice('Sharing History exhibition back-office record', $this->backofficeUrl('sh/sh_exhibitions', "1;{$reference->part(0)}"), LegacyLinkConfidence::EXACT, $reference->raw),
        ];
    }

    private function exhibitionUrl(string $exhibition, string $legacyLanguage): string
    {
        return $this->host('sharing_history')."/exhibitions/AWE/exh_items.php?eId={$exhibition}&lan={$legacyLanguage}";
    }

    /** @return array<int, LegacyLink> */
    private function resolveThemeCollection(Collection $collection, LegacyReference $reference, string $legacyLanguage): array
    {
        $parentReference = LegacyReference::parse($collection->parent?->backward_compatibility);

        if (! $reference->hasParts(1) || ! $parentReference?->is('mwnf3_sharing_history', 'sh_exhibitions') || ! $parentReference->hasParts(1)) {
            return [LegacyLink::diagnostic('Sharing History theme page', LegacyLinkConfidence::REQUIRES_LOOKUP, $reference->raw, 'Theme URLs need the parent exhibition id.')];
        }

        $project = $this->projectOf($collection);

        return [
            $this->isPublicProject($project)
                ? LegacyLink::public('Sharing History exhibition theme page', $this->host('sharing_history')."/exhibitions/AWE/theme_items.php?tId={$reference->part(0)}&lan={$legacyLanguage}", LegacyLinkConfidence::EXACT, $reference->raw)
                : $this->notPublic($reference, 'Sharing History exhibition theme page', $project),
            LegacyLink::backoffice('Sharing History exhibition theme back-office record', $this->backofficeUrl('sh/sh_exhibitions', "2;{$parentReference->part(0)};{$reference->part(0)}"), LegacyLinkConfidence::EXACT, $reference->raw),
        ];
    }

    /** @return array<int, LegacyLink> */
    private function resolveSubthemeCollection(Collection $collection, LegacyReference $reference, string $legacyLanguage): array
    {
        $theme = $collection->parent;
        $themeReference = LegacyReference::parse($theme?->backward_compatibility);
        $exhibitionReference = LegacyReference::parse($theme?->parent?->backward_compatibility);

        if (! $reference->hasParts(1)
            || ! $themeReference?->is('mwnf3_sharing_history', 'sh_exhibition_themes') || ! $themeReference->hasParts(1)
            || ! $exhibitionReference?->is('mwnf3_sharing_history', 'sh_exhibitions') || ! $exhibitionReference->hasParts(1)) {
            return [LegacyLink::diagnostic('Sharing History subtheme page', LegacyLinkConfidence::REQUIRES_LOOKUP, $reference->raw, 'Subtheme URLs need the parent theme and exhibition ids.')];
        }

        $project = $this->projectOf($collection);

        return [
            $this->isPublicProject($project)
                ? LegacyLink::public('Sharing History exhibition subtheme page', $this->host('sharing_history')."/exhibitions/AWE/subtheme_items.php?tId={$themeReference->part(0)}&sId={$reference->part(0)}&lan={$legacyLanguage}", LegacyLinkConfidence::EXACT, $reference->raw)
                : $this->notPublic($reference, 'Sharing History exhibition subtheme page', $project),
            LegacyLink::backoffice('Sharing History exhibition subtheme back-office record', $this->backofficeUrl('sh/sh_exhibitions', "3;{$exhibitionReference->part(0)};{$themeReference->part(0)};{$reference->part(0)}"), LegacyLinkConfidence::EXACT, $reference->raw),
        ];
    }

    /**
     * A national context (sh_national_context_exhibitions:<country>:<exhibition>)
     * has no page of its own: the site shows it with its exhibition.
     *
     * @return array<int, LegacyLink>
     */
    private function resolveNationalContext(Collection $collection, LegacyReference $reference, string $legacyLanguage): array
    {
        if (! $reference->hasParts(2)) {
            return [];
        }

        [$country, $exhibition] = array_slice($reference->parts, 0, 2);
        $project = $this->projectOf($collection);

        return [
            $this->isPublicProject($project)
                ? LegacyLink::public('Sharing History parent exhibition page', $this->exhibitionUrl($exhibition, $legacyLanguage), LegacyLinkConfidence::INFERRED, $reference->raw, 'National contexts have no page of their own; they resolve to their exhibition.')
                : $this->notPublic($reference, 'Sharing History parent exhibition page', $project),
            LegacyLink::backoffice('Sharing History national context back-office record', $this->backofficeUrl('sh/sh_nc_countries', "21;{$country};{$exhibition}"), LegacyLinkConfidence::EXACT, $reference->raw),
        ];
    }

    /**
     * The project's "about" pages: historical background (…:<project>:<page_id>)
     * and its "read more" topics (…:<project>:<topic_id>).
     *
     * @param  'historical_background'|'topics'  $kind
     * @return array<int, LegacyLink>
     */
    private function resolveAboutPage(Collection $collection, LegacyReference $reference, string $legacyLanguage, string $kind): array
    {
        if (! $reference->hasParts(2)) {
            return [];
        }

        $project = strtoupper((string) $reference->part(0));
        $id = (string) $reference->part(1);
        $label = $kind === 'topics' ? 'Sharing History historical background topic' : 'Sharing History historical background page';
        $url = $kind === 'topics'
            ? $this->host('sharing_history')."/about_hb_topics.php?tId={$id}&pId={$project}&lng={$legacyLanguage}"
            : $this->host('sharing_history')."/historical_background_pages.php?page={$id}&lng={$legacyLanguage}";

        return [
            $this->isPublicProject($project)
                ? LegacyLink::public($label, $url, LegacyLinkConfidence::EXACT, $reference->raw)
                : $this->notPublic($reference, $label, $project),
            LegacyLink::backoffice("{$label} back-office record", $this->backofficeUrl('sh/sh_projects', ($kind === 'topics' ? '9' : '8').";{$project};{$id}"), LegacyLinkConfidence::EXACT, $reference->raw),
        ];
    }

    /**
     * A historical profile (sh_countries_historicalbackground:<hb_id>): the
     * site lists it by its country, or as "gn" for the general text, which
     * has no country.
     *
     * @return array<int, LegacyLink>
     */
    private function resolveHistoricalProfile(Collection $collection, LegacyReference $reference, string $legacyLanguage): array
    {
        if (! $reference->hasParts(1)) {
            return [];
        }

        $project = $this->projectOf($collection);
        $country = $this->legacyCountryCode($collection->country);
        $links = [];

        if (! $this->isPublicProject($project)) {
            $links[] = $this->notPublic($reference, 'Sharing History historical profile', $project);
        } elseif ($country === null) {
            $links[] = LegacyLink::public('Sharing History general historical profile', $this->host('sharing_history')."/hb_result.php?country=gn&page=1&lng={$legacyLanguage}", LegacyLinkConfidence::INFERRED, $reference->raw, 'A profile with no country is the general one.');
        } else {
            $links[] = LegacyLink::public('Sharing History historical profile', $this->host('sharing_history')."/hb_result.php?country={$country}&page=1&lng={$legacyLanguage}", LegacyLinkConfidence::EXACT, $reference->raw);
        }

        $links[] = LegacyLink::backoffice('Sharing History historical profile back-office record', $this->backofficeUrl('sh/sh_hb', "1;{$reference->part(0)}"), LegacyLinkConfidence::EXACT, $reference->raw);

        return $links;
    }

    /**
     * A page of a historical profile: hb_result.php addresses it by its
     * 1-based position (legacy lists the pages ORDER BY sort_order, which the
     * importer keeps as display_order).
     *
     * @return array<int, LegacyLink>
     */
    private function resolveHistoricalProfilePage(Collection $collection, LegacyReference $reference, string $legacyLanguage): array
    {
        $profile = $collection->parent;
        $profileReference = LegacyReference::parse($profile?->backward_compatibility);
        $position = $this->siblingPosition($collection, 'mwnf3_sharing_history', 'sh_countries_historicalbackground_pages');

        if ($profile === null || ! $reference->hasParts(1) || ! $profileReference?->is('mwnf3_sharing_history', 'sh_countries_historicalbackground') || ! $profileReference->hasParts(1) || $position === null) {
            return [LegacyLink::diagnostic('Sharing History historical profile page', LegacyLinkConfidence::REQUIRES_LOOKUP, $reference->raw, 'Profile page URLs need the parent profile and the page order.')];
        }

        $project = $this->projectOf($collection);
        $country = $this->legacyCountryCode($profile->country);
        $links = [];

        if (! $this->isPublicProject($project)) {
            $links[] = $this->notPublic($reference, 'Sharing History historical profile page', $project);
        } else {
            $links[] = LegacyLink::public(
                'Sharing History historical profile page',
                $this->host('sharing_history').'/hb_result.php?country='.($country ?? 'gn')."&page={$position}&lng={$legacyLanguage}",
                $country === null ? LegacyLinkConfidence::INFERRED : LegacyLinkConfidence::EXACT,
                $reference->raw,
                $country === null ? 'A profile with no country is the general one.' : null,
            );
        }

        $links[] = LegacyLink::backoffice('Sharing History historical profile page back-office record', $this->backofficeUrl('sh/sh_hb', "3;{$profileReference->part(0)};{$reference->part(0)}"), LegacyLinkConfidence::EXACT, $reference->raw);

        return $links;
    }

    /** @return array<int, LegacyLink> */
    private function resolvePartner(Partner $partner, LegacyReference $reference): array
    {
        if ($reference->table !== 'sh_partners' || ! $reference->hasParts(1)) {
            return [];
        }

        $country = $this->legacyCountryCode($partner->country);

        if ($country === null) {
            return [LegacyLink::diagnostic('Sharing History partner page', LegacyLinkConfidence::REQUIRES_LOOKUP, $reference->raw, 'The partner legacy URL needs a country code.')];
        }

        $project = Config::string('legacy.links.sharing_history_project', 'AWE');
        $partnerCode = strtoupper((string) $reference->part(0));

        return [
            LegacyLink::public(
                label: 'Sharing History partner page',
                url: $this->host('sharing_history')."/pm_partner.php?id={$partnerCode};{$country}&shpro={$project}&",
                confidence: LegacyLinkConfidence::INFERRED,
                source: $reference->raw,
                note: 'Country context comes from the Inventory partner.',
            ),
            LegacyLink::backoffice(
                label: 'Sharing History partner back-office record',
                url: $this->backofficeUrl('sh/sh_partners', '1;'.(string) $reference->part(0)),
                confidence: LegacyLinkConfidence::EXACT,
                source: $reference->raw,
            ),
        ];
    }
}
