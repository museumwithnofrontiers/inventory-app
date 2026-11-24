<?php

namespace App\Filament\Support;

use Filament\Schemas\Components\Section;
use App\Models\CollectionItemTranslation;
use Filament\Forms\Components\MarkdownEditor;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Infolists\Components\TextEntry;
use Illuminate\Validation\Rules\Unique;

/**
 * The form and infolist of a placement's texts in one language (M16 C2,
 * #2642), as the placement's appearance page edits them. Every text is kept
 * as written, each legacy field in its own column.
 */
final class CollectionItemTranslationForm
{
    /**
     * @param  string  $placementId  the placement the texts belong to
     * @return array<int, \Filament\Schemas\Components\Component>
     */
    public static function fields(string $placementId): array
    {
        return [
            Select::make('language_id')
                ->label('Language')
                ->relationship('language', 'internal_name')
                ->searchable()
                ->required()
                ->unique(
                    table: 'collection_item_translations',
                    column: 'language_id',
                    ignoreRecord: true,
                    modifyRuleUsing: fn (Unique $rule): Unique => $rule->where('collection_item_id', $placementId),
                )
                ->validationMessages(['unique' => 'This placement already has texts in this language.']),
            Section::make('Texts')
                ->schema([
                    TextInput::make('title')
                        ->helperText('A detail view\'s name.')
                        ->maxLength(255),
                    MarkdownEditor::make('description')
                        ->helperText('The item\'s text on this collection (Markdown).')
                        ->minHeight('7.5rem')
                        ->columnSpanFull(),
                    MarkdownEditor::make('caption')
                        ->helperText('The image caption.')
                        ->minHeight('4.5rem')
                        ->columnSpanFull(),
                ])
                ->columns(2),
            Section::make('Caption of the item')
                ->description('The item\'s caption on this collection, as written.')
                ->schema([
                    TextInput::make('item_name')->label('Name'),
                    TextInput::make('item_date')->label('Date'),
                    TextInput::make('item_location')->label('Location'),
                    TextInput::make('item_museum')->label('Museum'),
                    TextInput::make('item_dynasty')->label('Dynasty'),
                    MarkdownEditor::make('item_artist')->label('Artist')->minHeight('4.5rem'),
                    TextInput::make('item_material')->label('Material'),
                ])
                ->columns(2)
                ->collapsible(),
            Section::make('Justifications')
                ->description('Why the item was selected.')
                ->schema([
                    MarkdownEditor::make('curator_justification')->label('Curator')->minHeight('6rem'),
                    MarkdownEditor::make('partner_justification')->label('Partner')->minHeight('6rem'),
                    MarkdownEditor::make('justification')
                        ->label('National Context')
                        ->helperText('Sharing History\'s National Context gives one justification.')
                        ->minHeight('6rem')
                        ->columnSpanFull(),
                ])
                ->columns(2)
                ->collapsible(),
            Section::make('Legacy')
                ->schema([
                    TranslationFormSchema::backwardCompatibilityField(),
                ])
                ->collapsible()
                ->collapsed(),
        ];
    }

    /**
     * @return array<int, \Filament\Schemas\Components\Section>
     */
    public static function entries(): array
    {
        return [
            Section::make('Texts')
                ->schema([
                    TextEntry::make('language.internal_name')->label('Language'),
                    TranslationInfolistSchema::rtlTextEntry('title'),
                    TranslationInfolistSchema::markdownEntry('description', columnSpanFull: true),
                    TranslationInfolistSchema::rtlTextEntry('caption'),
                ])
                ->columns(2),
            Section::make('Caption of the item')
                ->schema([
                    TranslationInfolistSchema::rtlTextEntry('item_name', 'Name'),
                    TranslationInfolistSchema::rtlTextEntry('item_date', 'Date'),
                    TranslationInfolistSchema::rtlTextEntry('item_location', 'Location'),
                    TranslationInfolistSchema::rtlTextEntry('item_museum', 'Museum'),
                    TranslationInfolistSchema::rtlTextEntry('item_dynasty', 'Dynasty'),
                    TranslationInfolistSchema::rtlTextEntry('item_artist', 'Artist'),
                    TranslationInfolistSchema::rtlTextEntry('item_material', 'Material'),
                ])
                ->columns(2),
            Section::make('Justifications')
                ->schema([
                    TranslationInfolistSchema::markdownEntry('curator_justification', 'Curator'),
                    TranslationInfolistSchema::markdownEntry('partner_justification', 'Partner'),
                    TranslationInfolistSchema::markdownEntry('justification', 'National Context', columnSpanFull: true),
                ])
                ->columns(2),
            Section::make('Legacy')
                ->schema([
                    TextEntry::make('backward_compatibility')->label('Legacy ID')->placeholder('—'),
                ]),
        ];
    }

    /**
     * Whether the record has any text, for the table's summary column.
     */
    public static function hasJustification(CollectionItemTranslation $translation): bool
    {
        return filled($translation->curator_justification)
            || filled($translation->partner_justification)
            || filled($translation->justification);
    }
}
