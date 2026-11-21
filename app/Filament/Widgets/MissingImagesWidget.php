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

class MissingImagesWidget extends BaseWidget
{
    protected static ?int $sort = 6;

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
                        ->whereDoesntHave('itemImages')
                        ->latest('items.updated_at')
                        ->limit(25)
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
            ->heading('Items Without Images')
            ->emptyStateHeading('All items have images')
            ->headerActions($this->typeHeaderActions());
    }

    private function collectionTable(Table $table): Table
    {
        return $table
            ->query(
                fn (): Builder => CollectionDisplayLabel::withDisplayLabel(
                    Collection::query()
                        ->select(['collections.id', 'collections.internal_name', 'collections.type', 'collections.backward_compatibility', 'collections.updated_at'])
                        ->whereDoesntHave('collectionImages')
                        ->latest('collections.updated_at')
                        ->limit(25)
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
            ->heading('Collections Without Images')
            ->emptyStateHeading('All collections have images')
            ->headerActions($this->typeHeaderActions());
    }

    private function partnerTable(Table $table): Table
    {
        return $table
            ->query(
                fn (): Builder => PartnerDisplayLabel::withDisplayLabel(
                    Partner::query()
                        ->select(['partners.id', 'partners.internal_name', 'partners.type', 'partners.backward_compatibility', 'partners.updated_at'])
                        ->whereDoesntHave('partnerImages')
                        ->latest('partners.updated_at')
                        ->limit(25)
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
            ->heading('Partners Without Images')
            ->emptyStateHeading('All partners have images')
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
