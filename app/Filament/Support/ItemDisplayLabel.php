<?php

namespace App\Filament\Support;

use App\Models\Context;
use App\Models\Item;
use App\Models\Language;
use App\Support\Markdown\MarkdownText;
use Filament\Tables\Columns\TextColumn;
use Illuminate\Database\Eloquent\Builder;

/**
 * Resolves a user-facing display label for Item records in Filament.
 *
 * The fallback chain, stopping at the first non-empty value:
 *  1. Default language + collection's context_id (when collection_id is present).
 *  2. Default language + project's context_id (when project_id is present).
 *  3. Default language + the default context.
 *  4. First translation in the default language (any context).
 *  5. First translation in any language.
 *  6. items.internal_name.
 *
 * For picture child items the chain extends to the direct parent item when the
 * picture itself has no valid translation (steps 1–5 against the parent before
 * falling back to internal_name). The visible label is then formatted as
 * "{resolved_title} {display_order}" when display_order is present.
 */
class ItemDisplayLabel
{
    /**
     * Append a COALESCE correlated sub-query that resolves to `display_label`
     * on every row of an Item query.
     *
     * Call this inside modifyQueryUsing() or any other query-building hook.
     * The helper ensures `items.*` is preserved in the column list when
     * no explicit SELECT has been issued yet.
     */
    /**
     * @template TModel of \Illuminate\Database\Eloquent\Model
     *
     * @param  Builder<TModel>  $query
     * @return Builder<TModel>
     */
    public static function withDisplayLabel(Builder $query): Builder
    {
        $langIdRaw = Language::default()->value('id');
        $ctxIdRaw = Context::default()->value('id');
        $defaultLangId = is_string($langIdRaw) ? $langIdRaw : '';
        $defaultContextId = is_string($ctxIdRaw) ? $ctxIdRaw : '';

        if (is_null($query->getQuery()->columns)) {
            $query->getQuery()->columns = ['items.*'];
        }

        return $query->selectRaw(
            "COALESCE(
                (SELECT it1a.name FROM item_translations it1a
                 WHERE it1a.item_id = items.id
                   AND it1a.language_id = ?
                   AND it1a.context_id = (SELECT c.context_id FROM collections c WHERE c.id = items.collection_id LIMIT 1)
                   AND it1a.name IS NOT NULL AND it1a.name != ''
                 LIMIT 1),
                (SELECT it1b.name FROM item_translations it1b
                 WHERE it1b.item_id = items.id
                   AND it1b.language_id = ?
                   AND it1b.context_id = (SELECT p.context_id FROM projects p WHERE p.id = items.project_id LIMIT 1)
                   AND it1b.name IS NOT NULL AND it1b.name != ''
                 LIMIT 1),
                (SELECT it2.name FROM item_translations it2
                 WHERE it2.item_id = items.id
                   AND it2.language_id = ?
                   AND it2.context_id = ?
                   AND it2.name IS NOT NULL AND it2.name != ''
                 LIMIT 1),
                (SELECT it3.name FROM item_translations it3
                 WHERE it3.item_id = items.id
                   AND it3.language_id = ?
                   AND it3.name IS NOT NULL AND it3.name != ''
                 LIMIT 1),
                (SELECT it4.name FROM item_translations it4
                 WHERE it4.item_id = items.id
                   AND it4.name IS NOT NULL AND it4.name != ''
                 LIMIT 1),
                items.internal_name
            ) AS display_label",
            [$defaultLangId, $defaultLangId, $defaultLangId, $defaultContextId, $defaultLangId]
        );
    }

    /**
     * Resolve the display label for a single Item record via PHP.
     *
     * Translations must already be loaded (or will be lazy-loaded on demand).
     * The collection and project relationships must be loaded (or will be
     * lazy-loaded) to resolve the own-context step.
     *
     * @param  Item  $item  The item whose label to resolve.
     * @return string The resolved display label.
     */
    public static function resolveForRecord(Item $item): string
    {
        $langIdRaw = Language::default()->value('id');
        $ctxIdRaw = Context::default()->value('id');
        $defaultLangId = is_string($langIdRaw) ? $langIdRaw : null;
        $defaultContextId = is_string($ctxIdRaw) ? $ctxIdRaw : null;

        $translations = $item->translations;

        // Resolve own context: try collection first, then project
        $ownContextId = null;
        if ($item->collection_id && $item->collection) {
            $ownContextId = $item->collection->context_id;
        }
        if (! $ownContextId && $item->project_id && $item->project) {
            $ownContextId = $item->project->context_id;
        }

        // 1. Default language + own context (collection or project)
        if ($ownContextId && $defaultLangId) {
            $t = $translations->first(
                fn ($t) => $t->language_id === $defaultLangId
                    && $t->context_id === $ownContextId
                    && ! empty($t->name)
            );
            if ($t) {
                return is_scalar($t->name) ? (string) $t->name : '';
            }
        }

        // 2. Default language + default context
        if ($defaultLangId && $defaultContextId) {
            $t = $translations->first(
                fn ($t) => $t->language_id === $defaultLangId
                    && $t->context_id === $defaultContextId
                    && ! empty($t->name)
            );
            if ($t) {
                return is_scalar($t->name) ? (string) $t->name : '';
            }
        }

        // 3. First translation in default language (any context)
        if ($defaultLangId) {
            $t = $translations->first(
                fn ($t) => $t->language_id === $defaultLangId && ! empty($t->name)
            );
            if ($t) {
                return is_scalar($t->name) ? (string) $t->name : '';
            }
        }

        // 4. First translation in any language
        $t = $translations->first(fn ($t) => ! empty($t->name));
        if ($t) {
            return (string) $t->name;
        }

        // 5. Fallback
        return $item->internal_name;
    }

    /**
     * Resolve the translated display label for an item without falling back to
     * internal_name. Returns null when no valid translation exists.
     *
     * Follows the same 4-step translation priority as resolveForRecord() but
     * stops before the internal_name fallback so callers can detect the
     * absence of any translation and apply their own fallback (e.g. the
     * parent-item chain for picture child items).
     *
     * @param  string|null  $defaultLangId  Pre-resolved default language ID (avoids redundant queries in loops).
     * @param  string|null  $defaultContextId  Pre-resolved default context ID.
     */
    public static function resolveTranslationOnly(Item $item, ?string $defaultLangId = null, ?string $defaultContextId = null): ?string
    {
        $defaultLangId ??= Language::default()->value('id');
        $defaultContextId ??= Context::default()->value('id');

        $translations = $item->translations;

        $ownContextId = null;
        if ($item->collection_id && $item->collection) {
            $ownContextId = $item->collection->context_id;
        }
        if (! $ownContextId && $item->project_id && $item->project) {
            $ownContextId = $item->project->context_id;
        }

        // 1. Default language + own context (collection or project)
        if ($ownContextId && $defaultLangId) {
            $t = $translations->first(
                fn ($t) => $t->language_id === $defaultLangId
                    && $t->context_id === $ownContextId
                    && ! empty($t->name)
            );
            if ($t) {
                return is_scalar($t->name) ? (string) $t->name : '';
            }
        }

        // 2. Default language + default context
        if ($defaultLangId && $defaultContextId) {
            $t = $translations->first(
                fn ($t) => $t->language_id === $defaultLangId
                    && $t->context_id === $defaultContextId
                    && ! empty($t->name)
            );
            if ($t) {
                return is_scalar($t->name) ? (string) $t->name : '';
            }
        }

        // 3. First translation in default language (any context)
        if ($defaultLangId) {
            $t = $translations->first(
                fn ($t) => $t->language_id === $defaultLangId && ! empty($t->name)
            );
            if ($t) {
                return is_scalar($t->name) ? (string) $t->name : '';
            }
        }

        // 4. First translation in any language
        $t = $translations->first(fn ($t) => ! empty($t->name));

        if (! $t) {
            return null;
        }

        return is_scalar($t->name) ? (string) $t->name : null;
    }

    /**
     * Resolve the visible display label for a picture child item.
     *
     * Extends the standard item fallback chain with a parent-item fallback:
     *  1. Picture's own translations (steps 1–4 of the standard chain).
     *  2. Direct parent item's translations (same 4 steps) when the picture
     *     itself has no valid translation.
     *  3. Picture's internal_name when neither the picture nor its parent
     *     has any valid translation.
     *
     * The returned label is formatted as "{resolved_title} {display_order}"
     * when display_order is present on the picture item.
     *
     * For N+1-free use in Filament tables/relation managers, eager-load:
     *   - translations, collection:id,context_id, project:id,context_id
     *   - parent.translations, parent.collection:id,context_id, parent.project:id,context_id
     *
     * @param  string|null  $defaultLangId  Pre-resolved default language ID.
     * @param  string|null  $defaultContextId  Pre-resolved default context ID.
     */
    public static function resolvePictureLabel(Item $picture, ?string $defaultLangId = null, ?string $defaultContextId = null): string
    {
        if ($defaultLangId === null) {
            $rawLang = Language::default()->value('id');
            $defaultLangId = is_string($rawLang) ? $rawLang : null;
        }

        if ($defaultContextId === null) {
            $rawCtx = Context::default()->value('id');
            $defaultContextId = is_string($rawCtx) ? $rawCtx : null;
        }

        $ownTranslation = static::resolveTranslationOnly($picture, $defaultLangId, $defaultContextId);

        if ($ownTranslation !== null) {
            $resolvedTitle = $ownTranslation;
        } elseif ($picture->parent) {
            $parentTranslation = static::resolveTranslationOnly($picture->parent, $defaultLangId, $defaultContextId);
            $resolvedTitle = $parentTranslation ?? $picture->internal_name;
        } else {
            $resolvedTitle = $picture->internal_name;
        }

        if ($picture->display_order !== null) {
            return "{$resolvedTitle} {$picture->display_order}";
        }

        return $resolvedTitle;
    }

    /**
     * Return a Filament TextColumn for picture child items that resolves
     * the translated label with parent-item fallback and display_order suffix.
     *
     * The column is not sortable/searchable. Keep internal_name searchable
     * alongside it for technical look-ups.
     *
     * The default language and context IDs are resolved once when the column
     * object is built and captured in the closure to prevent N+1 queries.
     */
    public static function pictureDisplayLabelColumn(): TextColumn
    {
        $langIdRaw = Language::default()->value('id');
        $ctxIdRaw = Context::default()->value('id');
        $defaultLangId = is_string($langIdRaw) ? $langIdRaw : null;
        $defaultContextId = is_string($ctxIdRaw) ? $ctxIdRaw : null;

        return TextColumn::make('picture_label')
            ->formatStateUsing(MarkdownState::inline())
            ->label('Name')
            ->getStateUsing(fn (Item $record): string => static::resolvePictureLabel($record, $defaultLangId, $defaultContextId))
            ->searchable(false)
            ->sortable(false);
    }

    /**
     * Resolve the display label for an item identified by its primary key.
     *
     * Loads the record and its translations in two queries. Suitable for
     * getOptionLabelUsing() callbacks where only a single value is needed.
     *
     * @param  mixed  $value  The item UUID.
     * @return string The resolved display label as plain text (Markdown removed, for option labels), or the raw value if not found.
     */
    public static function resolveLabel(mixed $value): string
    {
        if (! $value) {
            return '';
        }

        $item = Item::find($value);
        if (! $item instanceof Item) {
            return is_scalar($value) ? (string) $value : '';
        }

        $item->load(['translations', 'collection:id,context_id', 'project:id,context_id']);

        return MarkdownText::plain(static::resolveForRecord($item));
    }

    /**
     * Return a Filament TextColumn that shows the resolved display label.
     *
     * The column is deliberately not sortable/searchable because it maps to
     * a SQL COALESCE virtual column. Keep `internal_name` searchable alongside
     * this column for technical look-ups.
     */
    public static function displayLabelColumn(): TextColumn
    {
        return TextColumn::make('display_label')
            ->formatStateUsing(MarkdownState::inline())
            ->label('Name')
            ->searchable(false)
            ->sortable(false);
    }
}
