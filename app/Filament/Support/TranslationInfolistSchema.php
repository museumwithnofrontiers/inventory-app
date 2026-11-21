<?php

namespace App\Filament\Support;

use App\Support\Markdown\MarkdownText;
use Filament\Infolists\Components\TextEntry;
use Illuminate\Support\HtmlString;

class TranslationInfolistSchema
{
    /**
     * Returns a TextEntry that renders a long text, which is Markdown, as
     * block HTML ({@see MarkdownText::block()}: raw HTML escaped, unsafe links
     * refused). When the record's language_id is 'ara', the HTML is wrapped in
     * a right-to-left container so Arabic text displays correctly.
     */
    public static function markdownEntry(string $name, ?string $label = null, bool $columnSpanFull = false): TextEntry
    {
        $entry = TextEntry::make($name)
            ->prose()
            ->formatStateUsing(fn (mixed $state, mixed $record): HtmlString => self::wrapForDirection(MarkdownText::block($state), $record, block: true));

        if ($label !== null) {
            $entry->label($label);
        }

        if ($columnSpanFull) {
            $entry->columnSpanFull();
        }

        return $entry;
    }

    /**
     * Returns a TextEntry for a short text, which is Markdown, rendered on one
     * line ({@see MarkdownText::inline()}), right-to-left for Arabic records.
     */
    public static function rtlTextEntry(string $name, ?string $label = null): TextEntry
    {
        $entry = TextEntry::make($name)
            ->formatStateUsing(fn (mixed $state, mixed $record): HtmlString => self::wrapForDirection(MarkdownText::inline($state), $record, block: false));

        if ($label !== null) {
            $entry->label($label);
        }

        return $entry;
    }

    /**
     * Returns a TextEntry that pretty-prints the `extra` JSON field for infolist display.
     */
    public static function extraEntry(string $name = 'extra'): TextEntry
    {
        return ExtraJsonField::infolistEntry($name);
    }

    /**
     * Wraps rendered HTML in a right-to-left container when the record's
     * language is Arabic ('ara').
     */
    private static function wrapForDirection(HtmlString $html, mixed $record, bool $block): HtmlString
    {
        $languageId = is_object($record) && is_string($record->language_id ?? null) ? $record->language_id : null;

        if ($languageId !== 'ara' || $html->isEmpty()) {
            return $html;
        }

        return new HtmlString($block
            ? '<div dir="rtl" class="text-right">'.$html->toHtml().'</div>'
            : '<span dir="rtl" class="block text-right">'.$html->toHtml().'</span>');
    }
}
