<?php

namespace App\Filament\Pages;

use App\Filament\Support\CollectionDisplayLabel;
use App\Filament\Support\ItemDisplayLabel;
use App\Models\Collection;
use App\Models\Item;
use Filament\Pages\Page;
use Illuminate\Database\Eloquent\Builder;

class BrowseCollectionTree extends Page
{
    protected static string|\BackedEnum|null $navigationIcon = 'heroicon-o-archive-box';

    protected static ?string $navigationLabel = 'Browse collection tree';

    protected static string|\UnitEnum|null $navigationGroup = 'Inventory';

    protected static ?int $navigationSort = 0;

    protected string $view = 'filament.pages.browse-collection-tree';

    public static function canAccess(): bool
    {
        return auth()->user()?->can('viewAny', Collection::class) ?? false;
    }

    public static function shouldRegisterNavigation(): bool
    {
        return static::canAccess();
    }

    /**
     * IDs of expanded tree nodes.
     *
     * @var array<string, true>
     */
    public array $expanded = [];

    /**
     * Root search query string.
     */
    public string $search = '';

    /**
     * Filter root collections by presence of direct child collections.
     * Accepted values: 'all', 'with', 'without'.
     */
    public string $filterChildCollections = 'with';

    /**
     * Filter root collections by presence of directly attached items.
     * Accepted values: 'all', 'with', 'without'.
     */
    public string $filterChildItems = 'all';

    /**
     * Current pagination page for root collections (1-based).
     */
    public int $page = 1;

    /**
     * Number of root collections shown per page.
     */
    private const PAGE_SIZE = 50;

    /**
     * Maximum depth for ancestor chain traversal to prevent infinite loops.
     */
    private const MAX_ANCESTOR_DEPTH = 10;

    /**
     * Reset pagination when the search query changes.
     */
    public function updatedSearch(): void
    {
        $this->page = 1;
    }

    /**
     * Reset pagination when the child-collections filter changes.
     */
    public function updatedFilterChildCollections(): void
    {
        $this->page = 1;
    }

    /**
     * Reset pagination when the child-items filter changes.
     */
    public function updatedFilterChildItems(): void
    {
        $this->page = 1;
    }

    /**
     * Expand a tree node by loading its children.
     */
    public function expand(string $id): void
    {
        $this->expanded[$id] = true;
    }

    /**
     * Collapse a tree node.
     */
    public function collapse(string $id): void
    {
        unset($this->expanded[$id]);
    }

    /**
     * Toggle expand/collapse for a node.
     */
    public function toggle(string $id): void
    {
        if (isset($this->expanded[$id])) {
            $this->collapse($id);
        } else {
            $this->expand($id);
        }
    }

    /**
     * Advance to the next page of roots.
     */
    public function nextPage(): void
    {
        if ($this->page < $this->getTotalPages()) {
            $this->page++;
        }
    }

    /**
     * Return to the previous page of roots.
     */
    public function previousPage(): void
    {
        if ($this->page > 1) {
            $this->page--;
        }
    }

    /**
     * Total number of pages for the current root query.
     */
    public function getTotalPages(): int
    {
        return (int) max(1, ceil($this->getRootCount() / self::PAGE_SIZE));
    }

    /**
     * Build the shared base query for root collections, applying search and filters.
     *
     * @return Builder<Collection>
     */
    private function buildRootQuery(): Builder
    {
        $query = Collection::query()->whereNull('parent_id');

        if ($this->search !== '') {
            $term = $this->search;
            $query->where(function ($q) use ($term): void {
                $q->where('internal_name', 'like', '%'.$term.'%')
                    ->orWhere('backward_compatibility', 'like', '%'.$term.'%')
                    ->orWhere('id', 'like', '%'.$term.'%');
            });
        }

        if ($this->filterChildCollections === 'with') {
            $query->whereHas('children');
        } elseif ($this->filterChildCollections === 'without') {
            $query->whereDoesntHave('children');
        }

        if ($this->filterChildItems === 'with') {
            $query->whereHas('attachedItems');
        } elseif ($this->filterChildItems === 'without') {
            $query->whereDoesntHave('attachedItems');
        }

        return $query;
    }

