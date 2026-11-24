<?php

namespace App\Filament\Resources\CollectionResource\RelationManagers;

use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Concerns\PivotRelationActions;
use App\Filament\Resources\CountryResource;
use App\Filament\Support\RecordSelect;
use App\Models\Country;
use Filament\Forms\Components\TextInput;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;

/**
 * The other countries a collection covers, besides its main country, in their
 * order (`collection_country`, M16 E3).
 */
class CountriesRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;
    use PivotRelationActions;

    protected static string $relationship = 'countries';

    protected static ?string $recordTitleAttribute = 'internal_name';

    protected static ?string $title = 'Countries';

    /**
     * A collection's countries are part of its data, shown to whoever may view
     * countries (CountryPolicy).
     */
    public static function canViewForRecord(Model $ownerRecord, string $pageClass): bool
    {
        return auth()->user()?->can('viewAny', Country::class) ?? false;
    }

    public function table(Table $table): Table
    {
        return $table
            ->paginated([25, 50, 100])
            ->defaultPaginationPageOption(25)
            ->columns([
                TextColumn::make('pivot.display_order')
                    ->label('Order'),
                TextColumn::make('internal_name')
                    ->label('Country')
                    ->searchable()
                    ->url(fn ($record): ?string => auth()->user()?->can('view', $record)
                        ? CountryResource::getUrl('view', ['record' => $record])
                        : null),
                TextColumn::make('id')
                    ->label('Code')
                    ->searchable(),
            ])
            ->headerActions([
                $this->pivotAttachAction(RecordSelect::COUNTRIES, $this->pivotFields()),
            ])
            ->recordActions([
                $this->pivotViewAction(CountryResource::class),
                $this->pivotEditAction($this->pivotFields()),
                $this->pivotDetachAction(),
            ])
            ->toolbarActions([
                $this->pivotDetachBulkAction(),
            ]);
    }

    /**
     * @return array<int, TextInput>
     */
    private function pivotFields(): array
    {
        return [
            TextInput::make('display_order')
                ->label('Order')
                ->numeric()
                ->integer()
                ->minValue(1)
                ->default(1)
                ->required(),
        ];
    }
}
