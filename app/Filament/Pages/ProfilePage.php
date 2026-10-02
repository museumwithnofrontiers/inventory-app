<?php

namespace App\Filament\Pages;

use App\Actions\Fortify\UpdateUserPassword;
use App\Actions\Fortify\UpdateUserProfileInformation;
use App\Actions\Jetstream\DeleteUser;
use App\Models\User;
use Filament\Actions\Action;
use Filament\Facades\Filament;
use Filament\Forms\Components\Placeholder;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Form;
use Filament\Notifications\Notification;
use Filament\Pages\Auth\EditProfile;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\HtmlString;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Actions\ConfirmTwoFactorAuthentication;
use Laravel\Fortify\Actions\DisableTwoFactorAuthentication;
use Laravel\Fortify\Actions\EnableTwoFactorAuthentication;
use Laravel\Fortify\Actions\GenerateNewRecoveryCodes;
use Laravel\Fortify\Features;

class ProfilePage extends EditProfile
{
    protected static ?string $slug = 'profile';

    public static function canAccess(): bool
    {
        return auth()->check();
    }

    /**
     * Only show name and email on the main profile form.
     * Password change is handled via a dedicated modal action.
     *
     * @return array<int|string, string|Form>
     */
    protected function getForms(): array
    {
        return [
            'form' => $this->form(
                $this->makeForm()
                    ->schema([
                        $this->getNameFormComponent(),
                        $this->getEmailFormComponent(),
                    ])
                    ->operation('edit')
                    ->model($this->getUser())
                    ->statePath('data')
                    ->inlineLabel(! static::isSimple()),
            ),
        ];
    }

    /**
     * Return header actions according to the user's current 2FA state:
     *  - 2FA disabled → show enableTwoFactor
     *  - 2FA enabled  → show regenerateRecoveryCodes + disableTwoFactor
     *
     * @return array<Action>
     */
    protected function getHeaderActions(): array
    {
        /** @var User $user */
        $user = $this->getUser();
        $twoFactorEnabled = $user->hasEnabledTwoFactorAuthentication();

        $twoFactorActions = $twoFactorEnabled
            ? [$this->getRegenerateRecoveryCodesAction(), $this->getDisableTwoFactorAction()]
            : [$this->getEnableTwoFactorAction()];

        return [
            $this->getChangePasswordAction(),
            ...$twoFactorActions,
            $this->getApiTokensAction(),
            $this->getLogoutOtherBrowserSessionsAction(),
            $this->getDeleteAccountAction(),
        ];
    }

    protected function getApiTokensAction(): Action
    {
        return Action::make('apiTokens')
            ->label('API Tokens')
            ->icon('heroicon-o-command-line')
            ->color('gray')
            ->url(ApiTokensPage::getUrl());
    }

    protected function getChangePasswordAction(): Action
    {
        return Action::make('changePassword')
            ->label('Change Password')
            ->icon('heroicon-o-key')
            ->color('warning')
            ->modalHeading('Change Password')
            ->form([
                TextInput::make('current_password')
                    ->label('Current Password')
                    ->password()
                    ->revealable()
                    ->required(),
                TextInput::make('password')
                    ->label('New Password')
                    ->password()
                    ->revealable()
                    ->required()
                    ->confirmed(),
                TextInput::make('password_confirmation')
                    ->label('Confirm New Password')
                    ->password()
                    ->revealable()
                    ->required(),
            ])
            ->action(function (array $data): void {
                /** @var User $user */
                $user = $this->getUser();

                try {
                    $currentPassword = $data['current_password'] ?? '';
                    $password = $data['password'] ?? '';
                    $passwordConfirmation = $data['password_confirmation'] ?? '';
                    app(UpdateUserPassword::class)->update($user, [
                        'current_password' => is_string($currentPassword) ? $currentPassword : '',
                        'password' => is_string($password) ? $password : '',
                        'password_confirmation' => is_string($passwordConfirmation) ? $passwordConfirmation : '',
                    ]);
                } catch (ValidationException $e) {
                    $errors = collect($e->errors())->flatten()->implode(' ');
                    Notification::make()->danger()->title($errors)->send();

                    $this->halt();
                }

                Notification::make()
                    ->success()
                    ->title('Password updated successfully.')
                    ->send();
            });
    }

