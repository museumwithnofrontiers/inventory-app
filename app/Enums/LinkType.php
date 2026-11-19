<?php

namespace App\Enums;

/**
 * What a Link points at (M16 F3, #2653).
 */
enum LinkType: string
{
    case VIDEO = 'video';
    case AUDIO = 'audio';
    case DOCUMENT = 'document';
    case WEBSITE = 'website';
    case SHOP = 'shop';
    case CATALOGUE = 'catalogue';
    case FURTHER_READING = 'further_reading';
    case VIRTUAL_VISIT = 'virtual_visit';

    /**
     * Get the display label for the type.
     */
    public function label(): string
    {
        return match ($this) {
            self::VIDEO => 'Video',
            self::AUDIO => 'Audio',
            self::DOCUMENT => 'Document',
            self::WEBSITE => 'Website',
            self::SHOP => 'Shop',
            self::CATALOGUE => 'Catalogue entry',
            self::FURTHER_READING => 'Further reading',
            self::VIRTUAL_VISIT => 'Virtual visit',
        };
    }

    /**
     * The types as form options, value => label.
     *
     * @return array<string, string>
     */
    public static function options(): array
    {
        return array_combine(
            array_map(fn (self $type): string => $type->value, self::cases()),
            array_map(fn (self $type): string => $type->label(), self::cases()),
        );
    }
}
