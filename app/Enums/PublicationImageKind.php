<?php

namespace App\Enums;

/**
 * What a PublicationImage shows: a cover (of the work or of one edition) or
 * a sample page. A column of its own, because the exporters filter on it.
 */
enum PublicationImageKind: string
{
    case COVER = 'cover';
    case PAGE = 'page';

    public function label(): string
    {
        return match ($this) {
            self::COVER => 'Cover',
            self::PAGE => 'Page',
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
