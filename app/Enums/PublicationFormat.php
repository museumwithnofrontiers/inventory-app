<?php

namespace App\Enums;

/**
 * The form a PublicationEdition takes (legacy books.type: `book` is print,
 * `digp` is print on demand).
 */
enum PublicationFormat: string
{
    case PRINT = 'print';
    case PRINT_ON_DEMAND = 'print-on-demand';
    case EBOOK = 'ebook';

    public function label(): string
    {
        return match ($this) {
            self::PRINT => 'Print',
            self::PRINT_ON_DEMAND => 'Print on demand',
            self::EBOOK => 'E-book',
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
