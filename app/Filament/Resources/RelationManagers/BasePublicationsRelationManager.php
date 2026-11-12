<?php

namespace App\Filament\Resources\RelationManagers;

use App\Enums\PublicationCategory;
use App\Enums\PublicationStatus;
use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Concerns\PivotRelationActions;
use App\Filament\Resources\PublicationResource;
use App\Filament\Support\PublicationPivot;
use App\Filament\Support\RecordSelect;
use App\Models\Publication;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

/**
 * The publications side of publication_collection and publication_item, on
 * the Collection and Item resources: attach, view, edit pivot and detach
 * under the host's own `update` (AuthorizesRelationMutations).
 */
abstract class BasePublicationsRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;
    use PivotRelationActions;

    protected static string $relationship = 'publications';

    protected static ?string $recordTitleAttribute = 'internal_name';

    protected static ?string $title = 'Publications';

    /**
     * The relation on Publication that points back at the host
     * ('collections' or 'items').
     */
    abstract protected static function inverseRelationshipName(): string;

    public function table(Table $table): Table
    {
        return $table
            ->inverseRelationship(static::inverseRelationshipName())
            ->defaultSort('internal_name', 'asc')
            ->paginated([25, 50, 100])
            ->defaultPaginationPageOption(25)
            ->columns([
                TextColumn::make('internal_name')
                    ->label('Publication')
                    ->searchable()
                    ->sortable()
                    ->url(fn (Publication $record): ?string => auth()->user()?->can('view', $record)
                        ? PublicationResource::getUrl('view', ['record' => $record])
                        : null),
                TextColumn::make('category')
                    ->badge()
                    ->formatStateUsing(fn (?PublicationCategory $state): ?string => $state?->label())
                    ->sortable(),
                TextColumn::make('status')
                    ->badge()
                    ->formatStateUsing(fn (?PublicationStatus $state): ?string => $state?->label())
                    ->toggleable(),
                PublicationPivot::displayOrderColumn(),
                TextColumn::make('backward_compatibility')
                    ->label('Legacy code')
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('created_at')
                    ->label('Created')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->headerActions([
                $this->pivotAttachAction(RecordSelect::PUBLICATIONS, PublicationPivot::formFields()),
            ])
            ->actions([
                $this->pivotViewAction(PublicationResource::class),
                $this->pivotEditAction(PublicationPivot::formFields()),
                $this->pivotDetachAction(),
            ])
            ->bulkActions([
                $this->pivotDetachBulkAction(),
            ]);
    }
}
