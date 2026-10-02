<?php

namespace App\Filament\Pages;

use App\Models\User;
use Filament\Actions\Action;
use Filament\Facades\Filament;
use Filament\Forms\Components\TextInput;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Filament\Tables\Actions\Action as TableAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Concerns\InteractsWithTable;
use Filament\Tables\Contracts\HasTable;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * The signed-in user's personal access tokens for the API: create one, see
 * when each was last used, revoke one. Reached from the profile page.
 *
 * A token's plain text exists only in the response to its creation (Sanctum
 * stores a hash), so the page shows it once, in the dialog that follows.
 */
class ApiTokensPage extends Page implements HasTable
{
    use InteractsWithTable;

    protected static ?string $slug = 'profile/api-tokens';

    protected static ?string $title = 'API Tokens';

    protected static string $view = 'filament.pages.api-tokens-page';

    protected static bool $shouldRegisterNavigation = false;

    public static function canAccess(): bool
    {
        return auth()->check();
    }

    protected function getUser(): User
    {
        /** @var User $user */
        $user = Filament::auth()->user();

        return $user;
    }

    public function table(Table $table): Table
    {
        return $table
            ->query(fn (): Builder => $this->getUser()->tokens()->getQuery())
            ->defaultSort('created_at', 'desc')
            ->emptyStateHeading('No API tokens')
            ->emptyStateDescription('Create a token to call the API on your behalf.')
            ->columns([
                TextColumn::make('name'),
                TextColumn::make('created_at')
                    ->label('Created')
                    ->dateTime(),
                TextColumn::make('last_used_at')
                    ->label('Last used')
                    ->since()
                    ->placeholder('Never'),
            ])
            ->actions([
                TableAction::make('revoke')
                    ->label('Revoke')
                    ->icon('heroicon-o-trash')
                    ->color('danger')
                    ->requiresConfirmation()
                    ->modalHeading('Revoke API token')
                    ->modalDescription('Anything still using this token will no longer be able to call the API.')
                    ->action(function (PersonalAccessToken $record): void {
                        $record->delete();

                        Notification::make()->success()->title('Token revoked')->send();
                    }),
            ]);
    }

    /**
     * @return array<Action>
     */
    protected function getHeaderActions(): array
    {
        return [
            Action::make('createToken')
                ->label('Create Token')
                ->icon('heroicon-o-plus')
                ->modalHeading('Create API token')
                ->form([
                    TextInput::make('name')
                        ->label('Token name')
                        ->helperText('Name it after what will use it, so you can tell your tokens apart.')
                        ->required()
                        ->maxLength(255),
                ])
                ->action(function (array $data): void {
                    $name = $data['name'] ?? '';
                    $token = $this->getUser()->createToken(is_string($name) ? $name : '');

                    $this->replaceMountedAction('showToken', ['token' => $token->plainTextToken]);
                }),
        ];
    }

    public function showTokenAction(): Action
    {
        return Action::make('showToken')
            ->modalHeading('Copy your new API token')
            ->modalDescription('It won\'t be shown again. Send it as a bearer token in the Authorization header.')
            ->fillForm(fn (array $arguments): array => ['token' => $arguments['token'] ?? ''])
            ->form([
                TextInput::make('token')
                    ->label('Token')
                    ->readOnly(),
            ])
            ->modalSubmitAction(false)
            ->modalCancelActionLabel('Done');
    }
}
