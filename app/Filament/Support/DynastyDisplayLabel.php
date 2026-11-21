<?php

namespace App\Filament\Support;

use App\Models\Dynasty;
use App\Models\Language;
use App\Support\Markdown\MarkdownText;
use Filament\Tables\Columns\TextColumn;
use Illuminate\Database\Eloquent\Builder;

/**
 * Resolves a user-facing display label for Dynasty records in Filament.
 *
 * Dynasty translations are language-only (no context dimension).
 * Dynasty has no internal_name column; the technical fallback is backward_compatibility.
 *
 * The fallback chain, stopping at the first non-empty value:
 *  1. First translation in the default language.
 *  2. First translation in any language.
 *  3. dynasties.backward_compatibility.
 */
class DynastyDisplayLabel
{
    /**
     * Append a COALESCE correlated sub-query that resolves to `display_label`
     * on every row of a Dynasty query.
     *
     * Call this inside modifyQueryUsing() or any other query-building hook.
     * The helper ensures `dynasties.*` is preserved in the column list when
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

        if (is_null($query->getQuery()->columns)) {
            $query->getQuery()->columns = ['dynasties.*'];
        }

        return $query->selectRaw(
            "COALESCE(
                (SELECT dt1.name FROM dynasty_translations dt1
                 WHERE dt1.dynasty_id = dynasties.id
                   AND dt1.language_id = ?
                   AND dt1.name IS NOT NULL AND dt1.name != ''
                 LIMIT 1),
                (SELECT dt2.name FROM dynasty_translations dt2
                 WHERE dt2.dynasty_id = dynasties.id
                   AND dt2.name IS NOT NULL AND dt2.name != ''
                 LIMIT 1),
                dynasties.backward_compatibility
            ) AS display_label",
            [$defaultLangId]
        );
    }

    /**
     * Resolve the display label for a single Dynasty record via PHP.
     *
     * Translations must already be loaded (or will be lazy-loaded on demand).
     *
     * @param  Dynasty  $dynasty  The dynasty whose label to resolve.
     * @return string The resolved display label.
     */
    public static function resolveForRecord(Dynasty $dynasty): string
    {
        $defaultLangId = Language::default()->value('id');

        $translations = $dynasty->translations;

        // 1. Default language
        if ($defaultLangId) {
            $t = $translations->first(
                fn ($t) => $t->language_id === $defaultLangId && ! empty($t->name)
            );
            if ($t) {
                return is_scalar($t->name) ? (string) $t->name : '';
            }
        }

        // 2. First translation in any language
        $t = $translations->first(fn ($t) => ! empty($t->name));
        if ($t) {
            return (string) $t->name;
        }

        // 3. Fallback
        return $dynasty->backward_compatibility ?? '';
    }

    /**
     * Resolve the display label for a dynasty identified by its primary key.
     *
     * Loads the record and its translations in two queries. Suitable for
     * getOptionLabelUsing() callbacks where only a single value is needed.
     *
     * @param  mixed  $value  The dynasty UUID.
     * @return string The resolved display label as plain text (Markdown removed, for option labels), or the raw value if not found.
     */
    public static function resolveLabel(mixed $value): string
    {
        if (! $value) {
            return '';
        }

        $dynasty = Dynasty::find($value);
        if (! $dynasty instanceof Dynasty) {
            return is_scalar($value) ? (string) $value : '';
        }

        $dynasty->load('translations');

        return MarkdownText::plain(static::resolveForRecord($dynasty));
    }

    /**
     * Return a Filament TextColumn that shows the resolved display label.
     *
     * The column is deliberately not sortable/searchable because it maps to
     * a SQL COALESCE virtual column. Keep `backward_compatibility` searchable
     * alongside this column for technical look-ups.
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
