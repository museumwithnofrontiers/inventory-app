<?php

namespace App\Filament\Support;

use App\Models\CollectionItemExploreMonument;
use App\Models\Partner;
use App\Support\Markdown\MarkdownText;
use Filament\Forms\Components\Component;
use Filament\Forms\Components\Fieldset;
use Filament\Forms\Components\Repeater;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Illuminate\Database\Eloquent\Builder;

/**
 * The form of the Explore monuments a placement stands for (M16 C4, #2644),
 * as the placement's page edits them: one entry per Explore monument, in
 * order. Everything is kept as written.
 */
final class CollectionItemExploreMonumentForm
{
    /**
     * @return array<int, Component>
     */
    public static function fields(): array
    {
        return [
            Repeater::make('exploreMonuments')
                ->label('Explore monuments')
                ->relationship()
                ->orderColumn('position')
                ->itemLabel(fn (array $state): ?string => is_string($state['backward_compatibility'] ?? null) ? $state['backward_compatibility'] : null)
                ->schema([
                    TextInput::make('backward_compatibility')
                        ->label('Legacy key')
                        ->helperText('The Explore monument, as mwnf3_explore:monument:<id>.')
                        ->required()
                        ->maxLength(255)
                        ->columnSpanFull(),
                    TextInput::make('latitude')->numeric()->minValue(-90)->maxValue(90),
                    TextInput::make('longitude')->numeric()->minValue(-180)->maxValue(180),
                    TextInput::make('map_zoom')->label('Map zoom')->integer()->minValue(0)->maxValue(22),
                    RecordSelect::forCollections(
                        'location_collection_id',
                        'Location (on an itinerary)',
                        required: false,
                        scope: fn (Builder $query): Builder => $query->where('backward_compatibility', 'like', 'mwnf3_explore:location:%'),
                    ),
                    Select::make('partners')
                        ->label('Museums')
                        ->relationship('partners', 'internal_name')
                        ->getOptionLabelFromRecordUsing(fn (Partner $record): string => MarkdownText::plain($record->internal_name))
                        ->multiple()
                        ->searchable(['internal_name', 'backward_compatibility'])
                        ->columnSpanFull(),
                    Fieldset::make('Legacy description references')
                        ->schema([
                            TextInput::make('description_types')->label('Description types'),
                            TextInput::make('travels_description_ref')->label('Travels description'),
                            TextInput::make('explore_description_ref')->label('Explore description'),
                            TextInput::make('virtual_museum_description_ref')->label('Virtual museum description'),
                        ]),
                ])
                ->columns(3)
                ->defaultItems(0)
                ->addActionLabel('Add an Explore monument'),
        ];
    }

    /**
     * A one-line summary of an Explore monument, for the placement's page.
     */
    public static function summary(CollectionItemExploreMonument $monument): string
    {
        $parts = [$monument->backward_compatibility];
        if ($monument->latitude !== null && $monument->longitude !== null) {
            $parts[] = sprintf('%s, %s', $monument->latitude, $monument->longitude);
        }
        $museums = $monument->partners->pluck('internal_name')->filter()->map(MarkdownText::plain(...))->implode(', ');
        if ($museums !== '') {
            $parts[] = 'museums: '.$museums;
        }

        return implode(' · ', $parts);
    }
}
