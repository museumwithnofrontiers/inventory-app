<?php

namespace App\Enums;

/**
 * What a contributor did for its collection (`contributors.category`, #2795).
 *
 * Two groups, one value per legacy case:
 * - the collection credits, the people behind a collection's texts (M16 I5).
 *   The exporters ship each one in the collection's texts under its value;
 * - the thematic galleries' contributors, one per category of legacy's
 *   `mwnf3_thematic_gallery.contributor_category`, labelled as legacy does.
 */
enum ContributorCategory: string
{
    case AUTHOR = 'author';
    /** The author of a text the collection reuses, such as a Travels itinerary text shown by Explore. */
    case SOURCE_TEXT_AUTHOR = 'source_text_author';
    case PREPARED_BY = 'prepared_by';
    case CURATED_BY = 'curated_by';
    /** An exhibition's block of credit lines. */
    case EXHIBITION_CREDITS = 'exhibition_credits';
    case LOCAL_COORDINATOR = 'local_coordinator';
    case LOCAL_TEAM = 'local_team';
    case PHOTO_BY = 'photo_by';
    /** Legacy category `cooperator`. */
    case IN_COOPERATION_WITH = 'in_cooperation_with';
    /** Legacy category `occasion`. */
    case ON_THE_OCCASION_OF = 'on_the_occasion_of';
    /** Legacy category `partner`. */
    case MAIN_CONTRIBUTORS = 'main_contributors';
    /** Legacy category `sponsor`. */
    case WITH_THE_SUPPORT_OF = 'with_the_support_of';

    public function label(): string
    {
        return match ($this) {
            self::AUTHOR => 'Author',
            self::SOURCE_TEXT_AUTHOR => 'Source text author',
            self::PREPARED_BY => 'Prepared by',
            self::CURATED_BY => 'Curated by',
            self::EXHIBITION_CREDITS => 'Exhibition credits',
            self::LOCAL_COORDINATOR => 'Local coordinator',
            self::LOCAL_TEAM => 'Local team',
            self::PHOTO_BY => 'Photo by',
            self::IN_COOPERATION_WITH => 'In cooperation with',
            self::ON_THE_OCCASION_OF => 'On the occasion of',
            self::MAIN_CONTRIBUTORS => 'Main contributors',
            self::WITH_THE_SUPPORT_OF => 'With the support of',
        };
    }

    /**
     * A collection credit, shipped in the collection's texts; otherwise a
     * thematic gallery contributor.
     */
    public function isCollectionCredit(): bool
    {
        return match ($this) {
            self::IN_COOPERATION_WITH,
            self::ON_THE_OCCASION_OF,
            self::MAIN_CONTRIBUTORS,
            self::WITH_THE_SUPPORT_OF => false,
            default => true,
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
