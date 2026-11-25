<?php

namespace App\Enums;

/**
 * A collection's functional role within its context (`collections.purpose`,
 * #2794). Orthogonal to its type ({@see CollectionType}), which describes its
 * presentation shape; null for an ordinary collection.
 *
 * Two kinds of value:
 * - section anchors (`*-root`), unique per context: one per context at most;
 * - roles that repeat, such as `national-context`, any number per context.
 */
enum CollectionPurpose: string
{
    case EXHIBITIONS_ROOT = 'exhibitions-root';
    case ARTISTIC_INTRODUCTION_ROOT = 'artistic-introduction-root';
    case HISTORICAL_PROFILES_ROOT = 'historical-profiles-root';
    case HISTORICAL_BACKGROUND_ROOT = 'historical-background-root';
    case TOPICS_ROOT = 'topics-root';
    case GALLERIES_ROOT = 'galleries-root';
    case TRAVELS_ROOT = 'travels-root';
    case EXPLORE_ROOT = 'explore-root';
    case EXPLORE_THEMES_ROOT = 'explore-themes-root';
    case EXPLORE_COUNTRIES_ROOT = 'explore-countries-root';
    case EXPLORE_ITINERARIES_ROOT = 'explore-itineraries-root';
    case NATIONAL_CONTEXT = 'national-context';

    public function label(): string
    {
        return match ($this) {
            self::EXHIBITIONS_ROOT => 'Exhibitions root',
            self::ARTISTIC_INTRODUCTION_ROOT => 'Artistic introduction root',
            self::HISTORICAL_PROFILES_ROOT => 'Historical profiles root',
            self::HISTORICAL_BACKGROUND_ROOT => 'Historical background root',
            self::TOPICS_ROOT => 'Topics root',
            self::GALLERIES_ROOT => 'Galleries root',
            self::TRAVELS_ROOT => 'Travels root',
            self::EXPLORE_ROOT => 'Explore root',
            self::EXPLORE_THEMES_ROOT => 'Explore themes root',
            self::EXPLORE_COUNTRIES_ROOT => 'Explore countries root',
            self::EXPLORE_ITINERARIES_ROOT => 'Explore itineraries root',
            self::NATIONAL_CONTEXT => 'National context',
        };
    }

    /**
     * A section anchor: at most one collection per context has it.
     */
    public function isSectionRoot(): bool
    {
        return str_ends_with($this->value, '-root');
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
