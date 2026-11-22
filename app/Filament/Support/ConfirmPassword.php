<?php

namespace App\Filament\Support;

use Filament\Forms\Components\TextInput;

/**
 * The signed-in user's own password, asked again before a sensitive account
 * change: another user's e-mail, password or role, a 2FA reset, a suspension
 * or a deletion. Checked with Laravel's current_password rule and never saved.
 */
final class ConfirmPassword
{
    public const FIELD = 'confirm_current_password';

    public static function field(): TextInput
    {
        return TextInput::make(self::FIELD)
            ->label('Your password')
            ->helperText('Confirm this change with your own password.')
            ->password()
            ->revealable()
            ->required()
            ->currentPassword()
            ->dehydrated(false);
    }
}
