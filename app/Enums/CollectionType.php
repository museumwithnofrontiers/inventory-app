<?php

namespace App\Enums;

/**
 * A collection's presentation shape (`collections.type`, #2794). Orthogonal to
 * its purpose ({@see CollectionPurpose}), which says what role it plays in its
 * context.
 */
enum CollectionType: string
{
    case COLLECTION = 'collection';
    case EXHIBITION = 'exhibition';
    case GALLERY = 'gallery';
    case THEME = 'theme';
    case EXHIBITION_TRAIL = 'exhibition trail';
    case ITINERARY = 'itinerary';
    case LOCATION = 'location';
    case SUBTHEME = 'subtheme';
    case REGION = 'region';

    public function label(): string
    {
        return match ($this) {
            self::COLLECTION => 'Collection',
            self::EXHIBITION => 'Exhibition',
            self::GALLERY => 'Gallery',
            self::THEME => 'Theme',
            self::EXHIBITION_TRAIL => 'Exhibition trail',
            self::ITINERARY => 'Itinerary',
            self::LOCATION => 'Location',
            self::SUBTHEME => 'Subtheme',
            self::REGION => 'Region',
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
