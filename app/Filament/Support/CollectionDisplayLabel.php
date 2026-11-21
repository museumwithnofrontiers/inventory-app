<?php

namespace App\Filament\Support;

use App\Models\Collection;
use App\Models\Context;
use App\Models\Language;
use App\Support\Markdown\MarkdownText;
use Filament\Tables\Columns\TextColumn;
use Illuminate\Database\Eloquent\Builder;

/**
 * Resolves a user-facing display label for Collection records in Filament.
 *
 * The fallback chain, stopping at the first non-empty value:
 *  1. Default language + the collection's own context_id.
 *  2. Default language + the default context.
 *  3. First translation in the default language (any context).
 *  4. First translation in any language.
 *  5. collections.internal_name.
 */
class CollectionDisplayLabel
{
    /**
     * Append a COALESCE correlated sub-query that resolves to `display_label`
     * on every row of a Collection query.
     *
     * Call this inside modifyQueryUsing() or any other query-building hook.
     * The helper ensures `collections.*` is preserved in the column list when
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
        $defaultLangId = Language::default()->value('id') ?? '';
        $defaultContextId = Context::default()->value('id') ?? '';

        // Ensure base table columns are selected before appending the virtual column.
        // selectRaw / addSelect would wipe them if columns is still null.
        if (is_null($query->getQuery()->columns)) {
            $query->getQuery()->columns = ['collections.*'];
        }

        return $query->selectRaw(
            "COALESCE(
                (SELECT ct1.title FROM collection_translations ct1
                 WHERE ct1.collection_id = collections.id
                   AND ct1.language_id = ?
                   AND ct1.context_id = collections.context_id
                   AND ct1.title IS NOT NULL AND ct1.title != ''
                 LIMIT 1),
                (SELECT ct2.title FROM collection_translations ct2
                 WHERE ct2.collection_id = collections.id
                   AND ct2.language_id = ?
                   AND ct2.context_id = ?
                   AND ct2.title IS NOT NULL AND ct2.title != ''
                 LIMIT 1),
                (SELECT ct3.title FROM collection_translations ct3
                 WHERE ct3.collection_id = collections.id
                   AND ct3.language_id = ?
                   AND ct3.title IS NOT NULL AND ct3.title != ''
                 LIMIT 1),
                (SELECT ct4.title FROM collection_translations ct4
                 WHERE ct4.collection_id = collections.id
                   AND ct4.title IS NOT NULL AND ct4.title != ''
                 LIMIT 1),
                collections.internal_name
            ) AS display_label",
            [$defaultLangId, $defaultLangId, $defaultContextId, $defaultLangId]
        );
    }

    /**
     * Resolve the display label for a single Collection record via PHP.
     *
     * Translations must already be loaded (or will be lazy-loaded on demand).
     * Use this for single-record look-ups such as getOptionLabelUsing callbacks.
     *
     * @param  Collection  $collection  The collection whose label to resolve.
     * @return string The resolved display label.
     */
    public static function resolveForRecord(Collection $collection): string
    {
        $defaultLangId = Language::default()->value('id');
        $defaultContextId = Context::default()->value('id');

        $translations = $collection->translations;

        // 1. Default language + own context
        if ($collection->context_id && $defaultLangId) {
            $t = $translations->first(
                fn ($t) => $t->language_id === $defaultLangId
                    && $t->context_id === $collection->context_id
                    && ! empty($t->title)
            );
            if ($t) {
                return is_scalar($t->title) ? (string) $t->title : '';
            }
        }

        // 2. Default language + default context
        if ($defaultLangId && $defaultContextId) {
            $t = $translations->first(
                fn ($t) => $t->language_id === $defaultLangId
                    && $t->context_id === $defaultContextId
                    && ! empty($t->title)
            );
            if ($t) {
                return is_scalar($t->title) ? (string) $t->title : '';
            }
        }

        // 3. First translation in default language (any context)
        if ($defaultLangId) {
            $t = $translations->first(
                fn ($t) => $t->language_id === $defaultLangId && ! empty($t->title)
            );
            if ($t) {
                return is_scalar($t->title) ? (string) $t->title : '';
            }
        }

        // 4. First translation in any language
        $t = $translations->first(fn ($t) => ! empty($t->title));
        if ($t) {
            return (string) $t->title;
        }

        // 5. Fallback
        return $collection->internal_name;
    }

    /**
     * Resolve the display label for a collection identified by its primary key.
     *
     * Loads the record and its translations in two queries. Suitable for
     * getOptionLabelUsing() callbacks where only a single value is needed.
     *
     * @param  mixed  $value  The collection UUID.
     * @return string The resolved display label as plain text (Markdown removed, for option labels), or the raw value if not found.
     */
    public static function resolveLabel(mixed $value): string
    {
        if (! $value) {
            return '';
        }

        $collection = Collection::find($value);
        if (! $collection instanceof Collection) {
            return is_scalar($value) ? (string) $value : '';
        }

        $collection->load('translations');

        return MarkdownText::plain(static::resolveForRecord($collection));
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
            ->label('Title')
            ->searchable(false)
            ->sortable(false);
    }
}
