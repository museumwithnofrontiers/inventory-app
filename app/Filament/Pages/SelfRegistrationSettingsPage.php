<?php

namespace App\Filament\Pages;

use App\Models\Setting;
use App\Models\User;
use Filament\Forms\Components\Toggle;
use Filament\Forms\Form;
use Filament\Notifications\Notification;
use Filament\Pages\Page;

class SelfRegistrationSettingsPage extends Page
{
    protected static ?string $navigationIcon = 'heroicon-o-cog-6-tooth';

    protected static ?string $navigationLabel = 'Self-Registration';

    protected static ?string $navigationGroup = 'Administration';

    protected static ?int $navigationSort = 3;

    protected static string $view = 'filament.pages.self-registration-settings-page';

    protected static ?string $title = 'Self-Registration Settings';

    public bool $self_registration_enabled = false;

    public static function canAccess(): bool
    {
        return auth()->user()?->can('manageRegistrations', User::class) ?? false;
    }

    public static function shouldRegisterNavigation(): bool
    {
        return static::canAccess();
    }

    public function mount(): void
    {
        $this->self_registration_enabled = (bool) Setting::get('self_registration_enabled', false);
    }

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                Toggle::make('self_registration_enabled')
                    ->label('Allow Self-Registration')
                    ->helperText('When enabled, new users can register themselves. They get no role and no access until a user manager approves them and gives them a role.'),
            ])
            ->statePath('');
    }

    public function save(): void
    {
        Setting::set('self_registration_enabled', $this->self_registration_enabled, 'boolean');

        Notification::make()
            ->success()
            ->title('Settings saved')
            ->send();
    }
}
