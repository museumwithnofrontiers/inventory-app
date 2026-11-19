<?php

namespace App\Enums;

/**
 * Legacy's partner category (M16 D2, decision 7): the six values Sharing
 * History gives its partners, finer than the partner's type.
 */
enum PartnerCategory: string
{
    case MUSEUMS = 'museums';
    case ARCHIVES = 'archives';
    case CULTURAL_HERITAGE_AUTHORITIES = 'culturalheritageauthorities';
    case LIBRARIES = 'libraries';
    case UNIVERSITIES = 'universities';
    case OTHERS = 'others';

    public function label(): string
    {
        return match ($this) {
            self::MUSEUMS => 'Museums',
            self::ARCHIVES => 'Archives',
            self::CULTURAL_HERITAGE_AUTHORITIES => 'Cultural heritage authorities',
            self::LIBRARIES => 'Libraries',
            self::UNIVERSITIES => 'Universities',
            self::OTHERS => 'Others',
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
