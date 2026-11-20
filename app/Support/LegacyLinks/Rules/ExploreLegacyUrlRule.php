<?php

namespace App\Support\LegacyLinks\Rules;

use App\Enums\LegacyLinkConfidence;
use App\Models\Collection;
use App\Models\Item;
use App\Support\LegacyLinks\LegacyLink;
use App\Support\LegacyLinks\LegacyReference;
use App\Support\LegacyLinks\Rules\Concerns\BuildsLegacyUrls;
use Illuminate\Database\Eloquent\Model;

class ExploreLegacyUrlRule implements LegacyUrlRule
{
    use BuildsLegacyUrls;

    public function supports(Model $record, LegacyReference $reference): bool
    {
        return $reference->schema === 'mwnf3_explore' && ($record instanceof Collection || $record instanceof Item);
    }

    public function resolve(Model $record, LegacyReference $reference, string $legacyLanguage): array
    {
        if ($record instanceof Collection) {
            return $this->resolveCollection($record, $reference);
        }

        if ($record instanceof Item) {
            return $this->resolveItem($record, $reference);
        }

        return [];
    }

    /** @return array<int, LegacyLink> */
    private function resolveCollection(Collection $collection, LegacyReference $reference): array
    {
        $host = $this->host('explore');

        return match ($reference->table) {
            'thematiccycle' => $reference->hasParts(1)
                ? [
                    LegacyLink::public('Explore theme page', "{$host}/themes/t-{$reference->part(0)}", LegacyLinkConfidence::EXACT, $reference->raw),
                    LegacyLink::backoffice('Explore theme back-office record', $this->backofficeUrl('explore/explore_themes', "1;{$reference->part(0)}"), LegacyLinkConfidence::EXACT, $reference->raw),
                ]
                : [],
            'country' => $reference->hasParts(1)
                ? [
                    LegacyLink::public('Explore country page', "{$host}/countries/c-{$reference->part(0)}", LegacyLinkConfidence::EXACT, $reference->raw),
                    LegacyLink::backoffice('Explore country back-office record', $this->backofficeUrl('explore/explore_country', "1;{$reference->part(0)}"), LegacyLinkConfidence::EXACT, $reference->raw),
                ]
                : [],
            'location' => $this->resolveLocation($collection, $reference),
            'itinerary' => $this->resolveItinerary($collection, $reference),
            'root' => $this->rootLandingLinks('mwnf3_explore', 'Explore home page', $reference),
            default => [],
        };
    }

    /** @return array<int, LegacyLink> */
    private function resolveLocation(Collection $collection, LegacyReference $reference): array
    {
        if (! $reference->hasParts(1)) {
            return [];
        }

        $country = $this->legacyCountryCodeForCollection($collection);

        if ($country === null) {
            return [LegacyLink::diagnostic('Explore location page', LegacyLinkConfidence::REQUIRES_LOOKUP, $reference->raw, 'Location URLs need the parent country code.')];
        }

        return [
            LegacyLink::public('Explore location page', $this->host('explore')."/countries/c-{$country}/l-{$reference->part(0)}", LegacyLinkConfidence::INFERRED, $reference->raw),
            LegacyLink::backoffice('Explore location back-office record', $this->backofficeUrl('explore/explore_locations', "1;{$reference->part(0)}"), LegacyLinkConfidence::EXACT, $reference->raw),
        ];
    }

    /** @return array<int, LegacyLink> */
    private function resolveItinerary(Collection $collection, LegacyReference $reference): array
    {
        if (! $reference->hasParts(1)) {
            return [];
        }

        $country = $this->legacyCountryCodeForCollection($collection);

        if ($country === null) {
            return [LegacyLink::diagnostic('Explore itinerary page', LegacyLinkConfidence::REQUIRES_LOOKUP, $reference->raw, 'Itinerary URLs need country context.')];
        }

        return [
            LegacyLink::public('Explore itinerary page', $this->host('explore')."/itineraries/c-{$country}/i-{$reference->part(0)}", LegacyLinkConfidence::INFERRED, $reference->raw),
            LegacyLink::backoffice('Explore itinerary back-office record', $this->backofficeUrl('explore/explore_itineraries', "1;{$reference->part(0)}"), LegacyLinkConfidence::EXACT, $reference->raw),
        ];
    }

    /** @return array<int, LegacyLink> */
    private function resolveItem(Item $item, LegacyReference $reference): array
    {
        if ($reference->table === 'monument_picture') {
            return $this->resolvePictureParent($item, $reference);
        }

        if ($reference->table !== 'monument' || ! $reference->hasParts(1)) {
            return [];
        }

        $collectionReference = LegacyReference::parse($item->collection?->backward_compatibility);

        if (! $collectionReference?->is('mwnf3_explore', 'location') || ! $collectionReference->hasParts(1) || $item->collection === null) {
            return [LegacyLink::diagnostic('Explore monument page', LegacyLinkConfidence::REQUIRES_LOOKUP, $reference->raw, 'Monument URLs need parent location and country context.')];
        }

        $country = $this->legacyCountryCodeForCollection($item->collection);

        if ($country === null) {
            return [LegacyLink::diagnostic('Explore monument page', LegacyLinkConfidence::REQUIRES_LOOKUP, $reference->raw, 'Monument URLs need parent country context.')];
        }

        return [
            LegacyLink::public('Explore monument page', $this->host('explore')."/countries/c-{$country}/l-{$collectionReference->part(0)}/m-{$reference->part(0)}", LegacyLinkConfidence::INFERRED, $reference->raw),
            LegacyLink::backoffice('Explore monument back-office record', $this->backofficeUrl('explore/explore_monuments', "1;{$reference->part(0)}"), LegacyLinkConfidence::EXACT, $reference->raw),
        ];
    }

    /**
     * A monument picture (mwnf3_explore:monument_picture:<monument>:…) has no
     * page of its own: it resolves to its parent monument.
     *
     * @return array<int, LegacyLink>
     */
    private function resolvePictureParent(Item $picture, LegacyReference $reference): array
    {
        $parent = $picture->parent;
        $parentReference = LegacyReference::parse($parent?->backward_compatibility);

        if ($parent === null || ! $parentReference?->is('mwnf3_explore', 'monument')) {
            return [LegacyLink::diagnostic('Explore monument page', LegacyLinkConfidence::REQUIRES_LOOKUP, $reference->raw, 'Picture URLs need the parent monument.')];
        }

        return array_map(
            fn (LegacyLink $link): LegacyLink => new LegacyLink($link->label.' parent', $link->url, $link->type, $link->url === null ? $link->confidence : LegacyLinkConfidence::INFERRED, $reference->raw, $link->note ?? 'Picture items resolve to the parent legacy record.'),
            $this->resolveItem($parent, $parentReference),
        );
    }
}
