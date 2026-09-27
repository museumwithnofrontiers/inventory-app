<?php

namespace App\Filament\Resources;

use App\Enums\Permission;
use App\Filament\Concerns\HasBackwardCompatibilityColumn;
use App\Filament\Concerns\HasInternalNameColumn;
use App\Filament\Concerns\HasTimestampsColumns;
use App\Filament\Concerns\HasUuidColumn;
use App\Filament\Resources\TimelineResource\Pages\CreateTimeline;
use App\Filament\Resources\TimelineResource\Pages\EditTimeline;
use App\Filament\Resources\TimelineResource\Pages\ListTimeline;
use App\Filament\Resources\TimelineResource\Pages\ViewTimeline;
use App\Filament\Resources\TimelineResource\RelationManagers\EventsRelationManager;
use App\Filament\Support\CollectionDisplayLabel;
use App\Filament\Support\ExtraJsonField;
use App\Filament\Support\RecordSelect;
use App\Models\Collection;
use App\Models\Country;
use App\Models\Timeline;
use Filament\Forms\Components\Section;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Form;
use Filament\Infolists\Components\Section as InfolistSection;
use Filament\Infolists\Components\TextEntry;
use Filament\Infolists\Infolist;
use Filament\Resources\Resource;
use Filament\Tables\Actions\DeleteAction;
use Filament\Tables\Actions\EditAction;
use Filament\Tables\Actions\ViewAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;

class TimelineResource extends Resource
{
    use HasBackwardCompatibilityColumn;
    use HasInternalNameColumn;
    use HasTimestampsColumns;
    use HasUuidColumn;

    protected static ?string $model = Timeline::class;

    protected static ?string $navigationIcon = 'heroicon-o-clock';

    protected static ?string $navigationGroup = 'Inventory';

    protected static ?int $navigationSort = 8;

    protected static ?string $recordTitleAttribute = 'internal_name';

    public static function getGloballySearchableAttributes(): array
    {
        return ['id', 'internal_name', 'backward_compatibility'];
    }

    public static function canViewAny(): bool
    {
        return auth()->user()?->hasPermissionTo(Permission::VIEW_DATA->value) ?? false;
    }

    public static function shouldRegisterNavigation(): bool
    {
        return static::canViewAny();
    }

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Section::make('Core information')
                    ->schema([
                        TextInput::make('internal_name')
                            ->required()
                            ->maxLength(255)
                            ->unique(ignoreRecord: true),
                        Select::make('country_id')
                            ->label('Country')
                            ->getSearchResultsUsing(fn (string $search): array => Country::query()
                                ->where('internal_name', 'like', "%{$search}%")
                                ->orWhere('id', 'like', "%{$search}%")
                                ->orderBy('internal_name')
                                ->limit(50)
                                ->pluck('internal_name', 'id')
                                ->all()
                            )
                            ->getOptionLabelUsing(fn (mixed $value): string => is_string($value) ? (Country::find($value)->internal_name ?? $value) : '')
                            ->searchable()
                            ->nullable(),
                        RecordSelect::forCollections(required: false),
                        TextInput::make('backward_compatibility')
                            ->label('Legacy code')
                            ->maxLength(255)
                            ->nullable(),
                    ])
                    ->columns(2),
                Section::make('Metadata')
                    ->schema([
                        ExtraJsonField::formComponent(),
                    ])
                    ->collapsible()
                    ->collapsed(),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->recordUrl(fn (Timeline $record): ?string => auth()->user()?->can('view', $record) ? static::getUrl('view', ['record' => $record]) : null)
            ->defaultSort('internal_name', 'asc')
            ->columns([
                static::internalNameColumn(),
                TextColumn::make('country.internal_name')
                    ->label('Country')
                    ->sortable()
                    ->toggleable(),
                TextColumn::make('collection.internal_name')
                    ->label('Collection')
                    ->sortable()
                    ->toggleable(),
                static::backwardCompatibilityColumn(),
                static::uuidColumn(),
                ...static::timestampsColumns(),
            ])
            ->actions([
                ViewAction::make(),
                EditAction::make(),
                DeleteAction::make(),
            ])
            ->filters([
                SelectFilter::make('country_id')
                    ->label('Country')
                    ->getSearchResultsUsing(fn (string $search): array => Country::query()
                        ->where('internal_name', 'like', "%{$search}%")
                        ->orWhere('id', 'like', "%{$search}%")
                        ->orderBy('internal_name')
                        ->limit(50)
                        ->pluck('internal_name', 'id')
                        ->all()
                    )
                    ->getOptionLabelUsing(fn (mixed $value): string => is_string($value) ? (Country::find($value)->internal_name ?? $value) : '')
                    ->searchable(),
                SelectFilter::make('collection_id')
                    ->label('Collection')
                    ->getSearchResultsUsing(fn (string $search): array => CollectionDisplayLabel::withDisplayLabel(
                        Collection::query()
                            ->where('internal_name', 'like', "%{$search}%")
                            ->orWhere('backward_compatibility', 'like', "%{$search}%")
                            ->orWhere('id', 'like', "%{$search}%")
                            ->orderBy('internal_name')
                            ->limit(50)
                    )->get()->mapWithKeys(fn (Collection $c): array => [
                        $c->id => $c->display_label !== $c->internal_name
                            ? $c->display_label.' ['.$c->internal_name.']'
                            : $c->internal_name,
                    ])->all())
                    ->getOptionLabelUsing(fn (mixed $value): string => CollectionDisplayLabel::resolveLabel($value) ?: (is_scalar($value) ? (string) $value : ''))
                    ->searchable(),
            ]);
    }

    public static function infolist(Infolist $infolist): Infolist
    {
        return $infolist
            ->inlineLabel()
            ->schema([
                InfolistSection::make('Core Information')
                    ->schema([
                        TextEntry::make('internal_name'),
                        TextEntry::make('country.internal_name')
                            ->label('Country'),
                        TextEntry::make('collection.internal_name')
                            ->label('Collection'),
                    ])
                    ->columns(2),
                InfolistSection::make('System Information')
                    ->schema([
                        static::uuidInfolistEntry(),
                        TextEntry::make('backward_compatibility')
                            ->label('Legacy code'),
                        ...static::timestampsInfolistEntries(),
                    ])
                    ->columns(2)
                    ->collapsible()
                    ->collapsed(),
                InfolistSection::make('Metadata')
                    ->schema([
                        ExtraJsonField::infolistEntry(),
                    ])
                    ->collapsible()
                    ->collapsed(),
            ]);
    }

    public static function getRelations(): array
    {
        return [
            EventsRelationManager::class,
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => ListTimeline::route('/'),
            'create' => CreateTimeline::route('/create'),
            'edit' => EditTimeline::route('/{record}/edit'),
            'view' => ViewTimeline::route('/{record}'),
        ];
    }
}
