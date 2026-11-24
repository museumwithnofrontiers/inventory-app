<?php

namespace App\Filament\Auth;

use Filament\Schemas\Schema;
use App\Models\User;
use App\Notifications\AdminPasswordResetNotification;
use DanHarrin\LivewireRateLimiting\Exceptions\TooManyRequestsException;
use DanHarrin\LivewireRateLimiting\WithRateLimiting;
use Filament\Actions\Action;
use Filament\Facades\Filament;
use Filament\Forms\Components\TextInput;
use Filament\Notifications\Notification;
use Filament\Pages\Concerns\InteractsWithFormActions;
use Filament\Pages\SimplePage;
use Illuminate\Auth\Passwords\PasswordBroker;
use Illuminate\Contracts\Support\Htmlable;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Password;

class RequestPasswordReset extends SimplePage
{
    use InteractsWithFormActions;
    use WithRateLimiting;

    protected string $view = 'filament.auth.request-password-reset';

    /**
     * @var array<string, mixed>|null
     */
    public ?array $data = [];

    public function mount(): void
    {
        if (Filament::auth()->check()) {
            $this->redirect(Filament::getUrl());

            return;
        }

        $this->getForm('form')?->fill();
    }

    public function form(Schema $schema): Schema
    {
        return $schema;
    }

    /**
     * @return array<int|string, string|\Filament\Schemas\Schema>
     */
    protected function getForms(): array
    {
        return [
            'form' => $this->form(
                $this->makeForm()
                    ->components([
                        TextInput::make('email')
                            ->label(__('Email address'))
                            ->email()
                            ->required()
                            ->autocomplete('email')
                            ->autofocus(),
                    ])
                    ->statePath('data'),
            ),
        ];
    }

    public function submit(): void
    {
        try {
            $this->rateLimit(5);
        } catch (TooManyRequestsException $exception) {
            $seconds = is_numeric($exception->secondsUntilAvailable) ? (int) $exception->secondsUntilAvailable : 0;
            Notification::make()
                ->title(__('filament-panels::pages/auth/login.notifications.throttled.title', [
                    'seconds' => $seconds,
                    'minutes' => (int) ceil($seconds / 60),
                ]))
                ->danger()
                ->send();

            return;
        }

        $data = $this->getForm('form')?->getState() ?? [];

        $user = User::query()->where('email', $data['email'])->first();

        if ($user) {
            // See UserPasswordResetService for why the concrete broker is named
            // here: the contract stopped declaring createToken() in v12.68.0.
            /** @var PasswordBroker $broker */
            $broker = Password::broker(Config::string('fortify.passwords'));

            $token = $broker->createToken($user);
            $user->notify(new AdminPasswordResetNotification($token));
        }

        Notification::make()
            ->title(__('If an account exists for that email, we have sent a password reset link.'))
            ->success()
            ->send();

        $this->getForm('form')?->fill();
    }

    /**
     * @return array<Action>
     */
    protected function getFormActions(): array
    {
        return [
            Action::make('submit')
                ->label(__('Send reset link'))
                ->submit('submit'),
            Action::make('backToLogin')
                ->label(__('Back to login'))
                ->url(Filament::getLoginUrl())
                ->color('gray')
                ->outlined(),
        ];
    }

    protected function hasFullWidthFormActions(): bool
    {
        return true;
    }

    public function getTitle(): string|Htmlable
    {
        return __('Reset Password');
    }

    public function getHeading(): string|Htmlable
    {
        return __('Forgot your password?');
    }

    public static function getSlug(): string
    {
        return 'forgot-password';
    }

    public static function getRelativeRouteName(): string
    {
        return 'auth.password.request';
    }
}
