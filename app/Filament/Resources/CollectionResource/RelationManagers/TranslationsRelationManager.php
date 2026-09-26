<?php

namespace App\Filament\Resources\CollectionResource\RelationManagers;

use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Resources\CollectionResource;
use App\Filament\Resources\CollectionTranslationResource;
use App\Filament\Resources\ContextResource;
use App\Filament\Resources\LanguageResource;
use App\Filament\Support\TranslationFormSchema;
use App\Models\Collection;
use App\Models\CollectionTranslation;
use App\Models\Context;
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

    protected static ?string $recordTitleAttribute = 'title';

    protected static ?string $title = 'Translations';

    public function form(Form $form): Form
    {
        $ownerRecord = $this->ownerCollection();

        return $form
            ->schema([
                TranslationFormSchema::languageField()
                    ->unique(
                        table: 'collection_translations',
                        column: 'language_id',
                        modifyRuleUsing: function (Unique $rule, Get $get) use ($ownerRecord): Unique {
                            return $rule->where(fn (\Illuminate\Database\Query\Builder $q) => $q
                                ->where('collection_id', $ownerRecord->id)
                                ->where('context_id', $get('context_id'))
                            );
                        },
                        ignoreRecord: true,
                    )
                    ->validationMessages(['unique' => 'A translation for this language and context already exists.']),
                TranslationFormSchema::contextField(),

                Section::make('Content')
                    ->schema([
                        TextInput::make('title')
                            ->required()
                            ->maxLength(255),
                        TextInput::make('url')
                            ->url()
                            ->nullable()
                            ->maxLength(255),
                        Textarea::make('description')
                            ->rows(4)
                            ->columnSpanFull(),
                        Textarea::make('quote')
                            ->placeholder('A representative quote or excerpt')
                            ->rows(3)
                            ->columnSpanFull(),
                    ])
                    ->columns(2),

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
            ->defaultSort('title', 'asc')
            ->paginated([25, 50, 100])
            ->defaultPaginationPageOption(25)
            ->columns([
                TextColumn::make('language.internal_name')
                    ->label('Language')
                    ->sortable()
                    ->badge()
                    ->color(fn (CollectionTranslation $r): string => $r->language?->is_default ? 'success' : 'gray')
                    ->url(fn (CollectionTranslation $r): ?string => $r->language
                        ? (auth()->user()?->can('view', $r->language) ? LanguageResource::getUrl('view', ['record' => $r->language]) : null)
                        : null),
                TextColumn::make('context.internal_name')
                    ->label('Context')
                    ->sortable()
                    ->badge()
                    ->color(fn (CollectionTranslation $r): string => $r->context?->is_default ? 'success' : 'gray')
                    ->url(fn (CollectionTranslation $r): ?string => $r->context
                        ? (auth()->user()?->can('view', $r->context) ? ContextResource::getUrl('view', ['record' => $r->context]) : null)
                        : null),
                IconColumn::make('is_default_pair')
                    ->label('★')
                    ->tooltip('Default language + context pair')
                    ->getStateUsing(fn (CollectionTranslation $r): bool => (bool) ($r->language?->is_default && $r->context?->is_default))
                    ->trueIcon('heroicon-s-star')
                    ->falseIcon('heroicon-o-minus')
                    ->trueColor('warning')
                    ->falseColor('gray'),
                TextColumn::make('title')
                    ->searchable()
                    ->sortable(),
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
                        TextInput::make('title')
                            ->required()
                            ->maxLength(255),
                        Textarea::make('description')
                            ->rows(4)
                            ->columnSpanFull(),
                        TextInput::make('url')
                            ->url()
                            ->nullable()
                            ->maxLength(255),
                    ])
                    ->fillForm(fn (): array => [
                        'language_id' => Language::default()->first()?->id,
                        'context_id' => Context::default()->first()?->id,
                    ])
                    ->visible(fn (): bool => $this->hostRecordCanBeUpdated()
                        && (auth()->user()?->can('create', CollectionTranslation::class) ?? false)
                        && ! $this->ownerCollection()->translations()
                            ->whereHas('language', fn ($q) => $q->where('is_default', true))
                            ->whereHas('context', fn ($q) => $q->where('is_default', true))
                            ->exists()
                    )
                    ->action(function (array $data): void {
                        /** @var array<string, mixed> $data */
                        $exists = $this->ownerCollection()->translations()
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

                        $this->ownerCollection()->translations()->create($data);

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
                    ->url(fn (CollectionTranslation $r): string => CollectionTranslationResource::getUrl('view', ['record' => $r])),
                Action::make('editTranslation')
                    ->label('Edit translation')
                    ->icon('heroicon-o-pencil')
                    ->url(fn (CollectionTranslation $r): string => CollectionTranslationResource::getUrl('edit', ['record' => $r]))
                    ->visible(fn (CollectionTranslation $r): bool => $this->hostRecordCanBeUpdated()
                        && (auth()->user()?->can('update', $r) ?? false)),
                Action::make('viewParentCollection')
                    ->label('View parent collection')
                    ->icon('heroicon-o-arrow-top-right-on-square')
                    ->url(fn (CollectionTranslation $r): string => CollectionResource::getUrl('view', ['record' => $r->collection_id]))
                    ->openUrlInNewTab(),
                DeleteAction::make(),
            ]);
    }

    private function ownerCollection(): Collection
    {
        /** @var Collection $record */
        $record = $this->ownerRecord;

        return $record;
    }
}
