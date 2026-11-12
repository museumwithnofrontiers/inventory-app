<?php

namespace App\Filament\Resources\PublicationResource\RelationManagers;

use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Concerns\PivotRelationActions;
use App\Filament\Resources\CollectionResource;
use App\Filament\Support\CollectionDisplayLabel;
use App\Filament\Support\PublicationPivot;
use App\Filament\Support\RecordSelect;
use App\Models\Collection;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

/**
 * The collections a publication accompanies (an exhibition trail, an
 * exhibition, a gallery).
 */
class CollectionsRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;
    use PivotRelationActions;

    protected static string $relationship = 'collections';

    protected static ?string $recordTitleAttribute = 'internal_name';

    protected static ?string $title = 'Collections';

    public function table(Table $table): Table
    {
        return $table
            ->inverseRelationship('publications')
            ->modifyQueryUsing(fn (Builder $query): Builder => CollectionDisplayLabel::withDisplayLabel(
                $query->with(['context:id,internal_name'])
            ))
            ->defaultSort('internal_name', 'asc')
            ->paginated([25, 50, 100])
            ->defaultPaginationPageOption(25)
            ->columns([
                CollectionDisplayLabel::displayLabelColumn()
                    ->url(fn (Collection $record): ?string => auth()->user()?->can('view', $record)
                        ? CollectionResource::getUrl('view', ['record' => $record])
                        : null),
                TextColumn::make('type')
                    ->badge()
                    ->sortable(),
                PublicationPivot::displayOrderColumn(),
                TextColumn::make('context.internal_name')
                    ->label('Context')
                    ->toggleable(),
                TextColumn::make('internal_name')
                    ->label('Internal name')
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
                $this->pivotAttachAction(RecordSelect::COLLECTIONS, PublicationPivot::formFields()),
            ])
            ->actions([
                $this->pivotViewAction(CollectionResource::class),
                $this->pivotEditAction(PublicationPivot::formFields()),
                $this->pivotDetachAction(),
            ])
            ->bulkActions([
                $this->pivotDetachBulkAction(),
            ]);
    }
}
