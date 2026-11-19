<?php

namespace App\Filament\Pages;

use App\Enums\Permission;
use App\Filament\Resources\CollectionResource;
use App\Filament\Resources\ItemResource;
use App\Filament\Support\CollectionDisplayLabel;
use App\Filament\Support\CollectionItemExploreMonumentForm;
use App\Filament\Support\CollectionItemTranslationForm;
use App\Filament\Support\ItemDisplayLabel;
use App\Models\Collection;
use App\Models\CollectionItem;
use App\Models\CollectionItemTranslation;
use App\Models\Item;
use Filament\Actions\EditAction as PageEditAction;
use Filament\Infolists\Infolist;
use Filament\Pages\Page;
use Filament\Tables\Actions\CreateAction;
use Filament\Tables\Actions\DeleteAction;
use Filament\Tables\Actions\EditAction;
use Filament\Tables\Actions\ViewAction;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Concerns\InteractsWithTable;
use Filament\Tables\Contracts\HasTable;
use Filament\Tables\Table;
use Illuminate\Contracts\Support\Htmlable;

/**
 * A placement's page: the item on the collection, its order, and its texts
 * per language (M16 C2, #2642), which are edited here. Changing them is
 * changing the collection, so it takes `update` on the collection, as every
 * placement change does in the relation managers.
 */
class ViewCollectionItemAppearance extends Page implements HasTable
{
    use InteractsWithTable;

    protected static bool $shouldRegisterNavigation = false;

    protected static string $view = 'filament.pages.view-collection-item-appearance';

    public Collection $collection;

    public Item $item;

    public string $placementId;

    public ?int $displayOrder = null;

    public static function canAccess(): bool
    {
        return auth()->user()?->hasPermissionTo(Permission::VIEW_DATA->value) ?? false;
    }

    public static function shouldRegisterNavigation(): bool
    {
        return false;
    }

    public function mount(Collection $collection, Item $item): void
    {
        abort_unless(static::canAccess(), 403);

        $placement = CollectionItem::where('collection_id', $collection->id)
            ->where('item_id', $item->id)
            ->first();

        abort_if($placement === null, 404);

        /** @var Collection|null $foundCollection */
        $foundCollection = CollectionDisplayLabel::withDisplayLabel(
            Collection::where('id', $collection->id)
                ->with(['context:id,internal_name', 'language:id,internal_name', 'parent:id,internal_name'])
        )->first();
        $this->collection = $foundCollection ?? $collection;

        /** @var Item|null $foundItem */
        $foundItem = ItemDisplayLabel::withDisplayLabel(
            Item::where('id', $item->id)
                ->with(['partner:id,internal_name'])
        )->first();
        $this->item = $foundItem ?? $item;

        $this->placementId = $placement->id;
        $this->displayOrder = $placement->display_order;
    }

    public function getTitle(): string|Htmlable
    {
        return 'Collection Appearance';
    }

    /**
     * The placement's texts, one row per language.
     */
    public function table(Table $table): Table
    {
        return $table
            ->heading('Translations')
            ->description('The item\'s texts on this collection, one set per language.')
            ->query(CollectionItemTranslation::query()
                ->where('collection_item_id', $this->placementId)
                ->with('language:id,internal_name'))
            ->defaultSort('language_id')
            ->paginated(false)
            ->columns([
                TextColumn::make('language_id')
                    ->label('Language')
                    ->formatStateUsing(fn (string $state): string => strtoupper($state))
                    ->badge()
                    ->sortable(),
                TextColumn::make('title')
                    ->placeholder('—')
                    ->toggleable(),
                TextColumn::make('description')
                    ->placeholder('—')
                    ->wrap()
                    ->limit(200),
                TextColumn::make('item_name')
                    ->label('Caption name')
                    ->placeholder('—')
                    ->wrap()
                    ->toggleable(),
                IconColumn::make('has_justification')
                    ->label('Justification')
                    ->getStateUsing(fn (CollectionItemTranslation $record): bool => CollectionItemTranslationForm::hasJustification($record))
                    ->boolean(),
                TextColumn::make('backward_compatibility')
                    ->label('Legacy ID')
                    ->placeholder('—')
                    ->fontFamily('mono')
                    ->toggleable(),
            ])
            ->headerActions([
                CreateAction::make()
                    ->label('Add a language')
                    ->modalHeading('Add the texts of a language')
                    ->form(CollectionItemTranslationForm::fields($this->placementId))
                    ->mutateFormDataUsing(fn (array $data): array => [...$data, 'collection_item_id' => $this->placementId])
                    ->visible(fn (): bool => $this->canChangeTexts()),
            ])
            ->actions([
                ViewAction::make()
                    ->infolist(fn (Infolist $infolist): Infolist => $infolist->schema(CollectionItemTranslationForm::entries())),
                EditAction::make()
                    ->form(CollectionItemTranslationForm::fields($this->placementId))
                    ->visible(fn (): bool => $this->canChangeTexts()),
                DeleteAction::make()
                    ->visible(fn (): bool => $this->canChangeTexts()),
            ])
            ->emptyStateHeading('No texts on this collection')
            ->emptyStateDescription('The item shows its own texts here.');
    }

    /**
     * The Explore monuments the placement stands for (M16 C4), edited in a
     * modal: one entry per Explore monument, in order.
     *
     * @return array<int, PageEditAction>
     */
    protected function getHeaderActions(): array
    {
        return [
            PageEditAction::make('exploreMonuments')
                ->label('Explore monuments')
                ->icon('heroicon-o-map-pin')
                ->modalHeading('Explore monuments')
                ->modalDescription('The Explore monuments this placement stands for, in order.')
                ->record(fn (): CollectionItem => $this->placement())
                ->form(CollectionItemExploreMonumentForm::fields())
                ->visible(fn (): bool => $this->canChangeTexts()),
        ];
    }

    /**
     * The placement, with its Explore monuments and their museums.
     */
    public function placement(): CollectionItem
    {
        return CollectionItem::query()
            ->with(['exploreMonuments.partners:id,internal_name', 'exploreMonuments.locationCollection:id,internal_name'])
            ->findOrFail($this->placementId);
    }

    /**
     * One line per Explore monument, for the page.
     *
     * @return array<int, string>
     */
    public function exploreMonumentSummaries(): array
    {
        return $this->placement()->exploreMonuments
            ->map(fn ($monument): string => CollectionItemExploreMonumentForm::summary($monument))
            ->values()
            ->all();
    }

    /**
     * Changing a placement is changing its collection.
     */
    public function canChangeTexts(): bool
    {
        return auth()->user()?->can('update', $this->collection) ?? false;
    }

    /**
     * URL to the collection's Filament view page (null if not authorized).
     */
    public function collectionUrl(): ?string
    {
        return auth()->user()?->can('view', $this->collection)
            ? CollectionResource::getUrl('view', ['record' => $this->collection])
            : null;
    }

    /**
     * URL to the item's Filament view page (null if not authorized).
     */
    public function itemUrl(): ?string
    {
        return auth()->user()?->can('view', $this->item)
            ? ItemResource::getUrl('view', ['record' => $this->item])
            : null;
    }

    /**
     * Build the URL to the appearance detail page for a given Collection-Item pair.
     */
    public static function getAppearanceUrl(Collection $collection, Item $item): string
    {
        return route('filament.admin.collection-item.appearance', [
            'collection' => $collection->getKey(),
            'item' => $item->getKey(),
        ]);
    }
}
