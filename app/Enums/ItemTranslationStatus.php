<?php

namespace App\Enums;

/**
 * The editorial state of an item translation (M16 B6). Hidden translations
 * stay out of lists and search; the pages that link them still show them.
 * Legacy's own flag of that kind (Sharing History's display_status N, the
 * records shown only as HB/HCR illustrations) is imported as hidden.
 */
enum ItemTranslationStatus: string
{
    case PUBLISHED = 'published';
    case UNEDITED = 'unedited';
    case HIDDEN = 'hidden';

    public function label(): string
    {
        return match ($this) {
            self::PUBLISHED => 'Published',
            self::UNEDITED => 'Unedited',
            self::HIDDEN => 'Hidden',
        };
    }

    public function color(): string
    {
        return match ($this) {
            self::PUBLISHED => 'success',
            self::UNEDITED => 'warning',
            self::HIDDEN => 'gray',
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
