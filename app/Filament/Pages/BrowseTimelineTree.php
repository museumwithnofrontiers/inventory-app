<?php

namespace App\Filament\Pages;

use App\Filament\Support\TimelineEventDisplayLabel;
use App\Models\Timeline;
use App\Models\TimelineEvent;
use Filament\Pages\Page;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

class BrowseTimelineTree extends Page
{
    protected static ?string $navigationIcon = 'heroicon-o-clock';

    protected static ?string $navigationLabel = 'Browse timeline tree';

    protected static ?string $navigationGroup = 'Inventory';

    protected static ?int $navigationSort = 10;

    protected static string $view = 'filament.pages.browse-timeline-tree';

    public static function canAccess(): bool
    {
        return auth()->user()?->can('viewAny', Timeline::class) ?? false;
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
     * Filter timelines by presence of child events.
     * Accepted values: 'all', 'with', 'without'.
     */
    public string $filterChildEvents = 'with';

    /**
     * Filter timelines by presence of a country assignment.
     * Accepted values: 'all', 'with', 'without'.
     */
    public string $filterCountry = 'all';

    /**
     * Filter timelines by presence of a collection assignment.
     * Accepted values: 'all', 'with', 'without'.
     */
    public string $filterCollection = 'all';

    /**
     * Current pagination page for root timelines (1-based).
     */
    public int $page = 1;

    /**
     * Number of timelines shown per page.
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
     * Reset pagination when the child-events filter changes.
     */
    public function updatedFilterChildEvents(): void
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
     * Reset pagination when the collection filter changes.
     */
    public function updatedFilterCollection(): void
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
     * Build the shared base query for timelines, applying search and filters.
     *
     * @return Builder<Timeline>
     */
    private function buildRootQuery(): Builder
    {
        $query = Timeline::query();

        if ($this->search !== '') {
            $term = $this->search;
            $query->where(function ($q) use ($term): void {
                $q->where('internal_name', 'like', '%'.$term.'%')
                    ->orWhere('backward_compatibility', 'like', '%'.$term.'%')
                    ->orWhere('id', 'like', '%'.$term.'%');
            });
        }

        if ($this->filterChildEvents === 'with') {
            $query->whereHas('events');
        } elseif ($this->filterChildEvents === 'without') {
            $query->whereDoesntHave('events');
        }

        if ($this->filterCountry === 'with') {
            $query->whereNotNull('country_id');
        } elseif ($this->filterCountry === 'without') {
            $query->whereNull('country_id');
        }

        if ($this->filterCollection === 'with') {
            $query->whereNotNull('collection_id');
        } elseif ($this->filterCollection === 'without') {
            $query->whereNull('collection_id');
        }

        return $query;
    }

    /**
     * Fetch a paginated, optionally-searched and filtered page of timelines.
     *
     * @return Collection<int, Timeline>
     */
    public function getRoots(): Collection
    {
        return $this->buildRootQuery()
            ->withCount('events')
            ->orderBy('internal_name')
            ->offset(($this->page - 1) * self::PAGE_SIZE)
            ->limit(self::PAGE_SIZE)
            ->get();
    }

    /**
     * Total count of timelines matching the current search and filters.
     */
    public function getRootCount(): int
    {
        return $this->buildRootQuery()->count();
    }

    /**
     * Fetch events for a given timeline ID.
     *
     * @return Collection<int, TimelineEvent>
     */
    public function getEvents(string $timelineId): Collection
    {
        /** @var Collection<int, TimelineEvent> $result */
        $result = TimelineEventDisplayLabel::withDisplayLabel(
            TimelineEvent::query()
                ->where('timeline_id', $timelineId)
                ->orderBy('display_order')
                ->orderBy('internal_name')
        )->get();

        return $result;
    }
}
