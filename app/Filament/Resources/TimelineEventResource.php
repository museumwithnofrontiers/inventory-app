<?php

namespace App\Filament\Resources;

use App\Enums\Permission;
use App\Filament\Concerns\HasBackwardCompatibilityColumn;
use App\Filament\Concerns\HasInternalNameColumn;
use App\Filament\Concerns\HasTimestampsColumns;
use App\Filament\Concerns\HasUuidColumn;
use App\Filament\Resources\TimelineEventResource\Pages\CreateTimelineEvent;
use App\Filament\Resources\TimelineEventResource\Pages\EditTimelineEvent;
use App\Filament\Resources\TimelineEventResource\Pages\ListTimelineEvent;
use App\Filament\Resources\TimelineEventResource\Pages\ViewTimelineEvent;
use App\Filament\Resources\TimelineEventResource\RelationManagers\ImagesRelationManager;
use App\Filament\Resources\TimelineEventResource\RelationManagers\ItemsRelationManager;
use App\Filament\Resources\TimelineEventResource\RelationManagers\TranslationsRelationManager;
use App\Filament\Support\ExtraJsonField;
use App\Filament\Support\RecordSelect;
use App\Filament\Support\TimelineEventDisplayLabel;
use App\Models\Timeline;
use App\Models\TimelineEvent;
use Filament\Forms\Components\DatePicker;
use Filament\Forms\Components\Section;
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
use Illuminate\Database\Eloquent\Builder;

class TimelineEventResource extends Resource
{
    use HasBackwardCompatibilityColumn;
    use HasInternalNameColumn;
    use HasTimestampsColumns;
    use HasUuidColumn;

    protected static ?string $model = TimelineEvent::class;

    protected static ?string $navigationIcon = 'heroicon-o-calendar-days';

    protected static ?string $navigationGroup = 'Inventory';

    protected static ?int $navigationSort = 9;

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
                        RecordSelect::forTimelines(),
                        TextInput::make('year_from')
                            ->label('Year from')
                            ->numeric()
                            ->integer()
                            ->nullable(),
                        TextInput::make('year_to')
                            ->label('Year to')
                            ->numeric()
                            ->integer()
                            ->nullable(),
                        TextInput::make('year_from_ah')
                            ->label('Year from (AH)')
                            ->numeric()
                            ->integer()
                            ->nullable(),
                        TextInput::make('year_to_ah')
                            ->label('Year to (AH)')
                            ->numeric()
                            ->integer()
                            ->nullable(),
                        DatePicker::make('date_from')
                            ->label('Date from')
                            ->nullable(),
                        DatePicker::make('date_to')
                            ->label('Date to')
                            ->nullable(),
                        TextInput::make('display_order')
                            ->label('Display order')
                            ->numeric()
                            ->integer()
                            ->nullable(),
                    ])
                    ->columns(2),
                Section::make('Technical identification')
                    ->description('System metadata used for technical identification and legacy imports.')
                    ->schema([
                        TextInput::make('internal_name')
                            ->required()
                            ->maxLength(255),
                        TextInput::make('backward_compatibility')
                            ->label('Legacy code')
                            ->maxLength(255)
                            ->nullable(),
                    ])
                    ->columns(2)
                    ->collapsed(fn (?TimelineEvent $record): bool => $record !== null),
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
            ->recordUrl(fn (TimelineEvent $record): ?string => auth()->user()?->can('view', $record) ? static::getUrl('view', ['record' => $record]) : null)
            ->modifyQueryUsing(fn (Builder $query): Builder => TimelineEventDisplayLabel::withDisplayLabel($query))
            ->defaultSort('internal_name', 'asc')
            ->columns([
                TimelineEventDisplayLabel::displayLabelColumn()
                    ->url(fn (TimelineEvent $record): ?string => auth()->user()?->can('view', $record) ? static::getUrl('view', ['record' => $record]) : null),
                TextColumn::make('timeline.internal_name')
                    ->label('Timeline')
                    ->sortable(),
                TextColumn::make('year_from')
                    ->label('Year from')
                    ->sortable(),
                TextColumn::make('year_to')
                    ->label('Year to')
                    ->sortable()
                    ->toggleable(),
                TextColumn::make('display_order')
                    ->label('Order')
                    ->sortable(),
                static::backwardCompatibilityColumn(),
                static::uuidColumn(),
                ...static::timestampsColumns(),
                static::internalNameColumn()
                    ->label('Internal name')
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->actions([
                ViewAction::make(),
                EditAction::make(),
                DeleteAction::make(),
            ])
            ->filters([
                SelectFilter::make('timeline_id')
                    ->label('Timeline')
                    ->getSearchResultsUsing(fn (string $search): array => Timeline::query()
                        ->where('internal_name', 'like', "%{$search}%")
                        ->orWhere('backward_compatibility', 'like', "%{$search}%")
                        ->orWhere('id', 'like', "%{$search}%")
                        ->orderBy('internal_name')
                        ->limit(50)
                        ->pluck('internal_name', 'id')
                        ->all()
                    )
                    ->getOptionLabelUsing(fn (mixed $value): string => is_string($value) ? (Timeline::find($value)->internal_name ?? $value) : '')
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
                        TextEntry::make('timeline.internal_name')
                            ->label('Timeline'),
                        TextEntry::make('year_from')
                            ->label('Year from'),
                        TextEntry::make('year_to')
                            ->label('Year to'),
                        TextEntry::make('year_from_ah')
                            ->label('Year from (AH)'),
                        TextEntry::make('year_to_ah')
                            ->label('Year to (AH)'),
                        TextEntry::make('date_from')
                            ->label('Date from')
                            ->date(),
                        TextEntry::make('date_to')
                            ->label('Date to')
                            ->date(),
                        TextEntry::make('display_order')
                            ->label('Display order'),
                    ])
                    ->columns(2),
                InfolistSection::make('System Information')
                    ->schema([
                        static::uuidInfolistEntry(),
                        TextEntry::make('internal_name')
                            ->label('Internal name'),
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
            TranslationsRelationManager::class,
            ImagesRelationManager::class,
            ItemsRelationManager::class,
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => ListTimelineEvent::route('/'),
            'create' => CreateTimelineEvent::route('/create'),
            'edit' => EditTimelineEvent::route('/{record}/edit'),
            'view' => ViewTimelineEvent::route('/{record}'),
        ];
    }
}
