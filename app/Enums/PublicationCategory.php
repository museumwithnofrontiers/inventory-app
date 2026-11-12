<?php

namespace App\Enums;

/**
 * The kind of work a Publication is (legacy books_books_category). One
 * category per work (decision D-P3, #2523).
 */
enum PublicationCategory: string
{
    case EXHIBITION_TRAIL = 'exhibition-trail';
    case VIRTUAL_MUSEUM = 'virtual-museum';
    case EDUCATIONAL = 'educational';
    case GALLERY = 'gallery';
    case OTHER = 'other';

    public function label(): string
    {
        return match ($this) {
            self::EXHIBITION_TRAIL => 'Exhibition trail',
            self::VIRTUAL_MUSEUM => 'Virtual museum',
            self::EDUCATIONAL => 'Educational',
            self::GALLERY => 'Gallery',
            self::OTHER => 'Other',
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
