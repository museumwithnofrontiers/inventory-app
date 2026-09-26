<?php

namespace App\Filament\Resources\TimelineEventResource\RelationManagers;

use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Resources\ItemResource;
use App\Filament\Support\ItemDisplayLabel;
use App\Filament\Support\RecordSelect;
use App\Models\Item;
use Filament\Forms\Components\TextInput;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Actions\AttachAction;
use Filament\Tables\Actions\DetachAction;
use Filament\Tables\Actions\DetachBulkAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class ItemsRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;

    protected static string $relationship = 'items';

    protected static ?string $recordTitleAttribute = 'internal_name';

    protected static ?string $title = 'Items';

    public function table(Table $table): Table
    {
        return $table
            ->modifyQueryUsing(fn (Builder $query): Builder => ItemDisplayLabel::withDisplayLabel(
                $query->with([
                    'partner:id,internal_name',
                    'project:id,internal_name',
                ])
            ))
            ->defaultSort('internal_name', 'asc')
            ->paginated([25, 50, 100])
            ->defaultPaginationPageOption(25)
            ->columns([
                ItemDisplayLabel::displayLabelColumn()
                    ->url(fn (Item $record): ?string => auth()->user()?->can('view', $record)
                        ? ItemResource::getUrl('view', ['record' => $record])
                        : null),
                TextColumn::make('type')
                    ->badge()
                    ->sortable(),
                TextColumn::make('pivot.display_order')
                    ->label('Display order')
                    ->sortable()
                    ->toggleable(),
                TextColumn::make('internal_name')
                    ->searchable()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->headerActions([
                RecordSelect::recordSelectFor(AttachAction::make(), RecordSelect::ITEMS)
                    ->form(fn (AttachAction $action): array => [
                        $action->getRecordSelect(),
                        TextInput::make('display_order')
                            ->label('Display order')
                            ->numeric()
                            ->integer()
                            ->default(0),
                    ]),
            ])
            ->actions([
                DetachAction::make(),
            ])
            ->bulkActions([
                DetachBulkAction::make(),
            ]);
    }
}
