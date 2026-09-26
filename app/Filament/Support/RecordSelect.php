<?php

namespace App\Filament\Support;

use App\Models\Artist;
use App\Models\Collection;
use App\Models\Dynasty;
use App\Models\Item;
use App\Models\Partner;
use App\Models\Tag;
use App\Models\TimelineEvent;
use App\Models\Workshop;
use Filament\Forms\Components\Select;
use Filament\Tables\Actions\AssociateAction;
use Filament\Tables\Actions\AttachAction;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use InvalidArgumentException;

/**
 * The one record-select helper (M7 epic #1871, story A0.2).
 *
 * Locked convention: every record select (attach, associate, parent) is
 * server-side searchable on `id`, `internal_name` and `backward_compatibility`
 * — or the subset of those columns that exist on the model; Dynasty has no
 * `internal_name` — labelled via the entity's `*DisplayLabel` helper where one
 * exists, ordered, capped at {@see self::RESULT_LIMIT} results, and never
 * preloaded.
 *
 * Tag, Artist and Workshop have no `*DisplayLabel` helper. Their label is the
 * model's own natural name column: Tag::description (TagResource's own
 * `$recordTitleAttribute`), Artist::name, Workshop::name — suffixed with the
 * legacy `backward_compatibility` code the same way the display-label entities
 * are, via {@see self::legacyLabel()}.
 *
 * Two shapes are exposed:
 *  - `for*()` return a plain, ready-to-use `Select` for form fields (e.g.
 *    TranslationFormSchema's item/collection/partner fields, or a parent
 *    picker built from scratch).
 *  - `recordSelectFor()` adapts a relation manager's `AttachAction` or
 *    `AssociateAction` in place, since Filament builds those record selects
 *    internally (relationship-scoped, excludes already-attached records) —
 *    there is no bare `Select` to hand back for those.
 */
class RecordSelect
{
    public const ITEMS = 'items';

    public const COLLECTIONS = 'collections';

    public const PARTNERS = 'partners';

    public const TIMELINE_EVENTS = 'timelineEvents';

    public const TAGS = 'tags';

    public const ARTISTS = 'artists';

    public const WORKSHOPS = 'workshops';

    public const DYNASTIES = 'dynasties';

    private const RESULT_LIMIT = 50;

    /** @var array<int, string> */
    private const ID_INTERNAL_NAME_BC = ['id', 'internal_name', 'backward_compatibility'];

    /** @var array<int, string> */
    private const ID_BC = ['id', 'backward_compatibility'];

    // ── Plain Select factories ──────────────────────────────────────────────

    public static function forItems(string $name = 'item_id', string $label = 'Item', bool $required = true): Select
    {
        $select = Select::make($name)
            ->label($label)
            ->searchable()
            ->getSearchResultsUsing(fn (string $search): array => ItemDisplayLabel::withDisplayLabel(
                Item::query()->where(function (Builder $query) use ($search): void {
                    $query->where('id', 'like', "%{$search}%")
                        ->orWhere('internal_name', 'like', "%{$search}%")
                        ->orWhere('backward_compatibility', 'like', "%{$search}%");
                })
            )
                ->orderBy('internal_name')
                ->limit(self::RESULT_LIMIT)
                ->get()
                ->mapWithKeys(fn (Item $item): array => [
                    $item->id => self::compositeLabel($item->display_label, $item->internal_name, $item->backward_compatibility),
                ])
                ->all())
            ->getOptionLabelUsing(fn (mixed $value): string => ItemDisplayLabel::resolveLabel($value) ?: (is_scalar($value) ? (string) $value : ''));

        return self::requiredOrNullable($select, $required);
    }

    public static function forCollections(string $name = 'collection_id', string $label = 'Collection', bool $required = true): Select
    {
        $select = Select::make($name)
            ->label($label)
            ->searchable()
            ->getSearchResultsUsing(fn (string $search): array => CollectionDisplayLabel::withDisplayLabel(
                Collection::query()->where(function (Builder $query) use ($search): void {
                    $query->where('id', 'like', "%{$search}%")
                        ->orWhere('internal_name', 'like', "%{$search}%")
                        ->orWhere('backward_compatibility', 'like', "%{$search}%");
                })
            )
                ->orderBy('internal_name')
                ->limit(self::RESULT_LIMIT)
                ->get()
                ->mapWithKeys(fn (Collection $collection): array => [
                    $collection->id => self::compositeLabel($collection->display_label, $collection->internal_name, $collection->backward_compatibility),
                ])
                ->all())
            ->getOptionLabelUsing(fn (mixed $value): string => CollectionDisplayLabel::resolveLabel($value) ?: (is_scalar($value) ? (string) $value : ''));

        return self::requiredOrNullable($select, $required);
    }

