<?php

namespace App\Filament\Support;

use App\Models\Language;
use App\Models\TimelineEvent;
use App\Support\Markdown\MarkdownText;
use Filament\Tables\Columns\TextColumn;
use Illuminate\Database\Eloquent\Builder;

/**
 * Resolves a user-facing display label for TimelineEvent records in Filament.
 *
 * TimelineEvent translations are language-only (no context dimension).
 *
 * The fallback chain, stopping at the first non-empty value:
 *  1. First translation in the default language.
 *  2. First translation in any language.
 *  3. timeline_events.internal_name.
 */
class TimelineEventDisplayLabel
{
    /**
     * Append a COALESCE correlated sub-query that resolves to `display_label`
     * on every row of a TimelineEvent query.
     *
     * Call this inside modifyQueryUsing() or any other query-building hook.
     * The helper ensures `timeline_events.*` is preserved in the column list
     * when no explicit SELECT has been issued yet.
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
            $query->getQuery()->columns = ['timeline_events.*'];
        }

        return $query->selectRaw(
            "COALESCE(
                (SELECT tet1.name FROM timeline_event_translations tet1
                 WHERE tet1.timeline_event_id = timeline_events.id
                   AND tet1.language_id = ?
                   AND tet1.name IS NOT NULL AND tet1.name != ''
                 LIMIT 1),
                (SELECT tet2.name FROM timeline_event_translations tet2
                 WHERE tet2.timeline_event_id = timeline_events.id
                   AND tet2.name IS NOT NULL AND tet2.name != ''
                 LIMIT 1),
                timeline_events.internal_name
            ) AS display_label",
            [$defaultLangId]
        );
    }

    /**
     * Resolve the display label for a single TimelineEvent record via PHP.
     *
     * Translations must already be loaded (or will be lazy-loaded on demand).
     *
     * @param  TimelineEvent  $event  The timeline event whose label to resolve.
     * @return string The resolved display label.
     */
    public static function resolveForRecord(TimelineEvent $event): string
    {
        $defaultLangId = Language::default()->value('id');

        $translations = $event->translations;

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
        return $event->internal_name;
    }

    /**
     * Resolve the display label for a timeline event identified by its primary key.
     *
     * Loads the record and its translations in two queries. Suitable for
     * getOptionLabelUsing() callbacks where only a single value is needed.
     *
     * @param  mixed  $value  The timeline event UUID.
     * @return string The resolved display label as plain text (Markdown removed, for option labels), or the raw value if not found.
     */
    public static function resolveLabel(mixed $value): string
    {
        if (! $value) {
            return '';
        }

        $event = TimelineEvent::find($value);
        if (! $event instanceof TimelineEvent) {
            return is_scalar($value) ? (string) $value : '';
        }

        $event->load('translations');

        return MarkdownText::plain(static::resolveForRecord($event));
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
