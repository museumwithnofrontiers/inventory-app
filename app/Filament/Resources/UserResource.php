<?php

namespace App\Filament\Resources;

use Filament\Schemas\Schema;
use Filament\Actions\ViewAction;
use Filament\Actions\EditAction;
use Filament\Actions\Action;
use Filament\Actions\DeleteAction;
use Filament\Actions\BulkAction;
use Filament\Schemas\Components\Section;
use App\Enums\Role as RoleEnum;
use App\Filament\Resources\UserResource\Pages\CreateUser;
use App\Filament\Resources\UserResource\Pages\EditUser;
use App\Filament\Resources\UserResource\Pages\ListUser;
use App\Filament\Resources\UserResource\Pages\ViewUser;
use App\Filament\Support\ConfirmPassword;
use App\Models\User;
use App\Policies\UserPolicy;
use App\Services\UserPasswordResetService;
use App\Support\Authorization\UserRoles;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Infolists\Components\IconEntry;
use Filament\Infolists\Components\TextEntry;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\Filter;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Hash;
use Laravel\Fortify\Actions\DisableTwoFactorAuthentication;

/**
 * User accounts, for the user managers (Manager of Users, Superadmin). What
 * each of them may do to which account is {@see UserPolicy}'s call: the
 * superadmin's account is out of reach here, only the superadmin changes
 * another user manager, and nobody changes their own role. Sensitive changes
 * ask for the signed-in user's password again ({@see ConfirmPassword}), and
 * every change lands in the audit log.
 */
class UserResource extends Resource
{
    protected static ?string $model = User::class;

    protected static string | \BackedEnum | null $navigationIcon = 'heroicon-o-users';

    protected static string | \UnitEnum | null $navigationGroup = 'Administration';

    protected static ?int $navigationSort = 1;

    protected static ?string $recordTitleAttribute = 'name';

    public static function getGloballySearchableAttributes(): array
    {
        return ['name', 'email'];
    }

    public static function canViewAny(): bool
    {
        return auth()->user()?->can('viewAny', static::getModel()) ?? false;
    }

    public static function shouldRegisterNavigation(): bool
    {
        return static::canViewAny();
    }

