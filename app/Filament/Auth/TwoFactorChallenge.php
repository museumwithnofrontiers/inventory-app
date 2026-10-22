<?php

namespace App\Filament\Auth;

use App\Models\User;
use App\Services\Filament\Auth\EmailTwoFactorCodeService;
use Filament\Actions\Action;
use Filament\Facades\Filament;
use Filament\Forms\Components\Actions\Action as FormAction;
use Filament\Forms\Components\Actions as FormActions;
use Filament\Forms\Components\Radio;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Form;
use Filament\Forms\Get;
use Filament\Notifications\Notification;
use Filament\Pages\Concerns\InteractsWithFormActions;
use Filament\Pages\SimplePage;
use Illuminate\Contracts\Support\Htmlable;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Contracts\TwoFactorAuthenticationProvider;
use Laravel\Fortify\Fortify;

class TwoFactorChallenge extends SimplePage
{
    use InteractsWithFormActions;

    protected static string $view = 'filament.auth.two-factor-challenge';

    /**
     * @var array<string, mixed>|null
     */
    public ?array $data = [];

    public function mount(): void
    {
        if (! session()->has('filament.admin.2fa.user_id')) {
            $this->redirect(Filament::getLoginUrl());

            return;
        }

        $this->getForm('form')?->fill();
    }

    public function form(Form $form): Form
    {
        return $form;
    }

    /**
     * @return array<int|string, string|Form>
     */
    protected function getForms(): array
    {
        return [
            'form' => $this->form(
                $this->makeForm()
                    ->schema([
                        Radio::make('method')
                            ->label(__('Verification method'))
                            ->options([
                                'totp' => __('Authenticator app'),
                                'recovery' => __('Recovery code'),
                                'email' => __('Email code'),
                            ])
                            ->default('totp')
                            ->inline()
                            ->live(),
                        TextInput::make('code')
                            ->label(__('Authentication Code'))
                            ->placeholder('000 000')
                            ->maxLength(8)
                            ->autocomplete('one-time-code')
                            ->autofocus()
                            ->hidden(fn (Get $get): bool => $get('method') !== 'totp')
                            ->extraInputAttributes(['tabindex' => 1]),
                        TextInput::make('recovery_code')
                            ->label(__('Recovery Code'))
                            ->placeholder('xxxxx-xxxxx')
                            ->hidden(fn (Get $get): bool => $get('method') !== 'recovery')
                            ->extraInputAttributes(['tabindex' => 2]),
                        TextInput::make('email_code')
                            ->label(__('Email Verification Code'))
                            ->placeholder('000000')
                            ->maxLength(6)
                            ->autocomplete('one-time-code')
                            ->hint(__('Enter the code sent to your email address.'))
                            ->hidden(fn (Get $get): bool => $get('method') !== 'email')
                            ->extraInputAttributes(['tabindex' => 3]),
                        FormActions::make([
                            FormAction::make('sendEmailCode')
                                ->label(__('Send code to my email'))
                                ->color('gray')
                                ->outlined()
                                ->action(fn (TwoFactorChallenge $livewire) => $livewire->sendEmailCode()),
                        ])
                            ->hidden(fn (Get $get): bool => $get('method') !== 'email')
                            ->columnSpanFull(),
                    ])
                    ->statePath('data'),
            ),
        ];
    }

    public function sendEmailCode(): void
    {
        $loginIdRaw = session('filament.admin.2fa.user_id');
        $loginId = (is_string($loginIdRaw) || is_int($loginIdRaw)) ? (string) $loginIdRaw : '';

        if ($loginId === '') {
            $this->redirect(Filament::getLoginUrl());

            return;
        }

        $user = User::find($loginId);

        if (! $user) {
            session()->forget(['filament.admin.2fa.user_id', 'filament.admin.2fa.remember', 'filament.admin.2fa.email_challenge_id']);
            $this->redirect(Filament::getLoginUrl());

            return;
        }

        try {
            app(EmailTwoFactorCodeService::class)->send($user);

            Notification::make()
                ->success()
                ->title(__('Verification code sent to your email address.'))
                ->send();
        } catch (\RuntimeException) {
            throw ValidationException::withMessages([
                'data.email_code' => [__('Unable to send verification code. Please try a different verification method.')],
            ]);
        }
    }

