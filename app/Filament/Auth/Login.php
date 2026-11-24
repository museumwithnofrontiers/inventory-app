<?php

namespace App\Filament\Auth;

use App\Models\User;
use DanHarrin\LivewireRateLimiting\Exceptions\TooManyRequestsException;
use Filament\Actions\Action;
use Filament\Auth\Http\Responses\Contracts\LoginResponse;
use Filament\Facades\Filament;
use Filament\Forms\Components\TextInput;
use Filament\Models\Contracts\FilamentUser;
use Filament\Schemas\Components\Component;
use Illuminate\Auth\SessionGuard;
use Illuminate\Contracts\Support\Htmlable;
use Illuminate\Support\Facades\Blade;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\HtmlString;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Features;

class Login extends \Filament\Auth\Pages\Login
{
    private const int VERIFICATION_RESEND_SECONDS = 300;

    public function authenticate(): ?LoginResponse
    {
        try {
            $this->rateLimit(5);
        } catch (TooManyRequestsException $exception) {
            $this->getRateLimitedNotification($exception)?->send();

            return null;
        }

        $data = $this->form->getState();

        $guard = Filament::auth();

        // The panel signs in through its session guard (fortify.guard), the
        // one that has a user provider to check the credentials against
        if (! $guard instanceof SessionGuard) {
            $this->throwFailureValidationException();
        }

        $provider = $guard->getProvider();

        $user = $provider->retrieveByCredentials(['email' => $data['email']]);

        if (! $user || ! $provider->validateCredentials($user, ['password' => $data['password']])) {
            $this->throwFailureValidationException();
        }

        $panel = Filament::getCurrentOrDefaultPanel();

        // A self-registered account goes through these two states before it
        // can enter: the password is right, so its owner learns which one
        if ($user instanceof User && ! $user->hasVerifiedEmail()) {
            $this->throwUnverifiedValidationException($user);
        }

        if ($user instanceof User && $user->approved_at === null) {
            throw ValidationException::withMessages([
                'data.email' => __('Your account is awaiting approval by an administrator.'),
            ]);
        }

        if (! ($user instanceof FilamentUser) || ! $panel || ! $user->canAccessPanel($panel)) {
            $this->throwFailureValidationException();
        }

        /** @var User $user */
        $remember = (bool) ($data['remember'] ?? false);

        if (
            Features::enabled(Features::twoFactorAuthentication()) &&
            ! empty($user->two_factor_secret) &&
            ! is_null($user->two_factor_confirmed_at)
        ) {
            session()->put('filament.admin.2fa.user_id', $user->getKey());
            session()->put('filament.admin.2fa.remember', $remember);

            $this->redirect($panel->route('auth.two-factor-challenge'));

            return null;
        }

        $guard->login($user, $remember);

        if (Features::enabled(Features::twoFactorAuthentication()) && is_null($user->two_factor_confirmed_at)) {
            $this->redirect($panel->route('auth.two-factor-setup'));

            return null;
        }

        return app(LoginResponse::class);
    }

    /**
     * Sends a fresh verification link, at most one per user every few minutes.
     */
    protected function throwUnverifiedValidationException(User $user): never
    {
        $sent = RateLimiter::attempt(
            'verify-email:'.$user->getKey(),
            1,
            fn () => $user->sendEmailVerificationNotification(),
            self::VERIFICATION_RESEND_SECONDS,
        );

        throw ValidationException::withMessages([
            'data.email' => $sent
                ? __('Your e-mail address is not verified yet. We have sent you a new verification link.')
                : __('Your e-mail address is not verified yet. Use the verification link we sent you.'),
        ]);
    }

    public function registerAction(): Action
    {
        return parent::registerAction()->visible(fn (): bool => Register::isOpen());
    }

    /**
     * The "sign up" line, shown only while self-registration is open.
     */
    public function getSubheading(): string|Htmlable|null
    {
        if (! Register::isOpen()) {
            return null;
        }

        return parent::getSubheading();
    }

    protected function getForgotPasswordUrl(): ?string
    {
        return Filament::getCurrentOrDefaultPanel()?->route('auth.password.request');
    }

    protected function getPasswordFormComponent(): Component
    {
        $url = $this->getForgotPasswordUrl();

        return TextInput::make('password')
            ->label(__('filament-panels::auth/pages/login.form.password.label'))
            ->hint($url ? new HtmlString(Blade::render('<x-filament::link :href="$url" tabindex="3"> {{ __(\'filament-panels::auth/pages/login.actions.request_password_reset.label\') }}</x-filament::link>', ['url' => $url])) : null)
            ->password()
            ->revealable(filament()->arePasswordsRevealable())
            ->autocomplete('current-password')
            ->required()
            ->extraInputAttributes(['tabindex' => 2]);
    }
}
