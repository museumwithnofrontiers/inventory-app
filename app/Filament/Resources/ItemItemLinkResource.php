<?php

namespace App\Filament\Resources;

use App\Enums\ItemType;
use App\Filament\Concerns\HasTimestampsColumns;
use App\Filament\Concerns\HasUuidColumn;
use App\Filament\Resources\ItemItemLinkResource\Pages\CreateItemItemLink;
use App\Filament\Resources\ItemItemLinkResource\Pages\EditItemItemLink;
use App\Filament\Resources\ItemItemLinkResource\Pages\ListItemItemLink;
use App\Filament\Resources\ItemItemLinkResource\Pages\ViewItemItemLink;
use App\Filament\Resources\ItemItemLinkResource\RelationManagers\TranslationsRelationManager;
use App\Filament\Support\MarkdownState;
use App\Filament\Support\TranslationFormSchema;
use App\Models\ItemItemLink;
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

class ItemItemLinkResource extends Resource
{
    use HasTimestampsColumns;
    use HasUuidColumn;

    protected static ?string $model = ItemItemLink::class;

    protected static ?string $navigationIcon = 'heroicon-o-link';

    protected static ?string $navigationGroup = 'Inventory';

    protected static ?int $navigationSort = 7;

    protected static ?string $navigationLabel = 'Item Links';

    protected static ?string $recordTitleAttribute = 'id';

    public static function canViewAny(): bool
    {
        return auth()->user()?->can('viewAny', static::getModel()) ?? false;
    }

    public static function shouldRegisterNavigation(): bool
    {
        return static::canViewAny();
    }

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                TranslationFormSchema::itemSelectField(name: 'source_id', label: 'Source item'),
                TranslationFormSchema::itemSelectField(name: 'target_id', label: 'Target item'),
                TranslationFormSchema::contextSelectField(required: false),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->recordUrl(fn (ItemItemLink $record): ?string => auth()->user()?->can('view', $record) ? static::getUrl('view', ['record' => $record]) : null)
            ->modifyQueryUsing(fn (Builder $query): Builder => $query->with([
                'source:id,internal_name,type,backward_compatibility',
                'target:id,internal_name,type,backward_compatibility',
                'context:id,internal_name',
            ]))
            ->defaultSort('created_at', 'desc')
            ->paginated([25, 50, 100])
            ->defaultPaginationPageOption(25)
            ->columns([
                TextColumn::make('source.internal_name')
                    ->formatStateUsing(MarkdownState::inline())
                    ->label('Source item')
                    ->sortable()
                    ->searchable()
                    ->url(fn (ItemItemLink $record): ?string => $record->source
                        ? (auth()->user()?->can('view', $record->source) ? ItemResource::getUrl('view', ['record' => $record->source]) : null)
                        : null),
                TextColumn::make('source.type')
                    ->label('Source type')
                    ->badge()
                    ->formatStateUsing(fn (mixed $state): string => $state instanceof ItemType ? $state->label() : (is_scalar($state) ? (string) $state : ''))
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('target.internal_name')
                    ->formatStateUsing(MarkdownState::inline())
                    ->label('Target item')
                    ->sortable()
                    ->searchable()
                    ->url(fn (ItemItemLink $record): ?string => $record->target
                        ? (auth()->user()?->can('view', $record->target) ? ItemResource::getUrl('view', ['record' => $record->target]) : null)
                        : null),
                TextColumn::make('target.type')
                    ->label('Target type')
                    ->badge()
                    ->formatStateUsing(fn (mixed $state): string => $state instanceof ItemType ? $state->label() : (is_scalar($state) ? (string) $state : ''))
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('context.internal_name')
                    ->label('Context')
                    ->sortable()
                    ->url(fn (ItemItemLink $record): ?string => $record->context
                        ? (auth()->user()?->can('view', $record->context) ? ContextResource::getUrl('view', ['record' => $record->context]) : null)
                        : null),
                static::uuidColumn(),
                ...static::timestampsColumns(),
            ])
            ->filters([
                SelectFilter::make('context_id')
                    ->label('Context')
                    ->relationship('context', 'internal_name')
                    ->searchable(),
            ])
            ->actions([
                ViewAction::make(),
                EditAction::make(),
                DeleteAction::make(),
            ]);
    }

    public static function infolist(Infolist $infolist): Infolist
    {
        return $infolist
            ->inlineLabel()
            ->schema([
                InfolistSection::make('Link Details')
                    ->schema([
                        TextEntry::make('source.internal_name')
                            ->formatStateUsing(MarkdownState::inline())
                            ->label('Source item')
                            ->url(fn (ItemItemLink $record): ?string => $record->source
                                ? (auth()->user()?->can('view', $record->source) ? ItemResource::getUrl('view', ['record' => $record->source]) : null)
                                : null),
                        TextEntry::make('target.internal_name')
                            ->formatStateUsing(MarkdownState::inline())
                            ->label('Target item')
                            ->url(fn (ItemItemLink $record): ?string => $record->target
                                ? (auth()->user()?->can('view', $record->target) ? ItemResource::getUrl('view', ['record' => $record->target]) : null)
                                : null),
                        TextEntry::make('context.internal_name')
                            ->label('Context')
                            ->url(fn (ItemItemLink $record): ?string => $record->context
                                ? (auth()->user()?->can('view', $record->context) ? ContextResource::getUrl('view', ['record' => $record->context]) : null)
                                : null),
                    ])
                    ->columns(2),
                InfolistSection::make('System Information')
                    ->schema([
                        static::uuidInfolistEntry(),
                        ...static::timestampsInfolistEntries(),
                    ])
                    ->columns(2)
                    ->collapsible()
                    ->collapsed(),
            ]);
    }

    public static function getRelations(): array
    {
        return [
            TranslationsRelationManager::class,
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => ListItemItemLink::route('/'),
            'create' => CreateItemItemLink::route('/create'),
            'edit' => EditItemItemLink::route('/{record}/edit'),
            'view' => ViewItemItemLink::route('/{record}'),
        ];
    }
}
