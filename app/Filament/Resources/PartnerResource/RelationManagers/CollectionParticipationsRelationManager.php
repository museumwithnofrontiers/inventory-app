<?php

namespace App\Filament\Resources\PartnerResource\RelationManagers;

use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Concerns\PivotRelationActions;
use App\Filament\Resources\CollectionResource;
use App\Filament\Support\CollectionDisplayLabel;
use App\Filament\Support\CollectionPartnerPivot;
use App\Filament\Support\RecordSelect;
use App\Models\Collection;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class CollectionParticipationsRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;
    use PivotRelationActions;

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
                $this->pivotAttachAction(
                    RecordSelect::COLLECTIONS,
                    CollectionPartnerPivot::attachFormFields(),
                    // @phpstan-ignore method.notFound (Collection::scopeCollections(), a real local scope restricting Attach to `type = collection`)
                    fn (Builder $query): Builder => $query->collections(),
                ),
            ])
            ->actions([
                $this->pivotViewAction(CollectionResource::class),
                $this->pivotEditAction(CollectionPartnerPivot::pivotFormFields()),
                $this->pivotDetachAction(),
            ])
            ->bulkActions([
                $this->pivotDetachBulkAction(),
            ]);
    }
}
