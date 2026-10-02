<?php

namespace App\Providers\Filament;

use App\Filament\Auth\Login;
use App\Filament\Auth\PasswordResetMfaChallenge;
use App\Filament\Auth\Register;
use App\Filament\Auth\RequestPasswordReset;
use App\Filament\Auth\ResetPassword;
use App\Filament\Auth\TwoFactorChallenge;
use App\Filament\Auth\TwoFactorSetup;
use App\Filament\Pages\ApiTokensPage;
use App\Filament\Pages\Dashboard;
use App\Filament\Pages\ProfilePage;
use App\Filament\Pages\ViewCollectionItemAppearance;
use App\Http\Controllers\Filament\AvailableImageController as FilamentAvailableImageController;
use App\Http\Controllers\Filament\CollectionImageController as FilamentCollectionImageController;
use App\Http\Controllers\Filament\ItemDocumentController as FilamentItemDocumentController;
use App\Http\Controllers\Filament\ItemImageController as FilamentItemImageController;
use App\Http\Controllers\Filament\PartnerImageController as FilamentPartnerImageController;
use App\Http\Controllers\Filament\PartnerTranslationImageController as FilamentPartnerTranslationImageController;
use App\Http\Controllers\Filament\TimelineEventImageController as FilamentTimelineEventImageController;
use App\Http\Controllers\Filament\VerifyEmailController;
use App\Http\Middleware\Filament\EnsureTwoFactorEnrolled;
use Filament\Enums\ThemeMode;
use Filament\Http\Middleware\Authenticate;
use Filament\Http\Middleware\AuthenticateSession;
use Filament\Http\Middleware\DisableBladeIconComponents;
use Filament\Http\Middleware\DispatchServingFilamentEvent;
use Filament\Navigation\MenuItem;
use Filament\Navigation\NavigationGroup;
use Filament\Panel;
use Filament\PanelProvider;
use Filament\Support\Colors\Color;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\HtmlString;
use Illuminate\View\Middleware\ShareErrorsFromSession;
use Livewire\Livewire;

class AdminPanelProvider extends PanelProvider
{
    public function boot(): void
    {
        Livewire::component('app.filament.auth.two-factor-challenge', TwoFactorChallenge::class);
        Livewire::component('app.filament.auth.two-factor-setup', TwoFactorSetup::class);
        Livewire::component('app.filament.auth.request-password-reset', RequestPasswordReset::class);
        Livewire::component('app.filament.auth.reset-password', ResetPassword::class);
        Livewire::component('app.filament.auth.password-reset-mfa-challenge', PasswordResetMfaChallenge::class);

        // Every verification message links to the panel's own route: the one
        // Laravel sends on registration, the one an administrator resends from
        // the user list, and the one a changed address triggers on the profile
        VerifyEmail::createUrlUsing(fn (MustVerifyEmail&Model $notifiable): string => URL::temporarySignedRoute(
            'filament.admin.auth.verify-email',
            now()->addMinutes(Config::integer('auth.verification.expire', 60)),
            [
                'id' => $notifiable->getKey(),
                'hash' => sha1($notifiable->getEmailForVerification()),
            ],
        ));
    }

    private const LIGHT_LOGO_CLASSES = 'h-full w-auto text-blue-900';

    private const DARK_LOGO_CLASSES = 'h-full w-auto text-indigo-200';

