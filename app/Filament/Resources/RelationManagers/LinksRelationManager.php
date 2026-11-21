<?php

namespace App\Filament\Resources\RelationManagers;

use App\Enums\LinkType;
use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Resources\LanguageResource;
use App\Filament\Support\ExtraJsonField;
use App\Filament\Support\MarkdownState;
use App\Models\Link;
use App\Models\PublicationEdition;
use Filament\Forms\Components\MarkdownEditor;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Form;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Actions\CreateAction;
use Filament\Tables\Actions\DeleteAction;
use Filament\Tables\Actions\EditAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

/**
 * The links of an item, a collection, a partner or a publication edition
 * (M16 F3): one manager for every owner, replacing the Media managers.
 */
class LinksRelationManager extends RelationManager
{
    use AuthorizesRelationMutations {
        hostRecordCanBeUpdated as ownerRecordCanBeUpdated;
    }

    protected static string $relationship = 'links';

    protected static ?string $recordTitleAttribute = 'title';

    protected static ?string $title = 'Links';

    /**
     * A publication edition has no policy of its own: its publication's
     * governs it, as in the publication's Editions manager.
     */
    public function hostRecordCanBeUpdated(): bool
    {
        $owner = $this->getOwnerRecord();
        if ($owner instanceof PublicationEdition) {
            $user = auth()->user();

            return $user !== null && $owner->publication !== null && $user->can('update', $owner->publication);
        }

        return $this->ownerRecordCanBeUpdated();
    }

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                Select::make('type')
                    ->options(LinkType::options())
                    ->required(),
                TextInput::make('url')
                    ->label('URL')
                    ->url()
                    ->required()
                    ->maxLength(2048)
                    ->columnSpanFull(),
                TextInput::make('title')
                    ->maxLength(255),
                // Optional, unlike a translation's language, so not
                // TranslationFormSchema::languageField() (which is required).
                Select::make('language_id')
                    ->label('Language')
                    ->relationship('language', 'internal_name')
                    ->searchable()
                    ->nullable(),
                MarkdownEditor::make('description')
                    ->minHeight('6rem')
                    ->columnSpanFull(),
                MarkdownEditor::make('authors')
                    ->minHeight('4.5rem')
                    ->columnSpanFull(),
                TextInput::make('category')
                    ->label('Category')
                    ->helperText('The legacy category number; the site shows its name.')
                    ->numeric()
                    ->integer()
                    ->minValue(0)
                    ->maxValue(255)
                    ->nullable(),
                TextInput::make('resource_type')
                    ->label('Resource type')
                    ->maxLength(255)
                    ->nullable(),
                TextInput::make('location')
                    ->maxLength(255)
                    ->nullable(),
                TextInput::make('country_code')
                    ->label('Country code')
                    ->maxLength(16)
                    ->nullable(),
                MarkdownEditor::make('further_reading')
                    ->label('Further reading')
                    ->minHeight('6rem')
                    ->columnSpanFull(),
                TextInput::make('display_order')
                    ->label('Display order')
                    ->numeric()
                    ->integer()
                    ->default(0),
                ExtraJsonField::formComponent(),
            ]);
    }

    public function table(Table $table): Table
    {
        return $table
            ->modifyQueryUsing(fn (Builder $query): Builder => $query->with(['language:id,internal_name']))
            ->defaultSort('display_order', 'asc')
            ->paginated([25, 50, 100])
            ->defaultPaginationPageOption(25)
            ->columns([
                TextColumn::make('type')
                    ->badge()
                    ->formatStateUsing(fn (?LinkType $state): ?string => $state?->label())
                    ->sortable(),
                TextColumn::make('title')
                    ->formatStateUsing(MarkdownState::inline())
                    ->searchable()
                    ->sortable()
                    ->placeholder('—'),
                TextColumn::make('url')
                    ->label('URL')
                    ->url(fn (Link $record): string => $record->url)
                    ->openUrlInNewTab()
                    ->limit(60)
                    ->searchable(),
                TextColumn::make('language.internal_name')
                    ->label('Language')
                    ->sortable()
                    ->url(fn (Link $record): ?string => $record->language
                        ? (auth()->user()?->can('view', $record->language) ? LanguageResource::getUrl('view', ['record' => $record->language]) : null)
                        : null),
                TextColumn::make('display_order')
                    ->label('Order')
                    ->sortable()
                    ->toggleable(),
                TextColumn::make('created_at')
                    ->label('Created')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                SelectFilter::make('type')
                    ->options(LinkType::options()),
            ])
            ->headerActions([
                CreateAction::make(),
            ])
            ->actions([
                EditAction::make(),
                DeleteAction::make(),
            ]);
    }
}
