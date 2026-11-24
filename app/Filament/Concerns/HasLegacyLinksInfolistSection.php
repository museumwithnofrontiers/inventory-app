<?php

namespace App\Filament\Concerns;

use Filament\Schemas\Components\Section;
use App\Services\LegacyUrlResolver;
use App\Support\LegacyLinks\LegacyLink;
use Filament\Infolists\Components\TextEntry;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\HtmlString;

trait HasLegacyLinksInfolistSection
{
    protected static function legacyLinksSection(): Section
    {
        return Section::make('Legacy links')
            ->schema([
                TextEntry::make('legacy_links')
                    ->label('Resolved links')
                    ->state(fn (Model $record): HtmlString => static::legacyLinksHtml($record))
                    ->html()
                    ->columnSpanFull(),
            ])
            ->columns(1)
            ->collapsible();
    }

    protected static function legacyLinksHtml(Model $record): HtmlString
    {
        $links = app(LegacyUrlResolver::class)->resolveFor($record)->links;

        $items = collect($links)
            ->map(fn (LegacyLink $link): string => static::legacyLinkHtml($link))
            ->implode('');

        return new HtmlString('<ul class="space-y-2">'.$items.'</ul>');
    }

    protected static function legacyLinkHtml(LegacyLink $link): string
    {
        $heading = e($link->type->label().' - '.$link->confidence->label());
        $label = e($link->label);
        $source = e($link->source);
        $note = $link->note ? '<div class="text-xs text-gray-500">'.e($link->note).'</div>' : '';

        if ($link->url === null) {
            return <<<HTML
                <li>
                    <div class="font-medium">{$label}</div>
                    <div class="text-xs text-gray-500">{$heading}</div>
                    <div class="text-xs text-gray-500">Source: {$source}</div>
                    {$note}
                </li>
            HTML;
        }

        $url = e($link->url);

        return <<<HTML
            <li>
                <a href="{$url}" target="_blank" rel="noopener noreferrer" class="font-medium text-primary-600 hover:underline">{$label}</a>
                <div class="text-xs text-gray-500">{$heading}</div>
                <div class="break-all text-xs text-gray-500">{$url}</div>
                <div class="text-xs text-gray-500">Source: {$source}</div>
                {$note}
            </li>
        HTML;
    }
}
