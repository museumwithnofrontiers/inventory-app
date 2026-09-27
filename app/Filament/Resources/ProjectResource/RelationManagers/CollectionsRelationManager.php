<?php

namespace App\Filament\Resources\ProjectResource\RelationManagers;

use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Resources\CollectionResource;
use App\Filament\Resources\ContextResource;
use App\Filament\Resources\LanguageResource;
use App\Filament\Support\CollectionDisplayLabel;
use App\Models\Collection;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class CollectionsRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;

    protected static string $relationship = 'collections';

    protected static ?string $recordTitleAttribute = 'internal_name';

    protected static ?string $title = 'Collections';

    public function table(Table $table): Table
    {
        return $table
            ->modifyQueryUsing(fn (Builder $query): Builder => CollectionDisplayLabel::withDisplayLabel(
                $query
                    ->select('collections.*')
                    ->distinct()
                    ->with([
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
                TextColumn::make('type')
                    ->sortable(),
                TextColumn::make('context.internal_name')
                    ->label('Context')
                    ->sortable()
                    ->url(fn (Collection $record): ?string => $record->context
                        ? (auth()->user()?->can('view', $record->context) ? ContextResource::getUrl('view', ['record' => $record->context]) : null)
                        : null),
                TextColumn::make('language.internal_name')
                    ->label('Language')
                    ->sortable()
                    ->url(fn (Collection $record): ?string => $record->language
                        ? (auth()->user()?->can('view', $record->language) ? LanguageResource::getUrl('view', ['record' => $record->language]) : null)
                        : null),
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
            ]);
    }
}