    public static function forPartners(string $name = 'partner_id', string $label = 'Partner', bool $required = true): Select
    {
        $select = Select::make($name)
            ->label($label)
            ->searchable()
            ->getSearchResultsUsing(fn (string $search): array => PartnerDisplayLabel::withDisplayLabel(
                Partner::query()->where(function (Builder $query) use ($search): void {
                    $query->where('id', 'like', "%{$search}%")
                        ->orWhere('internal_name', 'like', "%{$search}%")
                        ->orWhere('backward_compatibility', 'like', "%{$search}%");
                })
            )
                ->orderBy('internal_name')
                ->limit(self::RESULT_LIMIT)
                ->get()
                ->mapWithKeys(fn (Partner $partner): array => [
                    $partner->id => self::compositeLabel($partner->display_label, $partner->internal_name, $partner->backward_compatibility),
                ])
                ->all())
            ->getOptionLabelUsing(fn (mixed $value): string => PartnerDisplayLabel::resolveLabel($value) ?: (is_scalar($value) ? (string) $value : ''));

        return self::requiredOrNullable($select, $required);
    }

    public static function forTimelineEvents(string $name = 'timeline_event_id', string $label = 'Timeline event', bool $required = true): Select
    {
        $select = Select::make($name)
            ->label($label)
            ->searchable()
            ->getSearchResultsUsing(fn (string $search): array => TimelineEventDisplayLabel::withDisplayLabel(
                TimelineEvent::query()->where(function (Builder $query) use ($search): void {
                    $query->where('id', 'like', "%{$search}%")
                        ->orWhere('internal_name', 'like', "%{$search}%")
                        ->orWhere('backward_compatibility', 'like', "%{$search}%");
                })
            )
                ->orderBy('internal_name')
                ->limit(self::RESULT_LIMIT)
                ->get()
                ->mapWithKeys(fn (TimelineEvent $event): array => [
                    $event->id => self::compositeLabel($event->display_label, $event->internal_name, $event->backward_compatibility),
                ])
                ->all())
            ->getOptionLabelUsing(fn (mixed $value): string => TimelineEventDisplayLabel::resolveLabel($value) ?: (is_scalar($value) ? (string) $value : ''));

        return self::requiredOrNullable($select, $required);
    }

    public static function forTags(string $name = 'tag_id', string $label = 'Tag', bool $required = true): Select
    {
        $select = Select::make($name)
            ->label($label)
            ->searchable()
            ->getSearchResultsUsing(fn (string $search): array => Tag::query()
                ->where(function (Builder $query) use ($search): void {
                    $query->where('id', 'like', "%{$search}%")
                        ->orWhere('internal_name', 'like', "%{$search}%")
                        ->orWhere('backward_compatibility', 'like', "%{$search}%");
                })
                ->orderBy('description')
                ->limit(self::RESULT_LIMIT)
                ->get()
                ->mapWithKeys(fn (Tag $tag): array => [
                    $tag->id => self::legacyLabel($tag->description, $tag->backward_compatibility),
                ])
                ->all())
            ->getOptionLabelUsing(function (mixed $value): string {
                $tag = Tag::query()->whereKey($value)->first();

                return $tag instanceof Tag
                    ? self::legacyLabel($tag->description, $tag->backward_compatibility)
                    : (is_scalar($value) ? (string) $value : '');
            });

        return self::requiredOrNullable($select, $required);
    }

    public static function forArtists(string $name = 'artist_id', string $label = 'Artist', bool $required = true): Select
    {
        $select = Select::make($name)
            ->label($label)
            ->searchable()
            ->getSearchResultsUsing(fn (string $search): array => Artist::query()
                ->where(function (Builder $query) use ($search): void {
                    $query->where('id', 'like', "%{$search}%")
                        ->orWhere('internal_name', 'like', "%{$search}%")
                        ->orWhere('backward_compatibility', 'like', "%{$search}%");
                })
                ->orderBy('name')
                ->limit(self::RESULT_LIMIT)
                ->get()
                ->mapWithKeys(fn (Artist $artist): array => [
                    $artist->id => self::legacyLabel($artist->name, $artist->backward_compatibility),
                ])
                ->all())
            ->getOptionLabelUsing(function (mixed $value): string {
                $artist = Artist::query()->whereKey($value)->first();

                return $artist instanceof Artist
                    ? self::legacyLabel($artist->name, $artist->backward_compatibility)
                    : (is_scalar($value) ? (string) $value : '');
            });

        return self::requiredOrNullable($select, $required);
    }

