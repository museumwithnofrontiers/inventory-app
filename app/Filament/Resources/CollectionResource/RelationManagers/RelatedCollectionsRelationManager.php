<?php

namespace App\Filament\Resources\CollectionResource\RelationManagers;

use App\Enums\CollectionRelationKind;
use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Concerns\PivotRelationActions;
use App\Filament\Resources\CollectionResource;
use App\Filament\Support\CollectionDisplayLabel;
use App\Filament\Support\RecordSelect;
use App\Models\Collection;
use Filament\Forms\Components\Component;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;

/**
 * The collections a collection links to, by kind (`collection_collection`,
 * M16 E3): an Explore itinerary's locations and territories, a region's
 * themes, a location's other regions and its historical background.
 */
class RelatedCollectionsRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;
    use PivotRelationActions;

    protected static string $relationship = 'relatedCollections';

    protected static ?string $recordTitleAttribute = 'internal_name';

    protected static ?string $title = 'Related collections';

    public function table(Table $table): Table
    {
        return $table
            ->paginated([25, 50, 100])
            ->defaultPaginationPageOption(25)
            ->columns([
                TextColumn::make('pivot.kind')
                    ->label('Kind')
                    ->badge()
                    ->formatStateUsing(fn (?string $state): string => CollectionRelationKind::tryFrom((string) $state)?->label() ?? (string) $state),
                TextColumn::make('pivot.display_order')
                    ->label('Order'),
                TextColumn::make('internal_name')
                    ->label('Collection')
                    ->formatStateUsing(fn (Collection $record): string => CollectionDisplayLabel::resolveLabel($record->id) ?: $record->internal_name)
                    ->searchable()
                    ->url(fn (Collection $record): ?string => auth()->user()?->can('view', $record)
                        ? CollectionResource::getUrl('view', ['record' => $record])
                        : null),
                TextColumn::make('type')
                    ->badge(),
                TextColumn::make('backward_compatibility')
                    ->label('Legacy code')
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                SelectFilter::make('kind')
                    ->options(CollectionRelationKind::options())
                    ->query(fn ($query, array $data) => filled($data['value'] ?? null)
                        ? $query->where('collection_collection.kind', $data['value'])
                        : $query),
            ])
            ->headerActions([
                $this->pivotAttachAction(RecordSelect::COLLECTIONS, $this->pivotFields()),
            ])
            ->actions([
                $this->pivotViewAction(CollectionResource::class),
                $this->pivotEditAction([$this->orderField()]),
                $this->pivotDetachAction(),
            ])
            ->bulkActions([
                $this->pivotDetachBulkAction(),
            ]);
    }

    /**
     * @return array<int, Component>
     */
    private function pivotFields(): array
    {
        return [
            Select::make('kind')
                ->options(CollectionRelationKind::options())
                ->required(),
            $this->orderField(),
        ];
    }

    private function orderField(): TextInput
    {
        return TextInput::make('display_order')
            ->label('Order')
            ->numeric()
            ->integer()
            ->minValue(1)
            ->default(1)
            ->required();
    }
}
