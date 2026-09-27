<?php

namespace App\Filament\Resources\GlossaryResource\RelationManagers;

use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Concerns\PivotRelationActions;
use App\Filament\Resources\GlossaryResource;
use App\Filament\Support\RecordSelect;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class SynonymsRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;
    use PivotRelationActions;

    protected static string $relationship = 'synonyms';

    protected static ?string $recordTitleAttribute = 'internal_name';

    protected static ?string $title = 'Synonyms';

    public function table(Table $table): Table
    {
        return $table
            ->defaultSort('internal_name', 'asc')
            ->paginated([25, 50, 100])
            ->defaultPaginationPageOption(25)
            ->columns([
                TextColumn::make('internal_name')
                    ->searchable()
                    ->sortable()
                    ->url(fn ($record): ?string => auth()->user()?->can('view', $record)
                        ? GlossaryResource::getUrl('view', ['record' => $record])
                        : null),
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
                // A Glossary can't be its own synonym: excludes the owner record from the select.
                $this->pivotAttachAction(
                    RecordSelect::GLOSSARIES,
                    [],
                    fn (Builder $query): Builder => $query->where('id', '!=', $this->getOwnerRecord()->getKey()),
                ),
            ])
            ->actions([
                $this->pivotViewAction(GlossaryResource::class),
                $this->pivotDetachAction(),
            ])
            ->bulkActions([
                $this->pivotDetachBulkAction(),
            ]);
    }
}