    public static function forWorkshops(string $name = 'workshop_id', string $label = 'Workshop', bool $required = true): Select
    {
        $select = Select::make($name)
            ->label($label)
            ->searchable()
            ->getSearchResultsUsing(fn (string $search): array => Workshop::query()
                ->where(function (Builder $query) use ($search): void {
                    $query->where('id', 'like', "%{$search}%")
                        ->orWhere('internal_name', 'like', "%{$search}%")
                        ->orWhere('backward_compatibility', 'like', "%{$search}%");
                })
                ->orderBy('name')
                ->limit(self::RESULT_LIMIT)
                ->get()
                ->mapWithKeys(fn (Workshop $workshop): array => [
                    $workshop->id => self::legacyLabel($workshop->name, $workshop->backward_compatibility),
                ])
                ->all())
            ->getOptionLabelUsing(function (mixed $value): string {
                $workshop = Workshop::query()->whereKey($value)->first();

                return $workshop instanceof Workshop
                    ? self::legacyLabel($workshop->name, $workshop->backward_compatibility)
                    : (is_scalar($value) ? (string) $value : '');
            });

        return self::requiredOrNullable($select, $required);
    }

    public static function forDynasties(string $name = 'dynasty_id', string $label = 'Dynasty', bool $required = true): Select
    {
        $select = Select::make($name)
            ->label($label)
            ->searchable()
            ->getSearchResultsUsing(fn (string $search): array => DynastyDisplayLabel::withDisplayLabel(
                Dynasty::query()->where(function (Builder $query) use ($search): void {
                    $query->where('id', 'like', "%{$search}%")
                        ->orWhere('backward_compatibility', 'like', "%{$search}%");
                })
            )
                ->orderBy('from_ad')
                ->limit(self::RESULT_LIMIT)
                ->get()
                ->mapWithKeys(fn (Dynasty $dynasty): array => [$dynasty->id => $dynasty->display_label])
                ->all())
            ->getOptionLabelUsing(fn (mixed $value): string => DynastyDisplayLabel::resolveLabel($value) ?: (is_scalar($value) ? (string) $value : ''));

        return self::requiredOrNullable($select, $required);
    }

    // ── AttachAction / AssociateAction adapter ──────────────────────────────

    /**
     * Adapts a relation manager's AttachAction or AssociateAction so its
     * built-in record select (Filament builds it internally, relationship-
     * scoped, already-attached records excluded) uses the same server-side
     * search columns, `*DisplayLabel` labels and result cap as the matching
     * `for*()` factory above. Never calls `preloadRecordSelect()`.
     *
     * $entity is one of the self::ITEMS / self::COLLECTIONS / ... constants.
     */
    public static function recordSelectFor(AttachAction|AssociateAction $action, string $entity): AttachAction|AssociateAction
    {
        return match ($entity) {
            self::ITEMS => $action
                ->recordSelectSearchColumns(self::ID_INTERNAL_NAME_BC)
                ->recordSelectOptionsQuery(fn (Builder $query): Builder => ItemDisplayLabel::withDisplayLabel($query)->orderBy('internal_name'))
                ->recordTitle(fn (Item $record): string => self::compositeLabel($record->display_label, $record->internal_name, $record->backward_compatibility)),

            self::COLLECTIONS => $action
                ->recordSelectSearchColumns(self::ID_INTERNAL_NAME_BC)
                ->recordSelectOptionsQuery(fn (Builder $query): Builder => CollectionDisplayLabel::withDisplayLabel($query)->orderBy('internal_name'))
                ->recordTitle(fn (Collection $record): string => self::compositeLabel($record->display_label, $record->internal_name, $record->backward_compatibility)),

            self::PARTNERS => $action
                ->recordSelectSearchColumns(self::ID_INTERNAL_NAME_BC)
                ->recordSelectOptionsQuery(fn (Builder $query): Builder => PartnerDisplayLabel::withDisplayLabel($query)->orderBy('internal_name'))
                ->recordTitle(fn (Partner $record): string => self::compositeLabel($record->display_label, $record->internal_name, $record->backward_compatibility)),

            self::TIMELINE_EVENTS => $action
                ->recordSelectSearchColumns(self::ID_INTERNAL_NAME_BC)
                ->recordSelectOptionsQuery(fn (Builder $query): Builder => TimelineEventDisplayLabel::withDisplayLabel($query)->orderBy('internal_name'))
                ->recordTitle(fn (TimelineEvent $record): string => self::compositeLabel($record->display_label, $record->internal_name, $record->backward_compatibility)),

            self::TAGS => $action
                ->recordSelectSearchColumns(self::ID_INTERNAL_NAME_BC)
                ->recordSelectOptionsQuery(fn (Builder $query): Builder => $query->orderBy('description'))
                ->recordTitle(fn (Tag $record): string => self::legacyLabel($record->description, $record->backward_compatibility)),

            self::ARTISTS => $action
                ->recordSelectSearchColumns(self::ID_INTERNAL_NAME_BC)
                ->recordSelectOptionsQuery(fn (Builder $query): Builder => $query->orderBy('name'))
                ->recordTitle(fn (Artist $record): string => self::legacyLabel($record->name, $record->backward_compatibility)),

            self::WORKSHOPS => $action
                ->recordSelectSearchColumns(self::ID_INTERNAL_NAME_BC)
                ->recordSelectOptionsQuery(fn (Builder $query): Builder => $query->orderBy('name'))
                ->recordTitle(fn (Workshop $record): string => self::legacyLabel($record->name, $record->backward_compatibility)),

            self::DYNASTIES => $action
                ->recordSelectSearchColumns(self::ID_BC)
                ->recordSelectOptionsQuery(fn (Builder $query): Builder => DynastyDisplayLabel::withDisplayLabel($query)->orderBy('from_ad'))
                ->recordTitle(fn (Dynasty $record): string => $record->display_label),

            default => throw new InvalidArgumentException("Unknown RecordSelect entity [{$entity}]."),
        };
    }

