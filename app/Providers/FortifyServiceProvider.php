<?php

namespace App\Providers;

use App\Actions\Fortify\CreateNewUser;
use App\Actions\Fortify\ResetUserPassword;
use App\Actions\Fortify\UpdateUserPassword;
use App\Actions\Fortify\UpdateUserProfileInformation;
use App\Models\User;
use App\Services\SafeTwoFactorAuthenticationProvider;
use Illuminate\Auth\Events\Logout;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;
use Laravel\Fortify\Contracts\TwoFactorAuthenticationProvider;
use Laravel\Fortify\Fortify;

class FortifyServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // The Filament panel has its own login, two-factor, password-reset,
        // registration and profile pages, which call Fortify's actions
        // directly. None of Fortify's routes is needed.
        Fortify::ignoreRoutes();
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Fortify::createUsersUsing(CreateNewUser::class);
        Fortify::updateUserProfileInformationUsing(UpdateUserProfileInformation::class);
        Fortify::updateUserPasswordsUsing(UpdateUserPassword::class);
        Fortify::resetUserPasswordsUsing(ResetUserPassword::class);

        // Register safe two-factor authentication provider to handle invalid base32 secrets
        $this->app->singleton(
            TwoFactorAuthenticationProvider::class,
            SafeTwoFactorAuthenticationProvider::class
        );

        // Listen for logout events to clear remember tokens and 2FA challenge session
        Event::listen(Logout::class, function (Logout $event): void {
            $user = $event->user;
            if ($user instanceof User) {
                $user->setRememberToken('');
                $user->save();
            }

            // Clear 2FA challenge session
            session()->forget('login.id');
        });
    }
}
