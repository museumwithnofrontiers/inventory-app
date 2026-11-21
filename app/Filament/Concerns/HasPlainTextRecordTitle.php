<?php

namespace App\Filament\Concerns;

use App\Support\Markdown\MarkdownText;
use Illuminate\Contracts\Support\Htmlable;
use Illuminate\Database\Eloquent\Model;

/**
 * A resource whose record title is stored text, which is Markdown (a name, a
 * title): the page heading, breadcrumb, browser title and global search
 * result show it as plain text, since none of them can hold HTML.
 *
 * @see MarkdownText::plain()
 */
trait HasPlainTextRecordTitle
{
    public static function getRecordTitle(?Model $record): string|Htmlable|null
    {
        $title = parent::getRecordTitle($record);

        return is_string($title) ? MarkdownText::plain($title) : $title;
    }
}