    public function submit(): void
    {
        $loginIdRaw = session('filament.admin.2fa.user_id');
        $loginId = (is_string($loginIdRaw) || is_int($loginIdRaw)) ? (string) $loginIdRaw : '';
        $limiterKey = 'two-factor:'.$loginId;
        $maxAttempts = app()->environment('testing') ? 50 : 5;

        if (RateLimiter::tooManyAttempts($limiterKey, $maxAttempts)) {
            $availableIn = RateLimiter::availableIn($limiterKey);

            session()->forget(['filament.admin.2fa.user_id', 'filament.admin.2fa.remember', 'filament.admin.2fa.email_challenge_id']);

            Notification::make()
                ->danger()
                ->title(__('filament-panels::pages/auth/login.notifications.throttled.title', [
                    'seconds' => $availableIn,
                    'minutes' => (int) ceil($availableIn / 60),
                ]))
                ->send();

            $this->redirect(Filament::getLoginUrl());

            return;
        }

        $data = $this->getForm('form')?->getState() ?? [];

        $methodRaw = $data['method'] ?? 'totp';
        $method = is_string($methodRaw) ? $methodRaw : 'totp';

        $codeRaw = $data['code'] ?? null;
        $code = $method === 'totp' ? trim(is_string($codeRaw) ? $codeRaw : '') : '';
        $recoveryCodeRaw = $data['recovery_code'] ?? null;
        $recoveryCode = $method === 'recovery' ? trim(is_string($recoveryCodeRaw) ? $recoveryCodeRaw : '') : '';
        $emailCodeRaw = $data['email_code'] ?? null;
        $emailCode = $method === 'email' ? trim(is_string($emailCodeRaw) ? $emailCodeRaw : '') : '';

        if ($code === '' && $recoveryCode === '' && $emailCode === '') {
            throw ValidationException::withMessages([
                'data.'.$this->fieldForMethod($method) => [__('Please enter your verification code.')],
            ]);
        }

        $user = User::find($loginId);

        if (! $user) {
            session()->forget(['filament.admin.2fa.user_id', 'filament.admin.2fa.remember', 'filament.admin.2fa.email_challenge_id']);
            $this->redirect(Filament::getLoginUrl());

            return;
        }

        $verified = false;

        if ($recoveryCode !== '') {
            /** @var array<int, string> $codes */
            $codes = $user->recoveryCodes();
            $recoveryCodes = collect($codes);
            $matched = $recoveryCodes->first(fn ($rc) => hash_equals($rc, $recoveryCode));

            if ($matched) {
                $user->replaceRecoveryCode($matched);
                $verified = true;
            }
        } elseif ($code !== '') {
            $provider = app(TwoFactorAuthenticationProvider::class);
            $secretRaw = Fortify::currentEncrypter()->decrypt($user->two_factor_secret ?? '');
            $verified = $provider->verify(is_string($secretRaw) ? $secretRaw : '', $code);
        } elseif ($emailCode !== '') {
            $verified = app(EmailTwoFactorCodeService::class)->verify($user, $emailCode);
        }

        if (! $verified) {
            RateLimiter::hit($limiterKey);

            throw ValidationException::withMessages([
                'data.'.$this->fieldForMethod($method) => [$this->errorForMethod($method)],
            ]);
        }

        RateLimiter::clear($limiterKey);

        $guard = Auth::guard(Filament::getAuthGuard());
        $remember = session()->pull('filament.admin.2fa.remember', false);
        $guard->login($user, is_bool($remember) ? $remember : false);

        session()->regenerate();
        session()->forget(['filament.admin.2fa.user_id', 'filament.admin.2fa.email_challenge_id']);

        $this->redirectIntended(Filament::getUrl());
    }

    private function fieldForMethod(string $method): string
    {
        return match ($method) {
            'recovery' => 'recovery_code',
            'email' => 'email_code',
            default => 'code',
        };
    }

    private function errorForMethod(string $method): string
    {
        return match ($method) {
            'email' => __('The provided email verification code was invalid or has expired.'),
            default => __('The provided two factor authentication code was invalid.'),
        };
    }

    /**
     * @return array<Action>
     */
    protected function getFormActions(): array
    {
        return [
            Action::make('submit')
                ->label(__('Verify'))
                ->submit('submit'),
        ];
    }

    protected function hasFullWidthFormActions(): bool
    {
        return true;
    }

    public function getTitle(): string|Htmlable
    {
        return __('Two-Factor Authentication');
    }

    public function getHeading(): string|Htmlable
    {
        return __('Two-Factor Authentication');
    }

    public static function getSlug(): string
    {
        return 'two-factor-challenge';
    }

    public static function getRelativeRouteName(): string
    {
        return 'auth.two-factor-challenge';
    }
}
