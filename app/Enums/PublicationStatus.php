<?php

namespace App\Enums;

/**
 * Whether a Publication is out or still being prepared (legacy
 * bookbase.new = 'I' marks a work in preparation).
 */
enum PublicationStatus: string
{
    case PUBLISHED = 'published';
    case IN_PREPARATION = 'in-preparation';

    public function label(): string
    {
        return match ($this) {
            self::PUBLISHED => 'Published',
            self::IN_PREPARATION => 'In preparation',
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
