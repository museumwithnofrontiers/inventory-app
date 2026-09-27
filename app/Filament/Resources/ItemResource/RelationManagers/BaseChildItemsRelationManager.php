<?php

namespace App\Filament\Resources\ItemResource\RelationManagers;

use App\Enums\ItemType;
use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Concerns\HasManyChildActions;
use App\Filament\Resources\CountryResource;
use App\Filament\Resources\ItemResource;
use App\Filament\Resources\PartnerResource;
use App\Filament\Support\ItemDisplayLabel;
use App\Filament\Support\RecordSelect;
use App\Models\Item;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

/**
 * The shared "child items of an Item" shape (M7 epic #1872), extracted so
 * A1.2's {@see ChildItemsRelationManager} and A1.3's PictureItemsRelationManager
 * can both sit on the has-many convention without drifting apart: both list
 * `children()` (`items.parent_id`), both must never let a candidate become its
 * own ancestor's child, and both create/attach against ItemResource.
 *
 * A subclass may override:
 * - {@see self::hasManyChildCreateExtra()} to add its own header `Create`
 *   pre-fill on top of `partner_id` (e.g. A1.3's `type => picture`) — call
 *   `parent::hasManyChildCreateExtra()` and merge in.
 * - {@see self::hasManyChildAssociateScope()} to narrow `Attach existing`
 *   further on top of the cycle guard (e.g. A1.3 limiting candidates to
 *   `type = picture`) — call `parent::hasManyChildAssociateScope($query)` and
 *   chain onto it.
 * - `table()` entirely, for a different column/query shape (A1.3's thumbnail
 *   grid) while still finishing with `hasManyChildConfigureTable()`.
 */
abstract class BaseChildItemsRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;

    /** @use HasManyChildActions<Item> */
    use HasManyChildActions;

    protected static string $relationship = 'children';

    protected static ?string $recordTitleAttribute = 'internal_name';

    protected static function hasManyChildResource(): string
    {
        return ItemResource::class;
    }

    protected static function hasManyChildForeignKey(): string
    {
        return 'parent_id';
    }

    protected static function hasManyChildRecordSelectEntity(): string
    {
        return RecordSelect::ITEMS;
    }

    /**
     * A1.2: the header `Create` action also pre-fills `partner_id` from the
     * parent item's own partner, when it has one — a child item defaults to
     * the same partner as its parent.
     *
     * @return array<string, scalar>
     */
    protected function hasManyChildCreateExtra(): array
    {
        /** @var Item $owner */
        $owner = $this->getOwnerRecord();

        return $owner->partner_id !== null
            ? ['partner_id' => $owner->partner_id]
            : [];
    }

    /**
     * A1.2's cycle guard: attaching a candidate as a child of the owner item
     * would create a cycle only if the candidate is the owner itself or one
     * of the owner's ancestors — never for a descendant, which is already
     * inside the owner's own subtree. Hence excludingAncestorsOf(), not
     * excludingDescendantsOf() (the story text's mechanism was inverted; see
     * the PR body).
     *
     * @param  Builder<Item>  $query
     * @return Builder<Item>
     */
    protected function hasManyChildAssociateScope(Builder $query): Builder
    {
        /** @var Item $owner */
        $owner = $this->getOwnerRecord();

        return RecordSelect::excludingAncestorsOf($query, $owner);
    }

    public function table(Table $table): Table
    {
        return $this->hasManyChildConfigureTable(
            $table
                ->modifyQueryUsing(fn (Builder $query): Builder => ItemDisplayLabel::withDisplayLabel(
                    $query->with([
                        'partner:id,internal_name',
                        'country:id,internal_name',
                    ])
                ))
                ->defaultSort('display_order', 'asc')
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
                    TextColumn::make('country.internal_name')
                        ->label('Country')
                        ->sortable()
                        ->url(fn (Item $record): ?string => $record->country
                            ? (auth()->user()?->can('view', $record->country) ? CountryResource::getUrl('view', ['record' => $record->country]) : null)
                            : null),
                    TextColumn::make('display_order')
                        ->label('Order')
                        ->sortable(),
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
                ->filters([
                    SelectFilter::make('type')
                        ->options([
                            ItemType::DETAIL->value => ItemType::DETAIL->label(),
                            ItemType::PICTURE->value => ItemType::PICTURE->label(),
                        ]),
                ])
        );
    }
}