    /**
     * Fetch a paginated, optionally-searched and filtered page of root-level collections (no parent).
     *
     * @return \Illuminate\Database\Eloquent\Collection<int, Collection>
     */
    public function getRoots(): \Illuminate\Database\Eloquent\Collection
    {
        /** @var \Illuminate\Database\Eloquent\Collection<int, Collection> $result */
        $result = CollectionDisplayLabel::withDisplayLabel(
            $this->buildRootQuery()
                ->withCount('children')
                ->withCount('attachedItems')
                ->orderBy('internal_name')
                ->offset(($this->page - 1) * self::PAGE_SIZE)
                ->limit(self::PAGE_SIZE)
        )->get();

        return $result;
    }

    /**
     * Total count of root-level collections matching the current search and filters.
     */
    public function getRootCount(): int
    {
        return $this->buildRootQuery()->count();
    }

    /**
     * Fetch direct children for a given parent ID.
     *
     * @return \Illuminate\Database\Eloquent\Collection<int, Collection>
     */
    public function getChildren(string $parentId): \Illuminate\Database\Eloquent\Collection
    {
        /** @var \Illuminate\Database\Eloquent\Collection<int, Collection> $result */
        $result = CollectionDisplayLabel::withDisplayLabel(
            Collection::query()
                ->where('parent_id', $parentId)
                ->withCount('children')
                ->withCount('attachedItems')
                ->orderBy('internal_name')
        )->get();

        return $result;
    }

    /**
     * Fetch direct member items for a given collection via the collection_item pivot.
     *
     * @return \Illuminate\Database\Eloquent\Collection<int, Item>
     */
    public function getCollectionItems(string $collectionId): \Illuminate\Database\Eloquent\Collection
    {
        $query = Item::query()
            ->join('collection_item', 'items.id', '=', 'collection_item.item_id')
            ->where('collection_item.collection_id', $collectionId)
            ->select('items.*');

        /** @var \Illuminate\Database\Eloquent\Collection<int, Item> $result */
        $result = ItemDisplayLabel::withDisplayLabel($query)
            ->with([
                'translations',
                'collection:id,context_id',
                'project:id,context_id',
                'parent.translations',
                'parent.collection:id,context_id',
                'parent.project:id,context_id',
            ])
            ->orderByRaw('CASE WHEN collection_item.display_order IS NULL THEN 1 ELSE 0 END')
            ->orderBy('collection_item.display_order')
            ->orderBy('display_label')
            ->orderBy('items.internal_name')
            ->get();

        return $result;
    }

    /**
     * Build the ancestor breadcrumb chain for a given collection, ordered root-first.
     *
     * Uses iterative parent lookups bounded by MAX_ANCESTOR_DEPTH to prevent
     * infinite loops in corrupted hierarchies.
     *
     * @return \Illuminate\Database\Eloquent\Collection<int, Collection>
     */
    public function getAncestors(string $collectionId): \Illuminate\Database\Eloquent\Collection
    {
        $ancestorIds = [];
        $currentId = $collectionId;

        for ($depth = 0; $depth < self::MAX_ANCESTOR_DEPTH; $depth++) {
            $parentId = Collection::where('id', $currentId)->value('parent_id');
            if (! is_string($parentId)) {
                break;
            }
            $ancestorIds[] = $parentId;
            $currentId = $parentId;
        }

        if (empty($ancestorIds)) {
            return new \Illuminate\Database\Eloquent\Collection;
        }

        // Fetch all ancestors in one query, then reorder to root-first using the collected order.
        /** @var \Illuminate\Database\Eloquent\Collection<int, Collection> $fetched */
        $fetched = CollectionDisplayLabel::withDisplayLabel(
            Collection::whereIn('id', $ancestorIds)
        )->get();
        $byId = $fetched->keyBy('id');

        // ancestorIds is leaf-to-root; reverse for root-first breadcrumb order.
        /** @var \Illuminate\Database\Eloquent\Collection<int, Collection> $result */
        $result = new \Illuminate\Database\Eloquent\Collection(
            array_filter(
                array_map(fn (string $id) => $byId->get($id), array_reverse($ancestorIds))
            )
        );

        return $result;
    }
}
