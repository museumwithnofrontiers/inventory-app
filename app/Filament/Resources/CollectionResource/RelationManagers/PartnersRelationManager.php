<?php

namespace App\Filament\Resources\CollectionResource\RelationManagers;

use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Concerns\PivotRelationActions;
use App\Filament\Resources\CountryResource;
use App\Filament\Resources\PartnerResource;
use App\Filament\Support\CollectionPartnerPivot;
use App\Filament\Support\MarkdownState;
use App\Filament\Support\PartnerDisplayLabel;
use App\Filament\Support\RecordSelect;
use App\Models\Partner;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Database\Eloquent\Model;

class PartnersRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;
    use PivotRelationActions;

    protected static string $relationship = 'partners';

    protected static ?string $recordTitleAttribute = 'internal_name';

    protected static ?string $title = 'Partners';

    public function table(Table $table): Table
    {
        return $table
            ->modifyQueryUsing(fn (Builder $query): Builder => PartnerDisplayLabel::withDisplayLabel(
                $query->with([
                    'country:id,internal_name',
                ])
            ))
            ->defaultSort('internal_name', 'asc')
            ->paginated([25, 50, 100])
            ->defaultPaginationPageOption(25)
            ->columns([
                PartnerDisplayLabel::displayLabelColumn()
                    ->url(fn (Partner $record): ?string => auth()->user()?->can('view', $record)
                        ? PartnerResource::getUrl('view', ['record' => $record])
                        : null),
                TextColumn::make('type')
                    ->badge()
                    ->sortable(),
                CollectionPartnerPivot::levelColumn(),
                CollectionPartnerPivot::visibleColumn(),
                CollectionPartnerPivot::parentPartnerColumn(),
                TextColumn::make('country.internal_name')
                    ->label('Country')
                    ->sortable()
                    ->url(fn (Partner $record): ?string => $record->country
                        ? (auth()->user()?->can('view', $record->country) ? CountryResource::getUrl('view', ['record' => $record->country]) : null)
                        : null),
                TextColumn::make('internal_name')
                    ->formatStateUsing(MarkdownState::inline())
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
                $this->pivotAttachAction(RecordSelect::PARTNERS, CollectionPartnerPivot::attachFormFields(CollectionPartnerPivot::OWNER_COLLECTION)),
            ])
            ->recordActions([
                $this->pivotViewAction(PartnerResource::class),
                $this->pivotEditAction(CollectionPartnerPivot::pivotFormFields(CollectionPartnerPivot::OWNER_COLLECTION)),
                $this->pivotDetachAction()
                    ->after(fn (Model $record) => $this->clearParentReferencesTo([$record->getKey()])),
            ])
            ->toolbarActions([
                $this->pivotDetachBulkAction()
                    ->after(fn (EloquentCollection $records) => $this->clearParentReferencesTo($records->modelKeys())),
            ]);
    }

    /**
     * These partners left the collection: the rows that named one of them as
     * their parent no longer have one.
     *
     * @param  array<int, mixed>  $partnerIds
     */
    private function clearParentReferencesTo(array $partnerIds): void
    {
        $collectionId = $this->getOwnerRecord()->getKey();
        if (! is_string($collectionId)) {
            return;
        }

        CollectionPartnerPivot::clearParentReferences(
            $collectionId,
            array_values(array_filter($partnerIds, 'is_string')),
        );
    }
}
