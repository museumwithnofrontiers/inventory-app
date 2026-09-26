<?php

namespace App\Filament\Resources\CollectionResource\RelationManagers;

use App\Enums\ItemType;
use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Pages\ViewCollectionItemAppearance;
use App\Filament\Resources\ItemResource;
use App\Filament\Resources\PartnerResource;
use App\Filament\Resources\ProjectResource;
use App\Filament\Support\CollectionItemAppearance;
use App\Filament\Support\ItemDisplayLabel;
use App\Models\Collection;
use App\Models\Item;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Actions\Action;
use Filament\Tables\Actions\AttachAction;
use Filament\Tables\Actions\DetachAction;
use Filament\Tables\Actions\DetachBulkAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class ItemsRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;

    protected static string $relationship = 'attachedItems';

    protected static ?string $recordTitleAttribute = 'internal_name';

    protected static ?string $title = 'Items';

    public function table(Table $table): Table
    {
        return $table
            ->inverseRelationship('attachedToCollections')
            ->modifyQueryUsing(fn (Builder $query): Builder => ItemDisplayLabel::withDisplayLabel(
                $query->with([
                    'partner:id,internal_name',
                    'project:id,internal_name',
                ])
            )->orderByRaw('collection_item.display_order IS NULL, collection_item.display_order ASC')
                ->orderBy('display_label', 'asc'))
            ->paginated([25, 50, 100])
            ->defaultPaginationPageOption(25)
            ->columns([
                ItemDisplayLabel::displayLabelColumn()
                    ->url(fn (Item $record): string => ItemResource::getUrl('view', ['record' => $record])),
                CollectionItemAppearance::displayOrderColumn(),
                CollectionItemAppearance::contextualTextPreviewColumn(),
                CollectionItemAppearance::contextualTextLanguagesColumn(),
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
                TextColumn::make('project.internal_name')
                    ->label('Project')
                    ->sortable()
                    ->url(fn (Item $record): ?string => $record->project
                        ? (auth()->user()?->can('view', $record->project) ? ProjectResource::getUrl('view', ['record' => $record->project]) : null)
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
            ->headerActions([
                AttachAction::make()
                    ->recordSelectSearchColumns(['internal_name']),
            ])
            ->actions([
                Action::make('view_appearance')
                    ->label('View appearance')
                    ->icon('heroicon-o-document-text')
                    ->color('gray')
                    ->url(function (Item $record): string {
                        /** @var Collection $collection */
                        $collection = $this->getOwnerRecord();

                        return ViewCollectionItemAppearance::getAppearanceUrl($collection, $record);
                    }),
                DetachAction::make(),
            ])
            ->bulkActions([
                DetachBulkAction::make(),
            ]);
    }
}
