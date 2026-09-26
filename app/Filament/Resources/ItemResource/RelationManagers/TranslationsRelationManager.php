<?php

namespace App\Filament\Resources\ItemResource\RelationManagers;

use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Resources\ContextResource;
use App\Filament\Resources\ItemResource;
use App\Filament\Resources\ItemTranslationResource;
use App\Filament\Resources\LanguageResource;
use App\Filament\Support\TranslationFormSchema;
use App\Models\Context;
use App\Models\Item;
use App\Models\ItemTranslation;
use App\Models\Language;
use Filament\Forms\Components\Section;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Form;
use Filament\Forms\Get;
use Filament\Notifications\Notification;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Actions\Action;
use Filament\Tables\Actions\CreateAction;
use Filament\Tables\Actions\DeleteAction;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\Rules\Unique;

class TranslationsRelationManager extends RelationManager
{
    use AuthorizesRelationMutations;

    protected static string $relationship = 'translations';

    protected static ?string $recordTitleAttribute = 'name';

    protected static ?string $title = 'Translations';

    public function form(Form $form): Form
    {
        $ownerRecord = $this->ownerItem();

        return $form
            ->schema([
                TranslationFormSchema::languageField()
                    ->unique(
                        table: 'item_translations',
                        column: 'language_id',
                        modifyRuleUsing: function (Unique $rule, Get $get) use ($ownerRecord): Unique {
                            return $rule->where(fn (\Illuminate\Database\Query\Builder $q) => $q
                                ->where('item_id', $ownerRecord->id)
                                ->where('context_id', $get('context_id'))
                            );
                        },
                        ignoreRecord: true,
                    )
                    ->validationMessages(['unique' => 'A translation for this language and context already exists.']),
                TranslationFormSchema::contextField(),

                Section::make('Basic Text')
                    ->schema([
                        TextInput::make('name')
                            ->required()
                            ->maxLength(255),
                        TextInput::make('alternate_name')
                            ->maxLength(255),
                        Textarea::make('description')
                            ->rows(4)
                            ->columnSpanFull(),
                    ])
                    ->columns(2),

                Section::make('Object Details')
                    ->schema([
                        TextInput::make('type')
                            ->placeholder('e.g., painting, sculpture, monument')
                            ->maxLength(255),
                        TextInput::make('dates')
                            ->placeholder('e.g., 1920–1930, 18th century')
                            ->maxLength(255),
                        TextInput::make('location')
                            ->placeholder('Current or original location')
                            ->maxLength(255),
                        TextInput::make('dimensions')
                            ->placeholder('e.g., 100×80 cm, 2 m height')
                            ->maxLength(255),
                        TextInput::make('place_of_production')
                            ->label('Place of production')
                            ->placeholder('Where the item was created')
                            ->maxLength(255),
                        Textarea::make('holder')
                            ->placeholder('Current holder of the item')
                            ->rows(2),
                        Textarea::make('owner')
                            ->placeholder('Current owner of the item')
                            ->rows(2),
                        Textarea::make('initial_owner')
                            ->label('Initial owner')
                            ->placeholder('Original owner of the item')
                            ->rows(2),
                    ])
                    ->columns(2)
                    ->collapsible()
                    ->collapsed(),

                Section::make('Research & Provenance')
                    ->schema([
                        Textarea::make('method_for_datation')
                            ->label('Method for datation')
                            ->placeholder('Method used to date the item')
                            ->rows(3),
                        Textarea::make('method_for_provenance')
                            ->label('Method for provenance')
                            ->placeholder('Method used to determine provenance')
                            ->rows(3),
                        Textarea::make('provenance')
                            ->placeholder('Provenance details')
                            ->rows(3),
                        Textarea::make('obtention')
                            ->placeholder('How the item was obtained')
                            ->rows(3),
                        Textarea::make('bibliography')
                            ->placeholder('Bibliographic references')
                            ->rows(4)
                            ->columnSpanFull(),
                    ])
                    ->columns(2)
                    ->collapsible()
                    ->collapsed(),

                Section::make('Contributors')
                    ->schema([
                        TranslationFormSchema::authorSelectField('author_id', 'Author'),
                        TranslationFormSchema::authorSelectField('text_copy_editor_id', 'Text copy editor'),
                        TranslationFormSchema::authorSelectField('translator_id', 'Translator'),
                        TranslationFormSchema::authorSelectField('translation_copy_editor_id', 'Translation copy editor'),
                    ])
                    ->columns(2)
                    ->collapsible()
                    ->collapsed(),

                Section::make('Legacy & Metadata')
                    ->schema([
                        TranslationFormSchema::backwardCompatibilityField(),
                        TranslationFormSchema::extraField(),
                    ])
                    ->columns(2)
                    ->collapsible()
                    ->collapsed(),
            ]);
    }

