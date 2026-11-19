<?php

namespace App\Enums;

/**
 * The kinds of link from one collection to another (`collection_collection`,
 * M16 E3). Each is one of legacy's id lists, resolved to collections.
 */
enum CollectionRelationKind: string
{
    /** An Explore itinerary's locations, in its order. */
    case LOCATION = 'location';
    /** An Explore itinerary's territories (regions). */
    case TERRITORY = 'territory';
    /** An Explore region's themes. */
    case THEME = 'theme';
    /** The regions an Explore location also belongs to, besides its parent. */
    case ADDITIONAL_REGION = 'additional_region';
    /** The Travels locations whose introduction is an Explore location's historical background. */
    case HISTORICAL_BACKGROUND = 'historical_background';

    public function label(): string
    {
        return match ($this) {
            self::LOCATION => 'Location',
            self::TERRITORY => 'Territory',
            self::THEME => 'Theme',
            self::ADDITIONAL_REGION => 'Additional region',
            self::HISTORICAL_BACKGROUND => 'Historical background',
        };
    }

    /**
     * @return array<string, string>
     */
    public static function options(): array
    {
        $options = [];
        foreach (self::cases() as $case) {
            $options[$case->value] = $case->label();
        }

        return $options;
    }
}
