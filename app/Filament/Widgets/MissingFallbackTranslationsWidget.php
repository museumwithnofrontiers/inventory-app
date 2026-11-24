<?php

namespace App\Filament\Widgets;

use App\Enums\ItemType;
use App\Filament\Resources\CollectionResource;
use App\Filament\Resources\ItemResource;
use App\Filament\Resources\PartnerResource;
use App\Filament\Support\CollectionDisplayLabel;
use App\Filament\Support\ItemDisplayLabel;
use App\Filament\Support\MarkdownState;
use App\Filament\Support\PartnerDisplayLabel;
use App\Models\Collection;
use App\Models\Context;
use App\Models\Item;
use App\Models\ItemTranslation;
use App\Models\Language;
use App\Models\Partner;
use Filament\Actions\Action;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Filament\Widgets\TableWidget as BaseWidget;
use Illuminate\Database\Eloquent\Builder;

class MissingFallbackTranslationsWidget extends BaseWidget
{
    protected static ?int $sort = 4;

    protected int|string|array $columnSpan = 'full';

    public string $ownerType = 'item';

    public static function canView(): bool
    {
        return auth()->user()?->can('viewAny', ItemTranslation::class) ?? false;
    }

    public function table(Table $table): Table
    {
        return match ($this->ownerType) {
            'collection' => $this->collectionTable($table),
            'partner' => $this->partnerTable($table),
            default => $this->itemTable($table),
        };
    }

    /**
     * @template TModel of \Illuminate\Database\Eloquent\Model
     *
     * @param  Builder<TModel>  $query
     * @return Builder<TModel>
     */
    private function missingFallbackQuery(Builder $query): Builder
    {
        return $query->whereDoesntHave(
            'translations',
            fn (Builder $q): Builder => $q
                ->where('language_id', Language::default()->value('id'))
                ->where('context_id', Context::default()->value('id'))
        );
    }

    private function itemTable(Table $table): Table
    {
        return $table
            ->query(fn (): Builder => ItemDisplayLabel::withDisplayLabel(
                $this->missingFallbackQuery(
                    Item::query()->select(['items.id', 'items.internal_name', 'items.type', 'items.backward_compatibility', 'items.updated_at'])
                )
            ))
            ->paginated([10, 25])
            ->defaultPaginationPageOption(10)
            ->columns([
                ItemDisplayLabel::displayLabelColumn()
                    ->url(fn (Item $record): string => ItemResource::getUrl('view', ['record' => $record])),
                TextColumn::make('type')
                    ->badge()
                    ->formatStateUsing(fn (?ItemType $state): ?string => $state?->label())
                    ->sortable(false),
                TextColumn::make('internal_name')
                    ->formatStateUsing(MarkdownState::inline())
                    ->label('Internal name')
                    ->searchable(false)
                    ->sortable(),
                TextColumn::make('backward_compatibility')
                    ->label('Legacy code')
                    ->sortable(false),
                TextColumn::make('updated_at')
                    ->label('Updated')
                    ->dateTime()
                    ->sortable(),
            ])
            ->heading('Items Missing Fallback Translation')
            ->headerActions($this->typeHeaderActions());
    }

    private function collectionTable(Table $table): Table
    {
        return $table
            ->query(fn (): Builder => CollectionDisplayLabel::withDisplayLabel(
                $this->missingFallbackQuery(
                    Collection::query()->select(['collections.id', 'collections.internal_name', 'collections.type', 'collections.backward_compatibility', 'collections.updated_at'])
                )
            ))
            ->paginated([10, 25])
            ->defaultPaginationPageOption(10)
            ->columns([
                CollectionDisplayLabel::displayLabelColumn()
                    ->url(fn (Collection $record): string => CollectionResource::getUrl('view', ['record' => $record])),
                TextColumn::make('type')
                    ->badge()
                    ->sortable(false),
                TextColumn::make('internal_name')
                    ->formatStateUsing(MarkdownState::inline())
                    ->label('Internal name')
                    ->searchable(false)
                    ->sortable(),
                TextColumn::make('backward_compatibility')
                    ->label('Legacy code')
                    ->sortable(false),
                TextColumn::make('updated_at')
                    ->label('Updated')
                    ->dateTime()
                    ->sortable(),
            ])
            ->heading('Collections Missing Fallback Translation')
            ->headerActions($this->typeHeaderActions());
    }

    private function partnerTable(Table $table): Table
    {
        return $table
            ->query(fn (): Builder => PartnerDisplayLabel::withDisplayLabel(
                $this->missingFallbackQuery(
                    Partner::query()->select(['partners.id', 'partners.internal_name', 'partners.type', 'partners.backward_compatibility', 'partners.updated_at'])
                )
            ))
            ->paginated([10, 25])
            ->defaultPaginationPageOption(10)
            ->columns([
                PartnerDisplayLabel::displayLabelColumn()
                    ->url(fn (Partner $record): string => PartnerResource::getUrl('view', ['record' => $record])),
                TextColumn::make('type')
                    ->badge()
                    ->sortable(false),
                TextColumn::make('internal_name')
                    ->formatStateUsing(MarkdownState::inline())
                    ->label('Internal name')
                    ->searchable(false)
                    ->sortable(),
                TextColumn::make('backward_compatibility')
                    ->label('Legacy code')
                    ->sortable(false),
                TextColumn::make('updated_at')
                    ->label('Updated')
                    ->dateTime()
                    ->sortable(),
            ])
            ->heading('Partners Missing Fallback Translation')
            ->headerActions($this->typeHeaderActions());
    }

    /** @return array<Action> */
    private function typeHeaderActions(): array
    {
        return [
            Action::make('showItems')
                ->label('Items')
                ->color($this->ownerType === 'item' ? 'primary' : 'gray')
                ->action(fn () => $this->ownerType = 'item'),
            Action::make('showCollections')
                ->label('Collections')
                ->color($this->ownerType === 'collection' ? 'primary' : 'gray')
                ->action(fn () => $this->ownerType = 'collection'),
            Action::make('showPartners')
                ->label('Partners')
                ->color($this->ownerType === 'partner' ? 'primary' : 'gray')
                ->action(fn () => $this->ownerType = 'partner'),
        ];
    }
}
