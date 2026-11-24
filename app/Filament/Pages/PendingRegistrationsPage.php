<?php

namespace App\Filament\Pages;

use Filament\Actions\Action;
use App\Models\User;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Concerns\InteractsWithTable;
use Filament\Tables\Contracts\HasTable;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class PendingRegistrationsPage extends Page implements HasTable
{
    use InteractsWithTable;

    protected static string | \BackedEnum | null $navigationIcon = 'heroicon-o-clock';

    protected static ?string $navigationLabel = 'Pending Registrations';

    protected static string | \UnitEnum | null $navigationGroup = 'Administration';

    protected static ?int $navigationSort = 2;

    protected string $view = 'filament.pages.pending-registrations-page';

    protected static ?string $title = 'Pending Registrations';

    public static function canAccess(): bool
    {
        return auth()->user()?->can('manageRegistrations', User::class) ?? false;
    }

    public static function shouldRegisterNavigation(): bool
    {
        return static::canAccess();
    }

    public function table(Table $table): Table
    {
        return $table
            ->query(fn (): Builder => User::query()->whereNull('approved_at'))
            ->defaultSort('created_at', 'asc')
            ->columns([
                TextColumn::make('name')
                    ->searchable()
                    ->sortable(),
                TextColumn::make('email')
                    ->searchable()
                    ->sortable(),
                TextColumn::make('created_at')
                    ->label('Registered')
                    ->dateTime()
                    ->sortable(),
            ])
            ->recordActions([
                Action::make('approve')
                    ->label('Approve')
                    ->icon('heroicon-o-check')
                    ->color('success')
                    ->visible(fn (User $record): bool => auth()->user()?->can('approve', $record) ?? false)
                    ->authorize(fn (User $record): bool => auth()->user()?->can('approve', $record) ?? false)
                    ->requiresConfirmation()
                    ->action(function (User $record): void {
                        $record->forceFill(['approved_at' => now()])->save();
                        Notification::make()->success()->title('User approved')->send();
                    }),
                Action::make('reject')
                    ->label('Reject')
                    ->icon('heroicon-o-x-mark')
                    ->color('danger')
                    ->requiresConfirmation()
                    ->modalHeading('Reject Registration')
                    ->modalDescription('This will permanently delete the user account. This action cannot be undone.')
                    ->visible(fn (User $record): bool => auth()->user()?->can('delete', $record) ?? false)
                    ->authorize(fn (User $record): bool => auth()->user()?->can('delete', $record) ?? false)
                    ->action(function (User $record): void {
                        $record->delete();
                        Notification::make()->success()->title('Registration rejected')->send();
                    }),
            ]);
    }
}
