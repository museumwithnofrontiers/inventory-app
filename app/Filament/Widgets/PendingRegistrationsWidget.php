<?php

namespace App\Filament\Widgets;

use App\Filament\Pages\PendingRegistrationsPage;
use App\Models\User;
use Filament\Notifications\Notification;
use Filament\Tables\Actions\Action;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Filament\Widgets\TableWidget as BaseWidget;
use Illuminate\Database\Eloquent\Builder;

class PendingRegistrationsWidget extends BaseWidget
{
    protected static ?int $sort = 7;

    protected int|string|array $columnSpan = 'full';

    public static function canView(): bool
    {
        return auth()->user()?->can('manageRegistrations', User::class) ?? false;
    }

    public function table(Table $table): Table
    {
        return $table
            ->query(
                fn (): Builder => User::query()
                    ->whereNull('approved_at')
                    ->latest()
                    ->limit(10),
            )
            ->paginated(false)
            ->columns([
                TextColumn::make('name')
                    ->searchable(false)
                    ->sortable(false),
                TextColumn::make('email')
                    ->searchable(false)
                    ->sortable(false),
                TextColumn::make('created_at')
                    ->label('Registered')
                    ->dateTime()
                    ->sortable(false),
            ])
            ->actions([
                Action::make('approve')
                    ->label('Approve')
                    ->icon('heroicon-o-check')
                    ->color('success')
                    ->requiresConfirmation()
                    ->action(function (User $record): void {
                        $record->forceFill(['approved_at' => now()])->save();
                        Notification::make()->success()->title('User approved')->send();
                    }),
            ])
            ->heading('Pending Registrations')
            ->emptyStateHeading('No pending registrations')
            ->emptyStateDescription('All user registrations have been reviewed.')
            ->headerActions([
                Action::make('viewAll')
                    ->label('Manage registrations')
                    ->icon('heroicon-o-users')
                    ->url(PendingRegistrationsPage::getUrl()),
            ]);
    }
}
