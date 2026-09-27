<?php

namespace App\Filament\Resources\ItemResource\RelationManagers;

use App\Enums\Permission;
use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Concerns\PivotRelationActions;
use App\Filament\Resources\TagResource;
use App\Filament\Support\RecordSelect;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;

class TagsRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;
    use PivotRelationActions;

    protected static string $relationship = 'tags';

    protected static ?string $recordTitleAttribute = 'internal_name';

    protected static ?string $title = 'Tags';

    public static function canViewForRecord(Model $ownerRecord, string $pageClass): bool
    {
        return auth()->user()?->hasPermissionTo(Permission::VIEW_DATA->value) ?? false;
    }

    public function table(Table $table): Table
    {
        return $table
            ->defaultSort('description', 'asc')
            ->paginated([25, 50, 100])
            ->defaultPaginationPageOption(25)
            ->columns([
                TextColumn::make('description')
                    ->label('Tag')
                    ->sortable()
                    ->url(fn ($record): ?string => auth()->user()?->can('view', $record)
                        ? TagResource::getUrl('view', ['record' => $record])
                        : null),
                TextColumn::make('internal_name')
                    ->searchable()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('category')
                    ->badge()
                    ->sortable(),
                TextColumn::make('backward_compatibility')
                    ->label('Legacy code')
                    ->toggleable(),
                TextColumn::make('created_at')
                    ->label('Created')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->headerActions([
                $this->pivotAttachAction(RecordSelect::TAGS, []),
            ])
            ->actions([
                $this->pivotViewAction(TagResource::class),
                $this->pivotDetachAction(),
            ])
            ->bulkActions([
                $this->pivotDetachBulkAction(),
            ]);
    }
}