    public function panel(Panel $panel): Panel
    {
        $panel = $panel
            ->default()
            ->id('admin')
            ->path('admin')
            ->login(Login::class)
            ->registration(Register::class)
            ->profile(ProfilePage::class, isSimple: false)
            ->userMenuItems([
                MenuItem::make()
                    ->label('Profile')
                    ->icon('heroicon-o-user-circle')
                    ->url(fn () => ProfilePage::getUrl()),
                MenuItem::make()
                    ->label('API Tokens')
                    ->icon('heroicon-o-command-line')
                    ->url(fn () => ApiTokensPage::getUrl()),
            ])
            ->authGuard(Config::string('fortify.guard'))
            ->authPasswordBroker(Config::string('fortify.passwords'))
            ->brandName(Config::string('app.name'))
            ->brandLogo($this->brandLogo(self::LIGHT_LOGO_CLASSES))
            ->darkModeBrandLogo($this->brandLogo(self::DARK_LOGO_CLASSES))
            ->brandLogoHeight('2rem')
            ->darkMode()
            ->defaultThemeMode(ThemeMode::System)
            ->font('Inter')
            ->colors([
                'primary' => Color::Indigo,
            ])
            ->discoverResources(in: app_path('Filament/Resources'), for: 'App\\Filament\\Resources')
            ->discoverPages(in: app_path('Filament/Pages'), for: 'App\\Filament\\Pages')
            ->pages([
                Dashboard::class,
            ])
            ->discoverWidgets(in: app_path('Filament/Widgets'), for: 'App\\Filament\\Widgets')
            ->navigationGroups([
                NavigationGroup::make('Inventory'),
                NavigationGroup::make('Shared Data'),
                NavigationGroup::make('Available Images'),
                NavigationGroup::make('Translations'),
                NavigationGroup::make('Reference Data'),
                NavigationGroup::make('Administration'),
            ])
            ->middleware([
                EncryptCookies::class,
                AddQueuedCookiesToResponse::class,
                StartSession::class,
                AuthenticateSession::class,
                ShareErrorsFromSession::class,
                VerifyCsrfToken::class,
                SubstituteBindings::class,
                DisableBladeIconComponents::class,
                DispatchServingFilamentEvent::class,
            ])
            ->authMiddleware([
                Authenticate::class,
                EnsureTwoFactorEnrolled::class,
            ])
            ->routes(function (): void {
                Route::get('/two-factor-challenge', TwoFactorChallenge::class)
                    ->name('auth.two-factor-challenge');
                Route::get('/forgot-password', RequestPasswordReset::class)
                    ->name('auth.password.request');
                Route::get('/reset-password/{token}', ResetPassword::class)
                    ->name('auth.password.reset');
                Route::get('/reset-password-mfa', PasswordResetMfaChallenge::class)
                    ->name('auth.password.reset.mfa');
                Route::get('/email-verification/verify/{id}/{hash}', VerifyEmailController::class)
                    ->middleware(['signed', 'throttle:6,1'])
                    ->name('auth.verify-email');
            })
            ->authenticatedRoutes(function (): void {
                Route::get('/two-factor-setup', TwoFactorSetup::class)
                    ->name('auth.two-factor-setup');

                Route::get('/collections/{collection}/items/{item}/appearance', ViewCollectionItemAppearance::class)
                    ->name('collection-item.appearance');

                Route::get('/available-images/{availableImage}/view', [FilamentAvailableImageController::class, 'view'])
                    ->name('available-image.view');
                Route::get('/available-images/{availableImage}/download', [FilamentAvailableImageController::class, 'download'])
                    ->name('available-image.download');

                Route::get('/items/{item}/images/{itemImage}/view', [FilamentItemImageController::class, 'view'])
                    ->name('item-image.view');
                Route::get('/items/{item}/images/{itemImage}/download', [FilamentItemImageController::class, 'download'])
                    ->name('item-image.download');

                Route::get('/items/{item}/documents/{itemDocument}/download', [FilamentItemDocumentController::class, 'download'])
                    ->name('item-document.download');

                Route::get('/collections/{collection}/images/{collectionImage}/view', [FilamentCollectionImageController::class, 'view'])
                    ->name('collection-image.view');
                Route::get('/collections/{collection}/images/{collectionImage}/download', [FilamentCollectionImageController::class, 'download'])
                    ->name('collection-image.download');

                Route::get('/partners/{partner}/images/{partnerImage}/view', [FilamentPartnerImageController::class, 'view'])
                    ->name('partner-image.view');
                Route::get('/partners/{partner}/images/{partnerImage}/download', [FilamentPartnerImageController::class, 'download'])
                    ->name('partner-image.download');

                Route::get('/partner-translations/{partnerTranslation}/images/{partnerTranslationImage}/view', [FilamentPartnerTranslationImageController::class, 'view'])
                    ->name('partner-translation-image.view');
                Route::get('/partner-translations/{partnerTranslation}/images/{partnerTranslationImage}/download', [FilamentPartnerTranslationImageController::class, 'download'])
                    ->name('partner-translation-image.download');

                Route::get('/timeline-events/{timelineEvent}/images/{timelineEventImage}/view', [FilamentTimelineEventImageController::class, 'view'])
                    ->name('timeline-event-image.view');
                Route::get('/timeline-events/{timelineEvent}/images/{timelineEventImage}/download', [FilamentTimelineEventImageController::class, 'download'])
                    ->name('timeline-event-image.download');
            });

        if (! $this->shouldUseViteTheme()) {
            return $panel;
        }

        return $panel->viteTheme('resources/css/filament/admin/theme.css');
    }

    protected function brandLogo(string $classes): HtmlString
    {
        return new HtmlString(
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="'.htmlspecialchars($classes, ENT_QUOTES, 'UTF-8').'">'
            .'<path stroke-linecap="round" stroke-linejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />'
            .'</svg>'
        );
    }

    protected function shouldUseViteTheme(): bool
    {
        return file_exists(public_path('hot')) || file_exists(public_path('build/manifest.json'));
    }
}
