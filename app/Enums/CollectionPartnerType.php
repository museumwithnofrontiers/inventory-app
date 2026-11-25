<?php

namespace App\Enums;

/**
 * The kind of link a `collection_partner` row is (`collection_type`, #2796).
 * It is part of the row's key: a partner can be linked to the same collection
 * in more than one way.
 */
enum CollectionPartnerType: string
{
    /** The partner takes part in the collection; the panel manages these. */
    case COLLECTION = 'collection';
    /** The importer's link from a partner to a project's root collection, with its tier as the level. */
    case PROJECT = 'project';
    /** A thematic gallery's exhibition partner, on a gallery. */
    case GALLERY = 'gallery';
    /** A thematic gallery's exhibition partner, on an exhibition. */
    case EXHIBITION = 'exhibition';

    public function label(): string
    {
        return match ($this) {
            self::COLLECTION => 'Collection',
            self::PROJECT => 'Project',
            self::GALLERY => 'Gallery',
            self::EXHIBITION => 'Exhibition',
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