    // ── Generic helpers for callers that need the filtered query itself ────

    /**
     * Applies the shared id/internal_name/backward_compatibility search,
     * order and result cap to an arbitrary model query, for callers that need
     * the filtered Eloquent query itself rather than a ready-made `Select` —
     * currently HasChangeParentAction's generic parent-picker hooks.
     *
     * @template TModel of Model
     *
     * @param  Builder<TModel>  $query
     * @return Builder<TModel>
     */
    public static function applyBoundedSearch(Builder $query, string $search, string $orderColumn = 'internal_name'): Builder
    {
        return $query
            ->where(function (Builder $query) use ($search): void {
                $query->where('id', 'like', "%{$search}%")
                    ->orWhere('internal_name', 'like', "%{$search}%")
                    ->orWhere('backward_compatibility', 'like', "%{$search}%");
            })
            ->orderBy($orderColumn)
            ->limit(self::RESULT_LIMIT);
    }

    /**
     * Scopes a self-relation query to exclude a record and its descendants,
     * via the model's own `excludingDescendantsOf` local scope (Item,
     * Collection). This is HasChangeParentAction's default row-scope hook, so
     * a parent picker never offers a record as its own (indirect) parent. A
     * no-op for models that don't define the scope.
     *
     * @template TModel of Model
     *
     * @param  Builder<TModel>  $query
     * @return Builder<TModel>
     */
    public static function excludingDescendantsOf(Builder $query, Model $record): Builder
    {
        $key = $record->getKey();
        $id = is_scalar($key) ? (string) $key : '';

        if ($id === '' || ! method_exists($query->getModel(), 'scopeExcludingDescendantsOf')) {
            return $query;
        }

        /** @var Builder<TModel> $scoped */
        $scoped = $query->excludingDescendantsOf($id); // @phpstan-ignore method.notFound (magic local scope on a generic template; existence already checked above)

        return $scoped;
    }

    // ── Label helpers ────────────────────────────────────────────────────────

    private static function requiredOrNullable(Select $select, bool $required): Select
    {
        return $required ? $select->required() : $select->nullable();
    }

    /**
     * The display-label entities' composite label: the translated display
     * label with the internal_name bracketed alongside it, unless there is no
     * translation (display_label fell back to internal_name itself) — in
     * which case fall back further to {@see self::legacyLabel()}.
     */
    private static function compositeLabel(string $displayLabel, string $internalName, ?string $backwardCompatibility): string
    {
        return $displayLabel !== $internalName
            ? "{$displayLabel} [{$internalName}]"
            : self::legacyLabel($internalName, $backwardCompatibility);
    }

    /**
     * Suffixes a name with its legacy code when one exists.
     */
    private static function legacyLabel(string $name, ?string $backwardCompatibility): string
    {
        return $backwardCompatibility
            ? "{$name} [{$backwardCompatibility}]"
            : $name;
    }
}
