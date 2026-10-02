<?php

namespace App\Filament\Auth;

use App\Models\Setting;
use DanHarrin\LivewireRateLimiting\Exceptions\TooManyRequestsException;
use Filament\Facades\Filament;
use Filament\Forms\Components\Component;
use Filament\Forms\Components\TextInput;
use Filament\Http\Responses\Auth\Contracts\RegistrationResponse;
use Filament\Notifications\Notification;
use Filament\Pages\Auth\Register as BaseRegister;
use Illuminate\Auth\Events\Registered;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Contracts\CreatesNewUsers;

/**
 * Self-registration, open only while the `self_registration_enabled` setting
 * is on.
 *
 * A new account can't enter the panel until its e-mail address is verified
 * and an administrator approves it (User::canAccessPanel), so registering
 * doesn't sign the user in: it sends the verification link and returns to
 * the login page, which explains the state of the account at each attempt.
 */
class Register extends BaseRegister
{
    public static function isOpen(): bool
    {
        return (bool) Setting::get('self_registration_enabled', false);
    }

    public function mount(): void
    {
        if (! static::isOpen()) {
            $this->notifyClosed();
            $this->redirect(Filament::getLoginUrl());

            return;
        }

        parent::mount();
    }

    public function register(): ?RegistrationResponse
    {
        // The setting may have been turned off since the form was opened
        if (! static::isOpen()) {
            $this->notifyClosed();
            $this->redirect(Filament::getLoginUrl());

            return null;
        }

        try {
            $this->rateLimit(2);
        } catch (TooManyRequestsException $exception) {
            $this->getRateLimitedNotification($exception)?->send();

            return null;
        }

        $data = $this->form->getState();

        try {
            $user = app(CreatesNewUsers::class)->create([
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => $data['password'],
                'password_confirmation' => $data['passwordConfirmation'],
            ]);
        } catch (ValidationException $exception) {
            // The action validates the raw input; its keys name this form's fields
            throw ValidationException::withMessages(collect($exception->errors())
                ->mapWithKeys(fn (array $messages, string $key): array => ["data.{$key}" => $messages])
                ->all());
        }

        // Laravel's listener sends the verification link (see AdminPanelProvider)
        event(new Registered($user));

        Notification::make()
            ->success()
            ->title(__('Check your inbox'))
            ->body(__('We have sent you a link to verify your e-mail address. Once it is verified, an administrator will review your account before you can sign in.'))
            ->persistent()
            ->send();

        $this->redirect(Filament::getLoginUrl());

        return null;
    }

    // CreateNewUser hashes the password and checks the confirmation itself,
    // so both fields reach it as typed
    protected function getPasswordFormComponent(): Component
    {
        /** @var TextInput $component */
        $component = parent::getPasswordFormComponent();

        return $component->dehydrateStateUsing(fn (mixed $state): mixed => $state);
    }

    protected function getPasswordConfirmationFormComponent(): Component
    {
        /** @var TextInput $component */
        $component = parent::getPasswordConfirmationFormComponent();

        return $component->dehydrated();
    }

    protected function notifyClosed(): void
    {
        Notification::make()
            ->warning()
            ->title(__('Self-registration is currently disabled. Please contact an administrator.'))
            ->send();
    }
}
