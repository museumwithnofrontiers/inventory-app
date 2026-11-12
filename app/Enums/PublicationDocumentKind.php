<?php

namespace App\Enums;

/**
 * What a PublicationDocument is: an edition's sample pages or its credits
 * (legacy books.path_catalogue and books.path_credits).
 */
enum PublicationDocumentKind: string
{
    case SAMPLE = 'sample';
    case CREDITS = 'credits';

    public function label(): string
    {
        return match ($this) {
            self::SAMPLE => 'Sample',
            self::CREDITS => 'Credits',
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
