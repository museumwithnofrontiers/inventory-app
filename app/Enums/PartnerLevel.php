<?php

namespace App\Enums;

/**
 * Partner Level Enum
 *
 * Defines the different levels of partner contribution to collections.
 * Used in the pivot table relationship between collections and partners
 * (`collection_partner.level`, cast on CollectionPartner, #2796).
 *
 * The first three are a project's tiers (legacy's partner, associated and
 * further associated museums). `material_provider` is legacy's only thematic
 * gallery exhibition partner category, "Other contributor".
 */
enum PartnerLevel: string
{
    case PARTNER = 'partner';
    case ASSOCIATED_PARTNER = 'associated_partner';
    case MINOR_CONTRIBUTOR = 'minor_contributor';
    /** Legacy's exhibition_partner_category 3, "Other contributor". */
    case MATERIAL_PROVIDER = 'material_provider';

    /**
     * Get a human-readable label for the partner level.
     */
    public function label(): string
    {
        return match ($this) {
            self::PARTNER => 'Partner',
            self::ASSOCIATED_PARTNER => 'Associated Partner',
            self::MINOR_CONTRIBUTOR => 'Minor Contributor',
            self::MATERIAL_PROVIDER => 'Material provider',
        };
    }

    /**
     * Get a description for the partner level.
     */
    public function description(): string
    {
        return match ($this) {
            self::PARTNER => 'Partners contributing directly to the collection by providing content',
            self::ASSOCIATED_PARTNER => 'Partners contributing indirectly by supporting the collection',
            self::MINOR_CONTRIBUTOR => 'Partners with minor and indirect contribution to the collection',
            self::MATERIAL_PROVIDER => 'Has made their material available',
        };
    }

    /**
     * Get all available partner levels.
     *
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