    protected function getEnableTwoFactorAction(): Action
    {
        return Action::make('enableTwoFactor')
            ->label('Enable Two-Factor Authentication')
            ->icon('heroicon-o-shield-check')
            ->color('success')
            ->modalHeading('Enable Two-Factor Authentication')
            ->modalSubmitActionLabel('Enable & Confirm')
            ->form(function (): array {
                /** @var User $user */
                $user = $this->getUser();

                app(EnableTwoFactorAuthentication::class)($user);
                $user->refresh();

                $qrCodeSvg = $user->twoFactorQrCodeSvg();
                $recoveryCodes = $user->recoveryCodes();

                $fields = [
                    Placeholder::make('qr_code')
                        ->label('Scan this QR code with your authenticator app')
                        ->content(new HtmlString(
                            '<div class="flex justify-center my-2">'.$qrCodeSvg.'</div>'
                        )),
                ];

                if (! empty($recoveryCodes)) {
                    $codesHtml = implode('', array_map(
                        fn (string $code) => '<div class="font-mono">'.e($code).'</div>',
                        $recoveryCodes
                    ));

                    $fields[] = Placeholder::make('recovery_codes')
                        ->label('Recovery Codes — store these somewhere safe')
                        ->content(new HtmlString(
                            '<div class="text-sm space-y-1">'.$codesHtml.'</div>'
                        ));
                }

                if (Features::optionEnabled(Features::twoFactorAuthentication(), 'confirm')) {
                    $fields[] = TextInput::make('totp_code')
                        ->label('Authenticator Code')
                        ->placeholder('000000')
                        ->required()
                        ->maxLength(8);
                }

                return $fields;
            })
            ->action(function (array $data): void {
                /** @var User $user */
                $user = $this->getUser();

                if (Features::optionEnabled(Features::twoFactorAuthentication(), 'confirm')) {
                    try {
                        $totpCode = $data['totp_code'] ?? '';
                        app(ConfirmTwoFactorAuthentication::class)($user, is_string($totpCode) ? $totpCode : '');
                    } catch (ValidationException $e) {
                        app(DisableTwoFactorAuthentication::class)($user);

                        Notification::make()
                            ->danger()
                            ->title('Invalid authenticator code. Two-factor authentication was not enabled.')
                            ->send();

                        $this->halt();
                    }
                }

                Notification::make()
                    ->success()
                    ->title('Two-factor authentication enabled.')
                    ->send();
            });
    }

    protected function getRegenerateRecoveryCodesAction(): Action
    {
        return Action::make('regenerateRecoveryCodes')
            ->label('Regenerate Recovery Codes')
            ->icon('heroicon-o-arrow-path')
            ->color('warning')
            ->requiresConfirmation()
            ->modalHeading('Regenerate Recovery Codes')
            ->modalDescription('Your existing recovery codes will be invalidated. Store the new codes in a safe place.')
            ->action(function (): void {
                /** @var User $user */
                $user = $this->getUser();

                app(GenerateNewRecoveryCodes::class)($user);

                $user->refresh();

                $recoveryCodes = $user->recoveryCodes();

                Notification::make()
                    ->success()
                    ->title('Recovery codes regenerated.')
                    ->body(new HtmlString(
                        '<div class="font-mono text-xs space-y-1">'
                        .implode('', array_map(fn (string $c) => '<div>'.e($c).'</div>', $recoveryCodes))
                        .'</div>'
                    ))
                    ->persistent()
                    ->send();
            });
    }

    protected function getDisableTwoFactorAction(): Action
    {
        return Action::make('disableTwoFactor')
            ->label('Disable Two-Factor Authentication')
            ->icon('heroicon-o-shield-exclamation')
            ->color('danger')
            ->requiresConfirmation()
            ->modalHeading('Disable Two-Factor Authentication')
            ->modalDescription('Are you sure you want to disable two-factor authentication? Your account will be less secure.')
            ->action(function (): void {
                /** @var User $user */
                $user = $this->getUser();

                if ($user->hasSensitivePermissions()) {
                    Notification::make()
                        ->danger()
                        ->title('Two-factor authentication cannot be disabled while you have sensitive permissions (manage users, manage roles, assign roles, or manage settings).')
                        ->send();

                    $this->halt();
                }

                app(DisableTwoFactorAuthentication::class)($user);

                Notification::make()
                    ->success()
                    ->title('Two-factor authentication disabled.')
                    ->send();
            });
    }

