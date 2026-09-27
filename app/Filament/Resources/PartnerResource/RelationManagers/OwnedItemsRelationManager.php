<?php

namespace App\Filament\Resources\PartnerResource\RelationManagers;

use App\Enums\ItemType;
use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Concerns\HasManyChildActions;
use App\Filament\Resources\CollectionResource;
use App\Filament\Resources\ItemResource;
use App\Filament\Resources\ProjectResource;
use App\Filament\Support\ItemDisplayLabel;
use App\Filament\Support\PartnerDisplayLabel;
use App\Filament\Support\RecordSelect;
use App\Models\Item;
use Filament\Forms\Components\Component;
use Filament\Forms\Components\Placeholder;
use Filament\Forms\Get;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

/**
 * M7 story A1.4 (epic #1872): the has-many convention on a partner's owned
 * items. Header `Create` (Item's own Create page, `partner_id` pre-filled)
 * and `Attach existing` (AssociateAction). Filament's own built-in exclusion
 * already limits candidates to items NOT currently owned by this partner, so
 * attaching always either assigns a first owner or RE-ASSIGNS one from
 * another partner.
 *
 * Unlike A1.1-A1.3, that re-assignment silently changes another partner's
 * data unless the UI names it, so the Attach form also carries the
 * confirmation the story requires: a reactive placeholder
 * ({@see self::hasManyChildAssociateFormExtra()}) that names the selected
 * item's current partner, appearing once an item with an existing owner is
 * picked — folded into Filament's own "Attach existing" modal (the admin
 * still has to click "Attach" to proceed) rather than a second dialog.
 *
 * Row `View` · `Edit` · `Detach` (sets `partner_id` to null) · `Delete`. Bulk
 * `Detach`. See {@see HasManyChildActions} for the shared wiring.
 */
class OwnedItemsRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;

    /** @use HasManyChildActions<Item> */
    use HasManyChildActions;

    protected static string $relationship = 'items';

    protected static ?string $recordTitleAttribute = 'internal_name';

    protected static ?string $title = 'Owned items';

    protected static function hasManyChildResource(): string
    {
        return ItemResource::class;
    }

    protected static function hasManyChildForeignKey(): string
    {
        return 'partner_id';
    }

    protected static function hasManyChildRecordSelectEntity(): string
    {
        return RecordSelect::ITEMS;
    }

    /**
     * @return array<int, Component>
     */
    protected function hasManyChildAssociateFormExtra(): array
    {
        return [
            Placeholder::make('previousOwner')
                ->key('previousOwner')
                ->label('Currently owned by')
                ->content(fn (Get $get): string => $this->currentOwnerLabel($get('recordId')) ?? '')
                ->visible(fn (Get $get): bool => $this->currentOwnerLabel($get('recordId')) !== null),
        ];
    }

    /**
     * The selected candidate's current owner label, or null when nothing is
     * selected yet or the item has no partner today (nothing to confirm —
     * it's a first assignment, not a re-assignment).
     */
    private function currentOwnerLabel(mixed $itemId): ?string
    {
        if (! is_string($itemId) || $itemId === '') {
            return null;
        }

        $partnerId = Item::query()->whereKey($itemId)->value('partner_id');

        return is_string($partnerId) ? PartnerDisplayLabel::resolveLabel($partnerId) : null;
    }

    public function table(Table $table): Table
    {
        return $this->hasManyChildConfigureTable(
            $table
                ->modifyQueryUsing(fn (Builder $query): Builder => ItemDisplayLabel::withDisplayLabel(
                    $query->with([
                        'project:id,internal_name',
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
                    TextColumn::make('project.internal_name')
                        ->label('Project')
                        ->sortable()
                        ->url(fn (Item $record): ?string => $record->project
                            ? (auth()->user()?->can('view', $record->project) ? ProjectResource::getUrl('view', ['record' => $record->project]) : null)
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
