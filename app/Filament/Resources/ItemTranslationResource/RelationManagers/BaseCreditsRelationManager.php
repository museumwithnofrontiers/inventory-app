<?php

namespace App\Filament\Resources\ItemTranslationResource\RelationManagers;

use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Concerns\PivotRelationActions;
use App\Filament\Resources\AuthorResource;
use App\Filament\Support\RecordSelect;
use Filament\Forms\Components\Component;
use Filament\Forms\Components\TextInput;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

/**
 * The people credited on an item translation in one role, in order. One
 * manager per role, each over its own role-scoped relation (attaching sets the
 * role); the four are grouped under one Credits tab on the resource.
 */
abstract class BaseCreditsRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;
    use PivotRelationActions;

    protected static ?string $recordTitleAttribute = 'name';

    public function table(Table $table): Table
    {
        return $table
            ->defaultSort('item_translation_author.display_order', 'asc')
            ->paginated([25, 50, 100])
            ->defaultPaginationPageOption(25)
            ->columns([
                TextColumn::make('pivot.display_order')
                    ->label('Order'),
                TextColumn::make('name')
                    ->label('Name')
                    ->searchable(),
                TextColumn::make('originalname')
                    ->label('Original name')
                    ->toggleable(),
                TextColumn::make('backward_compatibility')
                    ->label('Legacy code')
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->headerActions([
                $this->pivotAttachAction(RecordSelect::AUTHORS, self::pivotFormFields()),
            ])
            ->actions([
                $this->pivotViewAction(AuthorResource::class),
                $this->pivotEditAction(self::pivotFormFields()),
                $this->pivotDetachAction(),
            ])
            ->bulkActions([
                $this->pivotDetachBulkAction(),
            ]);
    }

    /**
     * @return array<int, Component>
     */
    private static function pivotFormFields(): array
    {
        return [
            TextInput::make('display_order')
                ->label('Order')
                ->numeric()
                ->integer()
                ->minValue(0)
                ->default(0)
                ->required(),
        ];
    }
}
