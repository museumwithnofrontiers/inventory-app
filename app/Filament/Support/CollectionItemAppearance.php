<?php

namespace App\Filament\Support;

use App\Models\CollectionItem;
use App\Models\Language;
use Filament\Forms\Components\Component;
use Filament\Forms\Components\TextInput;
use Filament\Infolists\Components\Section;
use Filament\Infolists\Components\TextEntry;
use Filament\Tables\Actions\Action;
use Filament\Tables\Columns\TextColumn;
use Illuminate\Database\Eloquent\Model;

/**
 * Shared Filament helpers for Collection-Item appearance presentation.
 *
 * Provides reusable table columns and row actions for displaying pivot metadata
 * (display order, contextual text, language keys, source provenance) in both
 * the Collection Items relation manager and the Item Collection appearances
 * relation manager.
 */
class CollectionItemAppearance
{
    /**
     * Returns the collection_item pivot's own editable fields — display_order
     * and extra — used identically by both ItemsRelationManager's and
     * CollectionAppearancesRelationManager's Attach and Edit-pivot forms (M7
     * story A2.1, #1900).
     *
     * @return array<int, Component>
     */
    public static function pivotFormFields(): array
    {
        return [
            TextInput::make('display_order')
                ->label('Display order')
                ->numeric()
                ->integer(),
            ExtraJsonField::formComponent(),
        ];
    }

    /**
     * Returns a TextColumn for the pivot display_order field.
     */
    public static function displayOrderColumn(): TextColumn
    {
        return TextColumn::make('pivot.display_order')
            ->label('Display order')
            ->numeric()
            ->sortable()
            ->placeholder('—');
    }

    /**
     * Returns a TextColumn showing a preview of the contextual description
     * in the default language.
     */
    public static function contextualTextPreviewColumn(): TextColumn
    {
        $langIdRaw = Language::default()->value('id');
        $defaultLangId = is_string($langIdRaw) ? $langIdRaw : null;

        return TextColumn::make('pivot.contextual_text_preview')
            ->label('Contextual text')
            ->getStateUsing(function (Model $record) use ($defaultLangId): ?string {
                $pivot = $record->getAttribute('pivot');
                if (! ($pivot instanceof CollectionItem)) {
                    return null;
                }

                $text = $defaultLangId
                    ? $pivot->contextualDescriptionForLanguage($defaultLangId)
                    : null;

                if ($text === null) {
                    $descriptions = $pivot->contextualDescriptions();
                    $text = $descriptions !== [] ? reset($descriptions) : null;
                }

                return $text !== null ? mb_substr((string) $text, 0, 80).(mb_strlen((string) $text) > 80 ? '…' : '') : null;
            })
            ->placeholder('—')
            ->toggleable();
    }

    /**
     * Returns a TextColumn showing the language keys that have contextual descriptions.
     */
    public static function contextualTextLanguagesColumn(): TextColumn
    {
        return TextColumn::make('pivot.contextual_description_languages')
            ->label('Languages')
            ->getStateUsing(function (Model $record): ?string {
                $pivot = $record->getAttribute('pivot');
                if (! ($pivot instanceof CollectionItem)) {
                    return null;
                }

                $languages = $pivot->contextualDescriptionLanguages();

                return $languages !== [] ? implode(', ', $languages) : null;
            })
            ->badge()
            ->separator(', ')
            ->placeholder('—')
            ->toggleable();
    }

    /**
     * Returns a row Action that opens a modal with all contextual descriptions
     * and source provenance values for the appearance.
     *
     * The action is hidden when no contextual or provenance data exists on the pivot.
     */
    public static function viewAppearanceTextAction(): Action
    {
        return Action::make('view_appearance_text')
            ->label('Appearance text')
            ->icon('heroicon-o-document-text')
            ->color('gray')
            ->modalHeading('Appearance text')
            ->modalSubmitAction(false)
            ->modalCancelActionLabel('Close')
            ->infolist(function (Model $record): array {
                $pivot = $record->getAttribute('pivot');
                if (! ($pivot instanceof CollectionItem)) {
                    return [];
                }

                $descriptions = $pivot->contextualDescriptions();
                $sources = $pivot->sourceBackwardCompatibilityByLanguage();
                $allLanguageIds = array_unique(
                    array_merge(array_keys($descriptions), array_keys($sources))
                );

                if ($allLanguageIds === []) {
                    return [
                        TextEntry::make('no_content')
                            ->label('')
                            ->state('No contextual text available.')
                            ->columnSpanFull(),
                    ];
                }

                $schema = [];
                foreach ($allLanguageIds as $langId) {
                    $entries = [];

                    if (isset($descriptions[$langId]) && $descriptions[$langId] !== '') {
                        $text = $descriptions[$langId];
                        $entries[] = TextEntry::make('desc_'.$langId)
                            ->label('Contextual description')
                            ->state((string) $text)
                            ->columnSpanFull();
                    }

                    if (isset($sources[$langId]) && $sources[$langId] !== '') {
                        $entries[] = TextEntry::make('source_'.$langId)
                            ->label('Source (legacy reference)')
                            ->state((string) $sources[$langId])
                            ->columnSpanFull();
                    }

                    if ($entries !== []) {
                        $schema[] = Section::make(strtoupper($langId))
                            ->schema($entries);
                    }
                }

                return $schema;
            })
            ->visible(function (Model $record): bool {
                $pivot = $record->getAttribute('pivot');
                if (! ($pivot instanceof CollectionItem)) {
                    return false;
                }

                return $pivot->contextualDescriptions() !== []
                    || $pivot->sourceBackwardCompatibilityByLanguage() !== [];
            });
    }
}
