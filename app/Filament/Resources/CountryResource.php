<?php

namespace App\Filament\Resources;

use Filament\Schemas\Schema;
use Filament\Actions\ViewAction;
use Filament\Actions\EditAction;
use Filament\Actions\DeleteAction;
use Filament\Schemas\Components\Section;
use App\Filament\Concerns\HasBackwardCompatibilityColumn;
use App\Filament\Concerns\HasInternalNameColumn;
use App\Filament\Concerns\HasTimestampsColumns;
use App\Filament\Concerns\HasUuidColumn;
use App\Filament\Resources\CountryResource\Pages\CreateCountry;
use App\Filament\Resources\CountryResource\Pages\EditCountry;
use App\Filament\Resources\CountryResource\Pages\ListCountry;
use App\Filament\Resources\CountryResource\Pages\ViewCountry;
use App\Filament\Resources\CountryResource\RelationManagers\TranslationsRelationManager;
use App\Models\Country;
use Filament\Forms\Components\TextInput;
use Filament\Infolists\Components\TextEntry;
use Filament\Resources\Resource;
use Filament\Tables\Table;

class CountryResource extends Resource
{
    use HasBackwardCompatibilityColumn;
    use HasInternalNameColumn;
    use HasTimestampsColumns;
    use HasUuidColumn;

    protected static ?string $model = Country::class;

    protected static string | \BackedEnum | null $navigationIcon = 'heroicon-o-globe-europe-africa';

    protected static string | \UnitEnum | null $navigationGroup = 'Reference Data';

    protected static ?int $navigationSort = 2;

    protected static ?string $recordTitleAttribute = 'internal_name';

    public static function getGloballySearchableAttributes(): array
    {
        return ['id', 'internal_name', 'backward_compatibility'];
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
                TextInput::make('id')
                    ->label('ISO code')
                    ->length(3)
                    ->required()
                    ->unique(ignoreRecord: true)
                    ->disabled(fn (?Country $record): bool => $record !== null)
                    ->dehydrated(fn (?Country $record): bool => $record === null),
                TextInput::make('internal_name')
                    ->required()
                    ->maxLength(255),
                TextInput::make('backward_compatibility')
                    ->label('Legacy code')
                    ->maxLength(2),
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
                static::uuidColumn()
                    ->label('ISO code')
                    ->searchable()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: false),
                ...static::timestampsColumns(),
            ])
            ->recordActions([
                ViewAction::make(),
                EditAction::make(),
                DeleteAction::make(),
            ]);
    }

    public static function infolist(Schema $schema): Schema
    {
        return $schema
            ->inlineLabel()
            ->components([
                Section::make('Core Information')
                    ->schema([
                        TextEntry::make('id')
                            ->label('ISO code'),
                        TextEntry::make('internal_name'),
                    ])
                    ->columns(2),
                Section::make('System Information')
                    ->schema([
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
            'index' => ListCountry::route('/'),
            'create' => CreateCountry::route('/create'),
            'edit' => EditCountry::route('/{record}/edit'),
            'view' => ViewCountry::route('/{record}'),
        ];
    }

    public static function getRelations(): array
    {
        return [
            TranslationsRelationManager::class,
        ];
    }
}
