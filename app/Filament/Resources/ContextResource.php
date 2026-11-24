<?php

namespace App\Filament\Resources;

use App\Filament\Concerns\HasBackwardCompatibilityColumn;
use App\Filament\Concerns\HasInternalNameColumn;
use App\Filament\Concerns\HasTimestampsColumns;
use App\Filament\Concerns\HasUuidColumn;
use App\Filament\Resources\ContextResource\Pages\CreateContext;
use App\Filament\Resources\ContextResource\Pages\EditContext;
use App\Filament\Resources\ContextResource\Pages\ListContext;
use App\Filament\Resources\ContextResource\Pages\ViewContext;
use App\Models\Context;
use Filament\Actions\BulkAction;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Actions\ViewAction;
use Filament\Forms\Components\TextInput;
use Filament\Infolists\Components\IconEntry;
use Filament\Infolists\Components\TextEntry;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Filters\TernaryFilter;
use Filament\Tables\Table;
use Illuminate\Auth\Access\Response;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Gate;

class ContextResource extends Resource
{
    use HasBackwardCompatibilityColumn;
    use HasInternalNameColumn;
    use HasTimestampsColumns;
    use HasUuidColumn;

    protected static ?string $model = Context::class;

    protected static string|\BackedEnum|null $navigationIcon = 'heroicon-o-cog-6-tooth';

    protected static string|\UnitEnum|null $navigationGroup = 'Shared Data';

    protected static ?int $navigationSort = 1;

    protected static ?string $recordTitleAttribute = 'internal_name';

    public static function getGloballySearchableAttributes(): array
    {
        return ['id', 'internal_name', 'backward_compatibility'];
    }

    public static function getViewAnyAuthorizationResponse(): Response
    {
        return Gate::inspect('viewAny', static::getModel());
    }

    public static function shouldRegisterNavigation(): bool
    {
        return static::canViewAny();
    }

    public static function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('internal_name')
                    ->required()
                    ->maxLength(255),
                TextInput::make('backward_compatibility')
                    ->label('Legacy code')
                    ->maxLength(255),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->recordUrl(fn ($record): ?string => auth()->user()?->can('view', $record) ? static::getUrl('view', ['record' => $record]) : null)
            ->defaultSort('internal_name', 'asc')
            ->columns([
                static::internalNameColumn()
                    ->searchable(['internal_name', 'id']),
                static::backwardCompatibilityColumn(),
                IconColumn::make('is_default')
                    ->label('Default')
                    ->boolean()
                    ->sortable(),
                static::uuidColumn(),
                ...static::timestampsColumns(),
            ])
            ->filters([
                TernaryFilter::make('is_default')
                    ->label('Default')
                    ->queries(
                        true: fn (Builder $query): Builder => $query->where('is_default', true),
                        false: fn (Builder $query): Builder => $query->where('is_default', false),
                        blank: fn (Builder $query): Builder => $query,
                    ),
            ])
            ->recordActions([
                ViewAction::make(),
                EditAction::make(),
                DeleteAction::make(),
            ])
            ->toolbarActions([
                BulkAction::make('setDefault')
                    ->label('Set as default')
                    ->requiresConfirmation()
                    ->deselectRecordsAfterCompletion()
                    ->action(function (Collection $records): void {
                        if ($records->count() !== 1) {
                            Notification::make()
                                ->warning()
                                ->title('Select exactly one context')
                                ->body('The Set as default action can only be applied to a single context.')
                                ->send();

                            return;
                        }

                        /** @var Context $context */
                        $context = $records->first();
                        $context->setDefault();

                        Notification::make()
                            ->success()
                            ->title('Default context updated')
                            ->send();
                    }),
            ]);
    }

    public static function infolist(Schema $schema): Schema
    {
        return $schema
            ->inlineLabel()
            ->components([
                Section::make('Core Information')
                    ->schema([
                        TextEntry::make('internal_name'),
                        IconEntry::make('is_default')
                            ->label('Default')
                            ->boolean(),
                    ])
                    ->columns(2),
                Section::make('System Information')
                    ->schema([
                        static::uuidInfolistEntry(),
                        TextEntry::make('backward_compatibility')
                            ->label('Legacy code'),
                        ...static::timestampsInfolistEntries(),
                    ])
                    ->columns(2)
                    ->collapsible()
                    ->collapsed(),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => ListContext::route('/'),
            'create' => CreateContext::route('/create'),
            'edit' => EditContext::route('/{record}/edit'),
            'view' => ViewContext::route('/{record}'),
        ];
    }
}
