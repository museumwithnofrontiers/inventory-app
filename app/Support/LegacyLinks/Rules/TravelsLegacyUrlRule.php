<?php

namespace App\Support\LegacyLinks\Rules;

use App\Enums\LegacyLinkConfidence;
use App\Models\Collection;
use App\Models\Item;
use App\Support\LegacyLinks\LegacyLink;
use App\Support\LegacyLinks\LegacyReference;
use App\Support\LegacyLinks\Rules\Concerns\BuildsLegacyUrls;
use Illuminate\Database\Eloquent\Model;

class TravelsLegacyUrlRule implements LegacyUrlRule
{
    use BuildsLegacyUrls;

    public function supports(Model $record, LegacyReference $reference): bool
    {
        return ($record instanceof Collection || $record instanceof Item) && $reference->schema === 'mwnf3_travels';
    }

    public function resolve(Model $record, LegacyReference $reference, string $legacyLanguage): array
    {
        if ($record instanceof Item) {
            return $this->resolveMonument($record, $reference, $legacyLanguage);
        }

        return match ($reference->table) {
            'trail' => $this->resolveTrail($reference, $legacyLanguage),
            'itinerary' => $this->resolveItinerary($reference, $legacyLanguage),
            'location' => $this->resolveLocation($reference, $legacyLanguage),
            'root' => $this->rootLandingLinks('mwnf3_travels', 'Travels home page', $reference),
            default => [],
        };
    }

    /**
     * A monument (…:theme:country:trail:itinerary:location:number) or one of
     * its pictures has no page of its own: the itinerary page lists it.
     *
     * @return array<int, LegacyLink>
     */
    private function resolveMonument(Item $item, LegacyReference $reference, string $legacyLanguage): array
    {
        if ($reference->table === 'monument_picture') {
            // Picture keys carry the ids in lower case; the parent monument's key keeps legacy's case.
            $parentReference = LegacyReference::parse($item->parent?->backward_compatibility);
            $reference = $parentReference !== null && $parentReference->is('mwnf3_travels', 'monument') ? $parentReference : $reference;
        } elseif ($reference->table !== 'monument') {
            return [];
        }

        return array_map(
            fn (LegacyLink $link): LegacyLink => new LegacyLink(
                $link->type->value === 'backoffice' ? 'Travels parent itinerary back-office record' : 'Travels parent itinerary page',
                $link->url,
                $link->type,
                LegacyLinkConfidence::INFERRED,
                (string) $item->backward_compatibility,
                'Travels monuments have no page of their own; they resolve to the itinerary page that lists them.'
            ),
            $this->resolveItinerary($reference, $legacyLanguage),
        );
    }

    /** @return array<int, LegacyLink> */
    private function resolveTrail(LegacyReference $reference, string $legacyLanguage): array
    {
        if (! $reference->hasParts(3)) {
            return [];
        }

        [$theme, $country, $trail] = array_slice($reference->parts, 0, 3);

        return [
            LegacyLink::public('Travels trail page', $this->host('travels')."/travel_et_trailDetail.php?id={$theme};{$country};{$trail};{$legacyLanguage}&fl=its", LegacyLinkConfidence::EXACT, $reference->raw),
            LegacyLink::backoffice('Travels trail back-office record', $this->backofficeUrl('travel/trails', "1;{$theme};{$country};{$trail}"), LegacyLinkConfidence::EXACT, $reference->raw),
        ];
    }

    /** @return array<int, LegacyLink> */
    private function resolveItinerary(LegacyReference $reference, string $legacyLanguage): array
    {
        if (! $reference->hasParts(4)) {
            return [];
        }

        [$theme, $country, $trail, $itinerary] = array_slice($reference->parts, 0, 4);

        return [
            LegacyLink::public('Travels itinerary page', $this->host('travels')."/travel_et_itenary.php?id={$theme};{$country};{$itinerary};{$legacyLanguage};{$trail}&fl=des", LegacyLinkConfidence::EXACT, $reference->raw),
            LegacyLink::backoffice('Travels itinerary back-office record', $this->backofficeUrl('travel/trails', "2;{$theme};{$country};{$trail};{$itinerary}"), LegacyLinkConfidence::EXACT, $reference->raw),
        ];
    }

    /** @return array<int, LegacyLink> */
    private function resolveLocation(LegacyReference $reference, string $legacyLanguage): array
    {
        $links = $this->resolveItinerary($reference, $legacyLanguage);

        return array_map(
            fn (LegacyLink $link): LegacyLink => new LegacyLink(
                $link->type->value === 'backoffice' ? 'Travels parent itinerary back-office record' : 'Travels parent itinerary page',
                $link->url,
                $link->type,
                LegacyLinkConfidence::INFERRED,
                $reference->raw,
                'Location collections resolve to the parent itinerary record.'
            ),
            $links,
        );
    }
}