    public static function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('name')
                    ->required()
                    ->maxLength(255),
                TextInput::make('email')
                    ->email()
                    ->required()
                    ->unique(ignoreRecord: true)
                    ->maxLength(255),
                TextInput::make('password')
                    ->password()
                    ->revealable()
                    ->maxLength(255)
                    ->dehydrateStateUsing(fn (string $state): string => Hash::make($state))
                    ->dehydrated(fn (?string $state): bool => filled($state))
                    ->hidden(fn (string $operation): bool => $operation === 'create'),
                Select::make('role')
                    ->label('Role')
                    ->helperText('One role per user. With none, the account has no access.')
                    ->placeholder('No role')
                    ->options(fn (?User $record): array => static::roleOptions($record ?? new User))
                    ->visible(fn (?User $record): bool => static::roleOptions($record ?? new User) !== []),
                ConfirmPassword::field(),
            ]);
    }

    /**
     * The roles the signed-in user may give the account.
     *
     * @return array<string, string>
     */
    public static function roleOptions(User $record): array
    {
        $actor = auth()->user();

        if (! $actor instanceof User) {
            return [];
        }

        $options = [];

        foreach (app(UserPolicy::class)->assignableRoles($actor, $record) as $role) {
            $options[$role->value] = $role->value;
        }

        return $options;
    }

    /**
     * Gives the account the role picked in a form, after asking the policy.
     */
    public static function applyRole(User $record, mixed $roleName): void
    {
        $role = is_string($roleName) && $roleName !== '' ? RoleEnum::tryFrom($roleName) : null;

        if ($record->currentRole() === $role) {
            return;
        }

        abort_unless(auth()->user()?->can('assignRole', [$record, $role]) ?? false, 403);

        $role === null
            ? app(UserRoles::class)->clear($record)
            : app(UserRoles::class)->assign($record, $role);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->recordUrl(fn (User $record): ?string => auth()->user()?->can('view', $record) ? static::getUrl('view', ['record' => $record]) : null)
            ->defaultSort('name', 'asc')
            ->modifyQueryUsing(fn (Builder $query): Builder => $query->with('roles'))
            ->columns([
                TextColumn::make('name')
                    ->searchable()
                    ->sortable(),
                TextColumn::make('email')
                    ->searchable()
                    ->sortable(),
                TextColumn::make('roles.name')
                    ->label('Role')
                    ->badge()
                    ->placeholder('No role')
                    ->searchable()
                    ->sortable(false),
                IconColumn::make('email_verified_at')
                    ->label('Verified')
                    ->boolean()
                    ->getStateUsing(fn (User $record): bool => $record->email_verified_at !== null)
                    ->sortable(),
                IconColumn::make('two_factor_confirmed_at')
                    ->label('2FA')
                    ->boolean()
                    ->getStateUsing(fn (User $record): bool => $record->hasEnabledTwoFactorAuthentication())
                    ->sortable(false),
                TextColumn::make('approved_at')
                    ->label('Approved')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(),
                TextColumn::make('suspended_at')
                    ->label('Suspended')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(),
                TextColumn::make('created_at')
                    ->label('Created')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                SelectFilter::make('role')
                    ->label('Role')
                    ->options(RoleEnum::options())
                    ->query(fn (Builder $query, array $data): Builder => $data['value']
                        ? $query->whereHas('roles', fn (Builder $q): Builder => $q->where('name', $data['value']))
                        : $query),
                Filter::make('no_role')
                    ->label('No role')
                    ->query(fn (Builder $query): Builder => $query->whereDoesntHave('roles')),
                Filter::make('two_factor_enabled')
                    ->label('2FA Enabled')
                    ->query(fn (Builder $query): Builder => $query->whereNotNull('two_factor_confirmed_at')),
                Filter::make('email_verified')
                    ->label('Email Verified')
                    ->query(fn (Builder $query): Builder => $query->whereNotNull('email_verified_at')),
                Filter::make('pending_approval')
                    ->label('Pending Approval')
                    ->query(fn (Builder $query): Builder => $query->whereNull('approved_at')),
                Filter::make('suspended')
                    ->label('Suspended')
                    ->query(fn (Builder $query): Builder => $query->whereNotNull('suspended_at')),
            ])
            ->recordActions([
                ViewAction::make(),
                EditAction::make(),
                Action::make('resendVerification')
                    ->label('Resend Verification')
                    ->icon('heroicon-o-envelope')
                    ->color('info')
                    ->visible(fn (User $record): bool => ! $record->hasVerifiedEmail() && static::allows('update', $record))
                    ->authorize(fn (User $record): bool => static::allows('update', $record))
                    ->action(function (User $record): void {
                        $record->sendEmailVerificationNotification();
                        Notification::make()->success()->title('Verification email sent')->send();
                    }),
                Action::make('markEmailVerified')
                    ->label('Mark Email Verified')
                    ->icon('heroicon-o-check-circle')
                    ->color('success')
                    ->visible(fn (User $record): bool => ! $record->hasVerifiedEmail() && static::allows('update', $record))
                    ->authorize(fn (User $record): bool => static::allows('update', $record))
                    ->requiresConfirmation()
                    ->action(function (User $record): void {
                        $record->forceFill(['email_verified_at' => now()])->save();
                        Notification::make()->success()->title('Email marked as verified')->send();
                    }),
                Action::make('clearEmailVerification')
                    ->label('Clear Email Verification')
                    ->icon('heroicon-o-x-circle')
                    ->color('warning')
                    ->visible(fn (User $record): bool => $record->hasVerifiedEmail() && static::allows('update', $record))
                    ->authorize(fn (User $record): bool => static::allows('update', $record))
                    ->requiresConfirmation()
                    ->action(function (User $record): void {
                        $record->forceFill(['email_verified_at' => null])->save();
                        Notification::make()->success()->title('Email verification cleared')->send();
                    }),
                Action::make('sendInvitation')
                    ->label('Send Invitation')
                    ->icon('heroicon-o-envelope')
                    ->color('warning')
                    ->visible(fn (User $record): bool => static::allows('update', $record))
                    ->authorize(fn (User $record): bool => static::allows('update', $record))
                    ->requiresConfirmation()
                    ->modalHeading('Send Invitation Email')
                    ->modalDescription('A password reset link will be sent to the user. They will be able to set their own password through the link. The link expires after 60 minutes.')
                    ->action(function (User $record): void {
                        app(UserPasswordResetService::class)->sendResetLink($record);
                        Notification::make()
                            ->success()
                            ->title('Invitation sent')
                            ->body('A password reset link has been sent to '.$record->email.'.')
                            ->send();
                    }),
                Action::make('assignRole')
                    ->label('Change Role')
                    ->icon('heroicon-o-shield-check')
                    ->color('primary')
                    ->visible(fn (User $record): bool => static::roleOptions($record) !== [])
                    ->authorize(fn (User $record): bool => static::allows('assignRole', $record))
                    ->fillForm(fn (User $record): array => ['role' => $record->currentRole()?->value])
                    ->schema(fn (User $record): array => [
                        Select::make('role')
                            ->label('Role')
                            ->placeholder('No role')
                            ->options(static::roleOptions($record)),
                        ConfirmPassword::field(),
                    ])
                    ->action(function (User $record, array $data): void {
                        static::applyRole($record, $data['role'] ?? null);
                        Notification::make()->success()->title('Role changed')->send();
                    }),
                Action::make('disableTwoFactor')
                    ->label('Disable Two-Factor')
                    ->icon('heroicon-o-shield-exclamation')
                    ->color('danger')
                    ->visible(fn (User $record): bool => $record->hasEnabledTwoFactorAuthentication() && static::allows('resetTwoFactor', $record))
                    ->authorize(fn (User $record): bool => static::allows('resetTwoFactor', $record))
                    ->modalHeading('Disable Two-Factor Authentication')
                    ->modalDescription('This will disable two-factor authentication for this user. Use this as an admin recovery action when the user has lost their device.')
                    ->schema([ConfirmPassword::field()])
                    ->action(function (User $record): void {
                        app(DisableTwoFactorAuthentication::class)($record);
                        Notification::make()->success()->title('Two-factor authentication disabled')->send();
                    }),
                Action::make('approve')
                    ->label('Approve')
                    ->icon('heroicon-o-check')
                    ->color('success')
                    ->visible(fn (User $record): bool => $record->approved_at === null && static::allows('approve', $record))
                    ->authorize(fn (User $record): bool => static::allows('approve', $record))
                    ->requiresConfirmation()
                    ->action(function (User $record): void {
                        $record->forceFill(['approved_at' => now()])->save();
                        Notification::make()->success()->title('User approved')->send();
                    }),
                Action::make('suspend')
                    ->label('Suspend')
                    ->icon('heroicon-o-no-symbol')
                    ->color('danger')
                    ->visible(fn (User $record): bool => $record->suspended_at === null && static::allows('suspend', $record))
                    ->authorize(fn (User $record): bool => static::allows('suspend', $record))
                    ->modalHeading('Suspend user')
                    ->modalDescription('The user can no longer sign in, and their sessions and connected apps are signed out at once.')
                    ->schema([ConfirmPassword::field()])
                    ->action(function (User $record): void {
                        $record->forceFill(['suspended_at' => now()])->save();
                        Notification::make()->success()->title('User suspended')->send();
                    }),
                Action::make('reactivate')
                    ->label('Reactivate')
                    ->icon('heroicon-o-arrow-path')
                    ->color('success')
                    ->visible(fn (User $record): bool => $record->suspended_at !== null && static::allows('reactivate', $record))
                    ->authorize(fn (User $record): bool => static::allows('reactivate', $record))
                    ->schema([ConfirmPassword::field()])
                    ->action(function (User $record): void {
                        $record->forceFill(['suspended_at' => null])->save();
                        Notification::make()->success()->title('User reactivated')->send();
                    }),
                DeleteAction::make()
                    ->schema([ConfirmPassword::field()]),
            ])
            ->toolbarActions([
                BulkAction::make('approve')
                    ->label('Approve')
                    ->icon('heroicon-o-check')
                    ->color('success')
                    ->visible(fn (): bool => static::allows('viewAny'))
                    ->requiresConfirmation()
                    ->deselectRecordsAfterCompletion()
                    ->action(function (Collection $records): void {
                        /** @var Collection<int, User> $records */
                        $records
                            ->filter(fn (User $user): bool => static::allows('approve', $user))
                            ->each(fn (User $user) => $user->forceFill(['approved_at' => now()])->save());
                        Notification::make()->success()->title('Users approved')->send();
                    }),
                BulkAction::make('suspend')
                    ->label('Suspend')
                    ->icon('heroicon-o-no-symbol')
                    ->color('danger')
                    ->visible(fn (): bool => static::allows('viewAny'))
                    ->form([ConfirmPassword::field()])
                    ->deselectRecordsAfterCompletion()
                    ->action(function (Collection $records): void {
                        /** @var Collection<int, User> $records */
                        $records
                            ->filter(fn (User $user): bool => static::allows('suspend', $user))
                            ->each(fn (User $user) => $user->forceFill(['suspended_at' => now()])->save());
                        Notification::make()->success()->title('Users suspended')->send();
                    }),
                BulkAction::make('assignRole')
                    ->label('Change Role')
                    ->icon('heroicon-o-shield-check')
                    ->color('primary')
                    ->visible(fn (): bool => static::roleOptions(new User) !== [])
                    ->form([
                        Select::make('role')
                            ->label('Role')
                            ->placeholder('No role')
                            ->options(fn (): array => static::roleOptions(new User)),
                        ConfirmPassword::field(),
                    ])
                    ->deselectRecordsAfterCompletion()
                    ->action(function (Collection $records, array $data): void {
                        $roleName = $data['role'] ?? null;
                        $role = is_string($roleName) && $roleName !== '' ? RoleEnum::tryFrom($roleName) : null;

                        /** @var Collection<int, User> $records */
                        $records
                            ->filter(fn (User $user): bool => auth()->user()?->can('assignRole', [$user, $role]) ?? false)
                            ->each(fn (User $user) => static::applyRole($user, $roleName));
                        Notification::make()->success()->title('Role changed')->send();
                    }),
            ]);
    }

    /**
     * Whether the signed-in user may do this, asked of the policy.
     */
    public static function allows(string $ability, ?Model $record = null): bool
    {
        return auth()->user()?->can($ability, $record ?? User::class) ?? false;
    }

    public static function infolist(Schema $schema): Schema
    {
        return $schema
            ->inlineLabel()
            ->components([
                Section::make('Account Details')
                    ->schema([
                        TextEntry::make('name'),
                        TextEntry::make('email'),
                        TextEntry::make('roles.name')
                            ->label('Role')
                            ->placeholder('No role')
                            ->badge(),
                        IconEntry::make('email_verified_at')
                            ->label('Email Verified')
                            ->boolean()
                            ->getStateUsing(fn (User $record): bool => $record->email_verified_at !== null),
                        IconEntry::make('two_factor_confirmed_at')
                            ->label('2FA Enabled')
                            ->boolean()
                            ->getStateUsing(fn (User $record): bool => $record->hasEnabledTwoFactorAuthentication()),
                    ])
                    ->columns(2),
                Section::make('Account Status')
                    ->schema([
                        TextEntry::make('approved_at')
                            ->label('Approved')
                            ->dateTime(),
                        TextEntry::make('suspended_at')
                            ->label('Suspended')
                            ->dateTime(),
                        TextEntry::make('created_at')
                            ->label('Created')
                            ->dateTime(),
                        TextEntry::make('updated_at')
                            ->label('Updated')
                            ->dateTime(),
                    ])
                    ->columns(2)
                    ->collapsible()
                    ->collapsed(),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => ListUser::route('/'),
            'create' => CreateUser::route('/create'),
            'edit' => EditUser::route('/{record}/edit'),
            'view' => ViewUser::route('/{record}'),
        ];
    }
}
