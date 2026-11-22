<?php

namespace App\Filament\Pages;

use App\Filament\Support\ItemDisplayLabel;
use App\Models\Item;
use Filament\Pages\Page;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

class BrowseItemTree extends Page
{
    protected static ?string $navigationIcon = 'heroicon-o-cube';

    protected static ?string $navigationLabel = 'Browse item tree';

    protected static ?string $navigationGroup = 'Inventory';

    protected static ?int $navigationSort = 11;

    protected static string $view = 'filament.pages.browse-item-tree';

    public static function canAccess(): bool
    {
        return auth()->user()?->can('viewAny', Item::class) ?? false;
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
     * Filter root items by type.
     * Accepted values: 'all', or any ItemType value (e.g. 'object', 'monument').
     */
    public string $filterType = 'all';

    /**
     * Filter root items by presence of a project assignment.
     * Accepted values: 'all', 'with', 'without'.
     */
    public string $filterProject = 'all';

    /**
     * Filter root items by presence of a country assignment.
     * Accepted values: 'all', 'with', 'without'.
     */
    public string $filterCountry = 'all';

    /**
     * Current pagination page for root items (1-based).
     */
    public int $page = 1;

    /**
     * Number of root items shown per page.
     */
    private const PAGE_SIZE = 50;

    /**
     * Reset pagination when the search query changes.
     */
    public function updatedSearch(): void
    {
        $this->page = 1;
    }

    /**
     * Reset pagination when the type filter changes.
     */
    public function updatedFilterType(): void
    {
        $this->page = 1;
    }

    /**
     * Reset pagination when the project filter changes.
     */
    public function updatedFilterProject(): void
    {
        $this->page = 1;
    }

    /**
     * Reset pagination when the country filter changes.
     */
    public function updatedFilterCountry(): void
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
     * Build the shared base query for root items, applying search and filters.
     *
     * @return Builder<Item>
     */
    private function buildRootQuery(): Builder
    {
        $query = Item::query()->whereNull('parent_id');

        if ($this->search !== '') {
            $term = $this->search;
            $query->where(function ($q) use ($term): void {
                $q->where('internal_name', 'like', '%'.$term.'%')
                    ->orWhere('backward_compatibility', 'like', '%'.$term.'%')
                    ->orWhere('id', 'like', '%'.$term.'%');
            });
        }

        if ($this->filterType !== 'all') {
            $query->where('type', $this->filterType);
        }

        if ($this->filterProject === 'with') {
            $query->whereNotNull('project_id');
        } elseif ($this->filterProject === 'without') {
            $query->whereNull('project_id');
        }

        if ($this->filterCountry === 'with') {
            $query->whereNotNull('country_id');
        } elseif ($this->filterCountry === 'without') {
            $query->whereNull('country_id');
        }

        return $query;
    }

    /**
     * Fetch a paginated, optionally-searched and filtered page of root-level items (no parent).
     *
     * @return Collection<int, Item>
     */
    public function getRoots(): Collection
    {
        /** @var Collection<int, Item> $result */
        $result = ItemDisplayLabel::withDisplayLabel(
            $this->buildRootQuery()
                ->withCount('children')
                ->orderBy('internal_name')
                ->offset(($this->page - 1) * self::PAGE_SIZE)
                ->limit(self::PAGE_SIZE)
        )->get();

        return $result;
    }

    /**
     * Total count of root-level items matching the current search and filters.
     */
    public function getRootCount(): int
    {
        return $this->buildRootQuery()->count();
    }

    /**
     * Fetch direct children for a given parent ID.
     *
     * @return Collection<int, Item>
     */
    public function getChildren(string $parentId): Collection
    {
        /** @var Collection<int, Item> $result */
        $result = ItemDisplayLabel::withDisplayLabel(
            Item::query()
                ->where('parent_id', $parentId)
                ->withCount('children')
                ->orderBy('display_order')
                ->orderBy('internal_name')
        )->get();

        return $result;
    }
}
