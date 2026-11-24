<?php

namespace App\Filament\Auth;

use App\Filament\Auth\Concerns\RendersAuthForm;
use App\Models\User;
use Filament\Actions\Action;
use Filament\Facades\Filament;
use Filament\Forms\Components\TextInput;
use Filament\Pages\SimplePage;
use Filament\Panel;
use Filament\Schemas\Schema;
use Illuminate\Contracts\Support\Htmlable;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Actions\ConfirmTwoFactorAuthentication;
use Laravel\Fortify\Actions\EnableTwoFactorAuthentication;

/**
 * @property-read Schema $form
 */
class TwoFactorSetup extends SimplePage
{
    use RendersAuthForm;

    protected string $view = 'filament.auth.two-factor-setup';

    /**
     * @var array<string, mixed>|null
     */
    public ?array $data = [];

    public string $step = 'setup';

    public string $qrCodeSvg = '';

    public string $setupKey = '';

    /**
     * @var array<int, string>
     */
    public array $recoveryCodes = [];

    public function mount(): void
    {
        /** @var User $user */
        $user = Auth::guard(Filament::getAuthGuard())->user();

        if (! is_null($user->two_factor_confirmed_at)) {
            $this->redirectIntended(Filament::getUrl());

            return;
        }

        if (empty($user->two_factor_secret)) {
            app(EnableTwoFactorAuthentication::class)($user);
            $user->refresh();
        }

        $this->qrCodeSvg = $user->twoFactorQrCodeSvg();
        $decrypted = decrypt($user->two_factor_secret ?? '');
        $this->setupKey = is_string($decrypted) ? $decrypted : '';
    }

    public function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('code')
                    ->label(__('Authenticator Code'))
                    ->placeholder('000 000')
                    ->required()
                    ->maxLength(8)
                    ->autocomplete('one-time-code')
                    ->autofocus()
                    ->extraInputAttributes(['tabindex' => 1]),
            ])
            ->statePath('data');
    }

    public function confirm(): void
    {
        $data = $this->form->getState();

        /** @var User $user */
        $user = Auth::guard(Filament::getAuthGuard())->user();

        try {
            $codeRaw = $data['code'] ?? null;
            app(ConfirmTwoFactorAuthentication::class)($user, is_string($codeRaw) ? $codeRaw : '');
        } catch (ValidationException) {
            throw ValidationException::withMessages([
                'data.code' => [__('The provided two factor authentication code was invalid.')],
            ]);
        }

        $user->refresh();
        $this->recoveryCodes = $user->recoveryCodes();
        $this->step = 'recovery-codes';
    }

    public function complete(): void
    {
        $this->redirectIntended(Filament::getUrl());
    }

    protected function formSubmitHandler(): string
    {
        return 'confirm';
    }

    /**
     * @return array<Action>
     */
    protected function getFormActions(): array
    {
        return [
            Action::make('confirm')
                ->label(__('Confirm Setup'))
                ->submit('confirm'),
        ];
    }

    public function getTitle(): string|Htmlable
    {
        return __('Set Up Two-Factor Authentication');
    }

    public function getHeading(): string|Htmlable
    {
        return __('Set Up Two-Factor Authentication');
    }

    public static function getSlug(?Panel $panel = null): string
    {
        return 'two-factor-setup';
    }

    public static function getRelativeRouteName(Panel $panel): string
    {
        return 'auth.two-factor-setup';
    }
}
