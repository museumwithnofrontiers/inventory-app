<?php

namespace App\Filament\Support;

use App\Support\Markdown\MarkdownText;
use Closure;
use Illuminate\Support\HtmlString;

/**
 * Formatters for Filament columns and entries that show stored text, which is
 * Markdown (see {@see MarkdownText} for the rules).
 *
 *     TextColumn::make('name')->formatStateUsing(MarkdownState::inline())
 *     TextColumn::make('description')->formatStateUsing(MarkdownState::excerpt(60))
 *     TextEntry::make('description')->formatStateUsing(MarkdownState::block())->prose()
 *
 * The formatters return an HtmlString (inline, block) that Filament prints as
 * is, or a plain string (excerpt) that Filament escapes. Never combine them
 * with `->limit()` or `->words()`: Filament would cut the HTML. `excerpt()`
 * cuts the plain text itself.
 */
final class MarkdownState
{
    /**
     * One line: emphasis kept, links reduced to their text.
     *
     * @return Closure(mixed): HtmlString
     */
    public static function inline(): Closure
    {
        return static fn (mixed $state): HtmlString => MarkdownText::inline($state);
    }

    /**
     * The start of a long text, as plain text cut to `$limit` characters.
     *
     * @return Closure(mixed): string
     */
    public static function excerpt(int $limit): Closure
    {
        return static fn (mixed $state): string => MarkdownText::excerpt($state, $limit);
    }

    /**
     * Plain text, for a tooltip or any place that can't hold HTML.
     *
     * @return Closure(mixed): string
     */
    public static function plain(): Closure
    {
        return static fn (mixed $state): string => MarkdownText::plain($state);
    }

    /**
     * A long text in an infolist: paragraphs, lists and links kept. Pair it
     * with the entry's `->prose()`, which styles the HTML.
     *
     * @return Closure(mixed): HtmlString
     */
    public static function block(): Closure
    {
        return static fn (mixed $state): HtmlString => MarkdownText::block($state);
    }
}
