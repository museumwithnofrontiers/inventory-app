<?php

namespace App\Filament\Support;

use App\Models\Context;
use App\Models\Language;
use App\Models\Partner;
use App\Support\Markdown\MarkdownText;
use Filament\Tables\Columns\TextColumn;
use Illuminate\Database\Eloquent\Builder;

/**
 * Resolves a user-facing display label for Partner records in Filament.
 *
 * The fallback chain, stopping at the first non-empty value:
 *  1. Default language + project's context_id (when project_id is present).
 *  2. Default language + the default context.
 *  3. First translation in the default language (any context).
 *  4. First translation in any language.
 *  5. partners.internal_name.
 */
class PartnerDisplayLabel
{
    /**
     * Append a COALESCE correlated sub-query that resolves to `display_label`
     * on every row of a Partner query.
     *
     * Call this inside modifyQueryUsing() or any other query-building hook.
     * The helper ensures `partners.*` is preserved in the column list when
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

        if (is_null($query->getQuery()->columns)) {
            $query->getQuery()->columns = ['partners.*'];
        }

        return $query->selectRaw(
            "COALESCE(
                (SELECT pt1.name FROM partner_translations pt1
                 WHERE pt1.partner_id = partners.id
                   AND pt1.language_id = ?
                   AND pt1.context_id = (SELECT p.context_id FROM projects p WHERE p.id = partners.project_id LIMIT 1)
                   AND pt1.name IS NOT NULL AND pt1.name != ''
                 LIMIT 1),
                (SELECT pt2.name FROM partner_translations pt2
                 WHERE pt2.partner_id = partners.id
                   AND pt2.language_id = ?
                   AND pt2.context_id = ?
                   AND pt2.name IS NOT NULL AND pt2.name != ''
                 LIMIT 1),
                (SELECT pt3.name FROM partner_translations pt3
                 WHERE pt3.partner_id = partners.id
                   AND pt3.language_id = ?
                   AND pt3.name IS NOT NULL AND pt3.name != ''
                 LIMIT 1),
                (SELECT pt4.name FROM partner_translations pt4
                 WHERE pt4.partner_id = partners.id
                   AND pt4.name IS NOT NULL AND pt4.name != ''
                 LIMIT 1),
                partners.internal_name
            ) AS display_label",
            [$defaultLangId, $defaultLangId, $defaultContextId, $defaultLangId]
        );
    }

    /**
     * Resolve the display label for a single Partner record via PHP.
     *
     * Translations must already be loaded (or will be lazy-loaded on demand).
     * The project relationship must be loaded (or will be lazy-loaded) to
     * resolve the own-context step.
     *
     * @param  Partner  $partner  The partner whose label to resolve.
     * @return string The resolved display label.
     */
    public static function resolveForRecord(Partner $partner): string
    {
        $defaultLangId = Language::default()->value('id');
        $defaultContextId = Context::default()->value('id');

        $translations = $partner->translations;

        // Resolve own context from project
        $ownContextId = null;
        if ($partner->project_id && $partner->project) {
            $ownContextId = $partner->project->context_id;
        }

        // 1. Default language + own context (project's context_id)
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
        return $partner->internal_name;
    }

    /**
     * Resolve the display label for a partner identified by its primary key.
     *
     * Loads the record and its translations in two queries. Suitable for
     * getOptionLabelUsing() callbacks where only a single value is needed.
     *
     * @param  mixed  $value  The partner UUID.
     * @return string The resolved display label as plain text (Markdown removed, for option labels), or the raw value if not found.
     */
    public static function resolveLabel(mixed $value): string
    {
        if (! $value) {
            return '';
        }

        $partner = Partner::find($value);
        if (! $partner instanceof Partner) {
            return is_scalar($value) ? (string) $value : '';
        }

        $partner->load(['translations', 'project:id,context_id']);

        return MarkdownText::plain(static::resolveForRecord($partner));
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