    public function table(Table $table): Table
    {
        return $table
            ->modifyQueryUsing(fn (Builder $query): Builder => $query->with([
                'context:id,internal_name,is_default',
                'language:id,internal_name,is_default',
            ]))
            ->defaultSort('name', 'asc')
            ->paginated([25, 50, 100])
            ->defaultPaginationPageOption(25)
            ->columns([
                TextColumn::make('language.internal_name')
                    ->label('Language')
                    ->sortable()
                    ->badge()
                    ->color(fn (ItemTranslation $r): string => $r->language?->is_default ? 'success' : 'gray')
                    ->url(fn (ItemTranslation $r): ?string => $r->language
                        ? (auth()->user()?->can('view', $r->language) ? LanguageResource::getUrl('view', ['record' => $r->language]) : null)
                        : null),
                TextColumn::make('context.internal_name')
                    ->label('Context')
                    ->sortable()
                    ->badge()
                    ->color(fn (ItemTranslation $r): string => $r->context?->is_default ? 'success' : 'gray')
                    ->url(fn (ItemTranslation $r): ?string => $r->context
                        ? (auth()->user()?->can('view', $r->context) ? ContextResource::getUrl('view', ['record' => $r->context]) : null)
                        : null),
                IconColumn::make('is_default_pair')
                    ->label('★')
                    ->tooltip('Default language + context pair')
                    ->getStateUsing(fn (ItemTranslation $r): bool => (bool) ($r->language?->is_default && $r->context?->is_default))
                    ->trueIcon('heroicon-s-star')
                    ->falseIcon('heroicon-o-minus')
                    ->trueColor('warning')
                    ->falseColor('gray'),
                TextColumn::make('name')
                    ->searchable()
                    ->sortable(),
                TextColumn::make('alternate_name')
                    ->label('Alternate name')
                    ->toggleable(),
                TextColumn::make('created_at')
                    ->label('Created')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('updated_at')
                    ->label('Updated')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                SelectFilter::make('language_id')
                    ->label('Language')
                    ->relationship('language', 'internal_name')
                    ->searchable(),
                SelectFilter::make('context_id')
                    ->label('Context')
                    ->relationship('context', 'internal_name')
                    ->searchable(),
            ])
            ->headerActions([
                CreateAction::make()
                    ->fillForm(fn (): array => [
                        'language_id' => Language::default()->first()?->id,
                        'context_id' => Context::default()->first()?->id,
                    ]),
                Action::make('createDefaultTranslation')
                    ->label('Create default translation')
                    ->icon('heroicon-o-star')
                    ->color('warning')
                    ->form([
                        TranslationFormSchema::languageField(),
                        TranslationFormSchema::contextField(),
                        TranslationFormSchema::nameField(),
                        TranslationFormSchema::alternateNameField(),
                        TranslationFormSchema::descriptionField(),
                    ])
                    ->fillForm(fn (): array => [
                        'language_id' => Language::default()->first()?->id,
                        'context_id' => Context::default()->first()?->id,
                    ])
                    ->visible(fn (): bool => $this->hostRecordCanBeUpdated()
                        && (auth()->user()?->can('create', ItemTranslation::class) ?? false)
                        && ! $this->ownerItem()->translations()
                            ->whereHas('language', fn ($q) => $q->where('is_default', true))
                            ->whereHas('context', fn ($q) => $q->where('is_default', true))
                            ->exists()
                    )
                    ->action(function (array $data): void {
                        /** @var array<string, mixed> $data */
                        $exists = $this->ownerItem()->translations()
                            ->where('language_id', $data['language_id'])
                            ->where('context_id', $data['context_id'])
                            ->exists();

                        if ($exists) {
                            Notification::make()
                                ->warning()
                                ->title('Translation already exists for this language and context.')
                                ->send();

                            return;
                        }

                        $this->ownerItem()->translations()->create($data);

                        Notification::make()
                            ->success()
                            ->title('Default translation created.')
                            ->send();
                    }),
            ])
            ->actions([
                Action::make('viewTranslation')
                    ->label('View translation')
                    ->icon('heroicon-o-eye')
                    ->url(fn (ItemTranslation $r): string => ItemTranslationResource::getUrl('view', ['record' => $r])),
                Action::make('editTranslation')
                    ->label('Edit translation')
                    ->icon('heroicon-o-pencil')
                    ->url(fn (ItemTranslation $r): string => ItemTranslationResource::getUrl('edit', ['record' => $r]))
                    ->visible(fn (ItemTranslation $r): bool => $this->hostRecordCanBeUpdated()
                        && (auth()->user()?->can('update', $r) ?? false)),
                Action::make('viewParentItem')
                    ->label('View parent item')
                    ->icon('heroicon-o-arrow-top-right-on-square')
                    ->url(fn (ItemTranslation $r): string => ItemResource::getUrl('view', ['record' => $r->item_id]))
                    ->openUrlInNewTab(),
                DeleteAction::make(),
            ]);
    }

    private function ownerItem(): Item
    {
        /** @var Item $record */
        $record = $this->ownerRecord;

        return $record;
    }
}
