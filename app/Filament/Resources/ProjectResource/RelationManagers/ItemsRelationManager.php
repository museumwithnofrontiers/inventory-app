<?php

namespace App\Filament\Resources\ProjectResource\RelationManagers;

use App\Enums\ItemType;
use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Concerns\HasManyChildActions;
use App\Filament\Resources\CollectionResource;
use App\Filament\Resources\ItemResource;
use App\Filament\Resources\PartnerResource;
use App\Filament\Support\ItemDisplayLabel;
use App\Filament\Support\RecordSelect;
use App\Models\Item;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

/**
 * M7 story A5.3 (epic #1876): the has-many convention on a project's items.
 * Header `Create` (Item's own Create page, `project_id` pre-filled) and
 * `Attach existing` (AssociateAction). Row `View` · `Edit` · `Detach` (sets
 * `project_id` to null) · `Delete`. Bulk `Detach`. See
 * {@see HasManyChildActions} for the shared wiring.
 */
class ItemsRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;

    /** @use HasManyChildActions<Item> */
    use HasManyChildActions;

    protected static string $relationship = 'items';

    protected static ?string $recordTitleAttribute = 'internal_name';

    protected static ?string $title = 'Items';

    protected static function hasManyChildResource(): string
    {
        return ItemResource::class;
    }

    protected static function hasManyChildForeignKey(): string
    {
        return 'project_id';
    }

    protected static function hasManyChildRecordSelectEntity(): string
    {
        return RecordSelect::ITEMS;
    }

    public function table(Table $table): Table
    {
        return $this->hasManyChildConfigureTable(
            $table
                ->modifyQueryUsing(fn (Builder $query): Builder => ItemDisplayLabel::withDisplayLabel(
                    $query->with([
                        'partner:id,internal_name',
                        'collection:id,internal_name',
                    ])
                ))
                ->defaultSort('internal_name', 'asc')
                ->paginated([25, 50, 100])
                ->defaultPaginationPageOption(25)
                ->columns([
                    ItemDisplayLabel::displayLabelColumn()
                        ->url(fn (Item $record): ?string => auth()->user()?->can('view', $record)
                            ? ItemResource::getUrl('view', ['record' => $record])
                            : null),
                    TextColumn::make('type')
                        ->badge()
                        ->formatStateUsing(fn (?ItemType $state): ?string => $state?->label())
                        ->sortable(),
                    TextColumn::make('partner.internal_name')
                        ->label('Partner')
                        ->sortable()
                        ->url(fn (Item $record): ?string => $record->partner
                            ? (auth()->user()?->can('view', $record->partner) ? PartnerResource::getUrl('view', ['record' => $record->partner]) : null)
                            : null),
                    TextColumn::make('collection.internal_name')
                        ->label('Collection')
                        ->sortable()
                        ->url(fn (Item $record): ?string => $record->collection
                            ? (auth()->user()?->can('view', $record->collection) ? CollectionResource::getUrl('view', ['record' => $record->collection]) : null)
                            : null),
                    TextColumn::make('internal_name')
                        ->searchable()
                        ->sortable()
                        ->toggleable(isToggledHiddenByDefault: true),
                    TextColumn::make('created_at')
                        ->label('Created')
                        ->dateTime()
                        ->sortable()
                        ->toggleable(isToggledHiddenByDefault: true),
                ])
        );
    }
}
