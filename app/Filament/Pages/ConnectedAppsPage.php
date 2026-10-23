<?php

namespace App\Filament\Pages;

use App\Enums\Permission;
use App\Models\User;
use Filament\Facades\Filament;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Filament\Tables\Actions\Action as TableAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Concerns\InteractsWithTable;
use Filament\Tables\Contracts\HasTable;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Laravel\Passport\Client;
use Laravel\Passport\Passport;
use Laravel\Passport\Token;

/**
 * The apps the signed-in user has authorized through OAuth, such as an AI
 * assistant connected to the MCP server: what each may do, since when, and
 * a Revoke action. Reached from the profile page.
 */
class ConnectedAppsPage extends Page implements HasTable
{
    use InteractsWithTable;

    protected static ?string $slug = 'profile/connected-apps';

    protected static ?string $title = 'Connected apps';

    protected static string $view = 'filament.pages.connected-apps-page';

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

    /**
     * The address to give an AI assistant, for a user allowed to connect one
     * to the MCP server.
     */
    public function mcpServerUrl(): ?string
    {
        return $this->getUser()->hasPermissionTo(Permission::ACCESS_MCP->value)
            ? route('mcp.inventory')
            : null;
    }

    public function table(Table $table): Table
    {
        return $table
            ->query(fn (): Builder => Passport::client()->newQuery()
                ->whereHas('tokens', fn (Builder $tokens): Builder => $this->activeTokensOf($tokens)))
            ->defaultSort('name')
            ->emptyStateHeading('No connected apps')
            ->emptyStateDescription('Apps you authorize to use your account, such as an AI assistant, appear here.')
            ->columns([
                TextColumn::make('name')
                    ->label('App'),
                TextColumn::make('granted_scopes')
                    ->label('May')
                    ->badge()
                    ->state(fn (Client $record): array => $this->tokensOf($record)
                        ->flatMap(fn (Token $token): array => $token->scopes)
                        ->unique()
                        ->sort()
                        ->values()
                        ->all()),
                TextColumn::make('authorized_at')
                    ->label('Authorized')
                    ->dateTime()
                    ->state(fn (Client $record): ?Carbon => $this->tokensOf($record)->min('created_at')),
                TextColumn::make('last_token_at')
                    ->label('Last active')
                    ->since()
                    ->state(fn (Client $record): ?Carbon => $this->tokensOf($record)->max('created_at')),
            ])
            ->actions([
                TableAction::make('revoke')
                    ->label('Revoke')
                    ->icon('heroicon-o-no-symbol')
                    ->color('danger')
                    ->requiresConfirmation()
                    ->modalHeading('Revoke this app')
                    ->modalDescription('It loses access at once and has to ask for your approval again.')
                    ->action(function (Client $record): void {
                        $this->revoke($record);

                        Notification::make()->success()->title('App revoked')->send();
                    }),
            ]);
    }

    /**
     * @template TBuilder of Builder<Token>|Relation<Token, Client, mixed>
     *
     * @param  TBuilder  $tokens
     * @return TBuilder
     */
    protected function activeTokensOf(Builder|Relation $tokens): Builder|Relation
    {
        return $tokens
            ->where('user_id', $this->getUser()->getKey())
            ->where('revoked', false);
    }

    /**
     * @return Collection<int, Token>
     */
    protected function tokensOf(Client $client): Collection
    {
        /** @var Collection<int, Token> $tokens */
        $tokens = $this->activeTokensOf($client->tokens())->get();

        return $tokens;
    }

    /**
     * Revokes every token and pending code the app holds for this user; the
     * other users of the same app keep theirs.
     */
    protected function revoke(Client $client): void
    {
        foreach ($this->tokensOf($client) as $token) {
            $token->revoke();
            $token->refreshToken?->revoke();
        }

        Passport::authCode()->newQuery()
            ->where('client_id', $client->getKey())
            ->where('user_id', $this->getUser()->getKey())
            ->update(['revoked' => true]);
    }
}
