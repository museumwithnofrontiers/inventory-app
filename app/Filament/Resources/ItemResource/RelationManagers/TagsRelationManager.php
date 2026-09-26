<?php

namespace App\Filament\Resources\ItemResource\RelationManagers;

use App\Enums\Permission;
use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Resources\TagResource;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Actions\AttachAction;
use Filament\Tables\Actions\DetachAction;
use Filament\Tables\Actions\DetachBulkAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;

class TagsRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;

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
                AttachAction::make()
                    ->recordSelectSearchColumns(['internal_name', 'description']),
            ])
            ->actions([
                DetachAction::make(),
            ])
            ->bulkActions([
                DetachBulkAction::make(),
            ]);
    }
}
