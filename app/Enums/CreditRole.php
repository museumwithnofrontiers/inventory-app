<?php

namespace App\Enums;

/**
 * Credit Role Enum
 *
 * The roles a person is credited with on an item translation. The values
 * match the item_translations FK column each role used to live in alone.
 */
enum CreditRole: string
{
    case AUTHOR = 'author';
    case TEXT_COPY_EDITOR = 'text_copy_editor';
    case TRANSLATOR = 'translator';
    case TRANSLATION_COPY_EDITOR = 'translation_copy_editor';

    /**
     * Get a human-readable label for the role.
     */
    public function label(): string
    {
        return match ($this) {
            self::AUTHOR => 'Author',
            self::TEXT_COPY_EDITOR => 'Text copy editor',
            self::TRANSLATOR => 'Translator',
            self::TRANSLATION_COPY_EDITOR => 'Translation copy editor',
        };
    }

    /**
     * Get all available roles.
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
