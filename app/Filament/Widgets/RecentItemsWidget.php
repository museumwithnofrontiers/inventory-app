<?php

namespace App\Filament\Widgets;

use App\Enums\ItemType;
use App\Enums\Permission;
use App\Filament\Resources\CollectionResource;
use App\Filament\Resources\ItemResource;
use App\Filament\Resources\PartnerResource;
use App\Filament\Support\CollectionDisplayLabel;
use App\Filament\Support\ItemDisplayLabel;
use App\Filament\Support\MarkdownState;
use App\Filament\Support\PartnerDisplayLabel;
use App\Models\Collection;
use App\Models\Item;
use App\Models\Partner;
use Filament\Tables\Actions\Action;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Filament\Widgets\TableWidget as BaseWidget;
use Illuminate\Database\Eloquent\Builder;

class RecentItemsWidget extends BaseWidget
{
    protected static ?int $sort = 2;

    protected int|string|array $columnSpan = 'full';

    public string $ownerType = 'item';

    public static function canView(): bool
    {
        return auth()->user()?->hasPermissionTo(Permission::VIEW_DATA->value) ?? false;
    }

    public function table(Table $table): Table
    {
        return match ($this->ownerType) {
            'collection' => $this->collectionTable($table),
            'partner' => $this->partnerTable($table),
            default => $this->itemTable($table),
        };
    }

    private function itemTable(Table $table): Table
    {
        return $table
            ->query(
                fn (): Builder => ItemDisplayLabel::withDisplayLabel(
                    Item::query()
                        ->select(['items.id', 'items.internal_name', 'items.type', 'items.backward_compatibility', 'items.updated_at'])
                        ->latest('items.updated_at')
                        ->limit(10)
                ),
            )
            ->paginated(false)
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
                    ->sortable(false),
                TextColumn::make('backward_compatibility')
                    ->label('Legacy code')
                    ->sortable(false),
                TextColumn::make('updated_at')
                    ->label('Updated')
                    ->dateTime()
                    ->sortable(false),
            ])
            ->heading('Recently Edited Items')
            ->headerActions($this->typeHeaderActions());
    }

    private function collectionTable(Table $table): Table
    {
        return $table
            ->query(
                fn (): Builder => CollectionDisplayLabel::withDisplayLabel(
                    Collection::query()
                        ->select(['collections.id', 'collections.internal_name', 'collections.type', 'collections.backward_compatibility', 'collections.updated_at'])
                        ->latest('collections.updated_at')
                        ->limit(10)
                ),
            )
            ->paginated(false)
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
                    ->sortable(false),
                TextColumn::make('backward_compatibility')
                    ->label('Legacy code')
                    ->sortable(false),
                TextColumn::make('updated_at')
                    ->label('Updated')
                    ->dateTime()
                    ->sortable(false),
            ])
            ->heading('Recently Edited Collections')
            ->headerActions($this->typeHeaderActions());
    }

    private function partnerTable(Table $table): Table
    {
        return $table
            ->query(
                fn (): Builder => PartnerDisplayLabel::withDisplayLabel(
                    Partner::query()
                        ->select(['partners.id', 'partners.internal_name', 'partners.type', 'partners.backward_compatibility', 'partners.updated_at'])
                        ->latest('partners.updated_at')
                        ->limit(10)
                ),
            )
            ->paginated(false)
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
                    ->sortable(false),
                TextColumn::make('backward_compatibility')
                    ->label('Legacy code')
                    ->sortable(false),
                TextColumn::make('updated_at')
                    ->label('Updated')
                    ->dateTime()
                    ->sortable(false),
            ])
            ->heading('Recently Edited Partners')
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
