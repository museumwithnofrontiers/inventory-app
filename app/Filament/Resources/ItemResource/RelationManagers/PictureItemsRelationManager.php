<?php

namespace App\Filament\Resources\ItemResource\RelationManagers;

use App\Enums\ItemType;
use App\Filament\Resources\ItemResource;
use App\Filament\Resources\PartnerResource;
use App\Filament\Support\ItemDisplayLabel;
use App\Models\Item;
use Filament\Tables\Columns\ImageColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

/**
 * M7 story A1.3 (epic #1872): the has-many convention on an item's own
 * picture items — children with `type = picture`. Header `Create` (Item's own
 * Create page, `parent_id`, `type = picture` and — when the parent has one —
 * `partner_id` pre-filled) and `Attach existing` (AssociateAction, cycle-
 * guarded the same way as A1.2's {@see ChildItemsRelationManager}, further
 * narrowed so only `type = picture` candidates are ever offered). Row `View`
 * · `Edit` · `Detach` (clears `parent_id` only) · `Delete`. Bulk `Detach`. All
 * shared has-many wiring lives on {@see BaseChildItemsRelationManager}; only
 * the table's thumbnail-grid shape (no `type`/`country` columns — every row
 * is already a picture) is this manager's own, kept as it was before this
 * story added actions.
 */
class PictureItemsRelationManager extends BaseChildItemsRelationManager
{
    protected static ?string $title = 'Pictures';

    /**
     * @return array<string, scalar>
     */
    protected function hasManyChildCreateExtra(): array
    {
        return [
            ...parent::hasManyChildCreateExtra(),
            'type' => ItemType::PICTURE->value,
        ];
    }

    /**
     * @param  Builder<Item>  $query
     * @return Builder<Item>
     */
    protected function hasManyChildAssociateScope(Builder $query): Builder
    {
        return parent::hasManyChildAssociateScope($query)
            ->where('type', ItemType::PICTURE->value);
    }

    public function table(Table $table): Table
    {
        return $this->hasManyChildConfigureTable(
            $table
                ->modifyQueryUsing(fn (Builder $query): Builder => $query
                    ->where('type', ItemType::PICTURE->value)
                    ->with([
                        'translations',
                        'collection:id,context_id',
                        'project:id,context_id',
                        'partner:id,internal_name',
                        'itemImages',
                        'parent:id,internal_name,collection_id,project_id',
                        'parent.translations',
                        'parent.collection:id,context_id',
                        'parent.project:id,context_id',
                    ])
                )
                ->defaultSort('display_order', 'asc')
                ->paginated([25, 50, 100])
                ->defaultPaginationPageOption(25)
                ->columns([
                    ImageColumn::make('thumbnail')
                        ->label('Preview')
                        ->getStateUsing(function (Item $record): ?string {
                            $firstImage = $record->itemImages->first();

                            return $firstImage
                                ? route('filament.admin.item-image.view', [
                                    'item' => $record->id,
                                    'itemImage' => $firstImage->id,
                                ])
                                : null;
                        })
                        ->height(48)
                        ->width(48)
                        ->url(function (Item $record): ?string {
                            $firstImage = $record->itemImages->first();

                            return $firstImage
                                ? route('filament.admin.item-image.view', [
                                    'item' => $record->id,
                                    'itemImage' => $firstImage->id,
                                ])
                                : null;
                        })
                        ->openUrlInNewTab()
                        ->defaultImageUrl(null),
                    ItemDisplayLabel::pictureDisplayLabelColumn()
                        ->url(fn (Item $record): ?string => auth()->user()?->can('view', $record)
                            ? ItemResource::getUrl('view', ['record' => $record])
                            : null),
                    TextColumn::make('backward_compatibility')
                        ->label('Legacy code')
                        ->toggleable(),
                    TextColumn::make('partner.internal_name')
                        ->label('Partner')
                        ->sortable()
                        ->url(fn (Item $record): ?string => $record->partner
                            ? (auth()->user()?->can('view', $record->partner) ? PartnerResource::getUrl('view', ['record' => $record->partner]) : null)
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
        );
    }
}