    protected function getLogoutOtherBrowserSessionsAction(): Action
    {
        return Action::make('logoutOtherBrowserSessions')
            ->label('Log Out Other Browser Sessions')
            ->icon('heroicon-o-device-phone-mobile')
            ->color('gray')
            ->modalHeading('Log Out Other Browser Sessions')
            ->modalDescription('Please enter your password to confirm you would like to log out of your other browser sessions across all of your devices.')
            ->form([
                TextInput::make('password')
                    ->label('Password')
                    ->password()
                    ->revealable()
                    ->required(),
            ])
            ->action(function (array $data): void {
                /** @var User $user */
                $user = $this->getUser();

                $passwordRaw = $data['password'] ?? '';
                $password = is_string($passwordRaw) ? $passwordRaw : '';
                if (! Hash::check($password, $user->getAuthPassword())) {
                    Notification::make()
                        ->danger()
                        ->title('The provided password does not match your current password.')
                        ->send();

                    $this->halt();
                }

                $guard = Auth::guard(Filament::getAuthGuard());
                $guard->logoutOtherDevices($password);

                $this->deleteOtherSessionRecords();

                Notification::make()
                    ->success()
                    ->title('Other browser sessions have been logged out.')
                    ->send();
            });
    }

    protected function getDeleteAccountAction(): Action
    {
        return Action::make('deleteAccount')
            ->label('Delete Account')
            ->icon('heroicon-o-trash')
            ->color('danger')
            ->requiresConfirmation()
            ->modalHeading('Delete Account')
            ->modalDescription('Once your account is deleted, all of its resources and data will be permanently deleted. This action cannot be undone.')
            ->modalSubmitActionLabel('Permanently Delete Account')
            ->form([
                TextInput::make('password')
                    ->label('Password')
                    ->password()
                    ->revealable()
                    ->required(),
            ])
            ->action(function (array $data): void {
                /** @var User $user */
                $user = $this->getUser();

                $deletePasswordRaw = $data['password'] ?? '';
                $deletePassword = is_string($deletePasswordRaw) ? $deletePasswordRaw : '';
                if (! Hash::check($deletePassword, $user->getAuthPassword())) {
                    Notification::make()
                        ->danger()
                        ->title('The provided password does not match your current password.')
                        ->send();

                    $this->halt();
                }

                Auth::guard(Filament::getAuthGuard())->logout();

                app(DeleteUser::class)->delete($user);

                if (request()->hasSession()) {
                    request()->session()->invalidate();
                    request()->session()->regenerateToken();
                }

                $this->redirect(Filament::getLoginUrl(), navigate: false);
            });
    }

    /**
     * Save profile information (name/email) via Fortify's UpdateUserProfileInformation action.
     *
     * @param  array<string, mixed>  $data
     */
    protected function handleRecordUpdate(Model $record, array $data): Model
    {
        /** @var User $user */
        $user = $record;

        app(UpdateUserProfileInformation::class)->update($user, [
            'name' => $data['name'],
            'email' => $data['email'],
        ]);

        return $user->refresh();
    }

    public function getUser(): Authenticatable&Model
    {
        /** @var User $user */
        $user = Filament::auth()->user();

        return $user;
    }

    /**
     * Delete session records for all other devices from the database session store.
     */
    protected function deleteOtherSessionRecords(): void
    {
        if (config('session.driver') !== 'database') {
            return;
        }

        $sessionConnection = config('session.connection');
        $sessionTable = config('session.table');
        DB::connection(is_string($sessionConnection) ? $sessionConnection : null)->table(is_string($sessionTable) ? $sessionTable : 'sessions')
            ->where('user_id', Auth::guard(Filament::getAuthGuard())->id())
            ->where('id', '!=', request()->session()->getId())
            ->delete();
    }
}
