<?php

namespace App\Filament\Resources\PartnerResource\RelationManagers;

use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Concerns\PivotRelationActions;
use App\Filament\Resources\CollectionResource;
use App\Filament\Support\CollectionDisplayLabel;
use App\Filament\Support\CollectionPartnerPivot;
use App\Filament\Support\RecordSelect;
use App\Models\Collection;
use App\Models\CollectionPartner;
use App\Models\Partner;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * A partner's rows in `collection_partner`, the other side of Collection's
 * PartnersRelationManager (M7 story A2.2, #1901).
 *
 * The pivot's `collection_type` holds two kinds of link: `collection` (the
 * partner takes part in a collection, what the Collection side manages) and
 * `project` (the importer's link from a partner to a project's root
 * collection). Pascal decided on 2026-09-27 that this manager lists both,
 * with the type shown, but only ever changes `collection` links: Attach
 * writes one, and Edit and Detach are offered on `collection` rows only.
 * Detach goes through {@see self::collectionLinks()}, so it can never
 * remove a `project` link, even for a collection linked both ways.
 */
class CollectionParticipationsRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;
    use PivotRelationActions;

    private const COLLECTION_LINK = 'collection';

    protected static string $relationship = 'collections';

    protected static ?string $recordTitleAttribute = 'internal_name';

    protected static ?string $title = 'Collection participations';

    public function table(Table $table): Table
    {
        return $table
            ->modifyQueryUsing(fn (Builder $query): Builder => CollectionDisplayLabel::withDisplayLabel(
                $query->with([
                    'context:id,internal_name',
                    'language:id,internal_name',
                ])
            ))
            ->defaultSort('internal_name', 'asc')
            ->paginated([25, 50, 100])
            ->defaultPaginationPageOption(25)
            ->columns([
                CollectionDisplayLabel::displayLabelColumn()
                    ->url(fn (Collection $record): ?string => auth()->user()?->can('view', $record)
                        ? CollectionResource::getUrl('view', ['record' => $record])
                        : null),
                TextColumn::make('pivot.collection_type')
                    ->label('Collection type')
                    ->badge()
                    ->sortable(),
                CollectionPartnerPivot::levelColumn(),
                CollectionPartnerPivot::visibleColumn(),
                TextColumn::make('type')
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
            ->headerActions([
                $this->pivotAttachAction(RecordSelect::COLLECTIONS, CollectionPartnerPivot::attachFormFields()),
            ])
            ->actions([
                $this->pivotViewAction(CollectionResource::class),
                $this->pivotEditAction(CollectionPartnerPivot::pivotFormFields())
                    ->visible(fn (Model $record): bool => self::isCollectionLink($record)),
                $this->pivotDetachAction()
                    ->visible(fn (Model $record): bool => self::isCollectionLink($record))
                    ->using(function (Model $record): void {
                        $this->collectionLinks()->detach($record->getKey());
                    }),
            ])
            ->bulkActions([
                $this->pivotDetachBulkAction()
                    ->using(function (EloquentCollection $records): void {
                        $this->collectionLinks()->detach($records->modelKeys());
                    }),
            ]);
    }

    /**
     * The partner's `collection` links only. Detaching through this relation
     * deletes pivot rows of that type and leaves `project` links alone.
     *
     * @return BelongsToMany<Collection, Partner, CollectionPartner, 'pivot'>
     */
    private function collectionLinks(): BelongsToMany
    {
        /** @var Partner $partner */
        $partner = $this->getOwnerRecord();

        return $partner->collections()->wherePivot('collection_type', self::COLLECTION_LINK);
    }

    private static function isCollectionLink(Model $record): bool
    {
        $pivot = $record->relationLoaded('pivot') ? $record->getRelation('pivot') : null;

        return $pivot instanceof Model && $pivot->getAttribute('collection_type') === self::COLLECTION_LINK;
    }
}
