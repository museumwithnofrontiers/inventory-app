<?php

namespace App\Filament\Resources\PartnerResource\RelationManagers;

use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Resources\ContextResource;
use App\Filament\Resources\LanguageResource;
use App\Filament\Resources\PartnerResource;
use App\Filament\Resources\PartnerTranslationResource;
use App\Filament\Support\TranslationFormSchema;
use App\Models\Context;
use App\Models\Language;
use App\Models\Partner;
use App\Models\PartnerTranslation;
use Filament\Forms\Components\Repeater;
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
        $ownerRecord = $this->ownerPartner();

        return $form
            ->schema([
                TranslationFormSchema::languageField()
                    ->unique(
                        table: 'partner_translations',
                        column: 'language_id',
                        modifyRuleUsing: function (Unique $rule, Get $get) use ($ownerRecord): Unique {
                            return $rule->where(fn (\Illuminate\Database\Query\Builder $q) => $q
                                ->where('partner_id', $ownerRecord->id)
                                ->where('context_id', $get('context_id'))
                            );
                        },
                        ignoreRecord: true,
                    )
                    ->validationMessages(['unique' => 'A translation for this language and context already exists.']),
                TranslationFormSchema::contextField(),

                Section::make('Basic Information')
                    ->schema([
                        TextInput::make('name')
                            ->required()
                            ->maxLength(255),
                        TextInput::make('city_display')
                            ->label('City (display)')
                            ->placeholder('City name to display (may differ from actual address)')
                            ->maxLength(255),
                        Textarea::make('description')
                            ->rows(4)
                            ->columnSpanFull(),
                    ])
                    ->columns(2),

                Section::make('Address')
                    ->schema([
                        TextInput::make('address_line_1')
                            ->label('Address line 1')
                            ->placeholder('Street address')
                            ->maxLength(255),
                        TextInput::make('address_line_2')
                            ->label('Address line 2')
                            ->placeholder('Apartment, suite, etc.')
                            ->maxLength(255),
                        TextInput::make('postal_code')
                            ->label('Postal code')
                            ->placeholder('ZIP / Postal code')
                            ->maxLength(255),
                        Textarea::make('address_notes')
                            ->label('Address notes')
                            ->placeholder('Additional address information or directions')
                            ->rows(2)
                            ->columnSpanFull(),
                    ])
                    ->columns(2)
                    ->collapsible()
                    ->collapsed(),

                Section::make('Contact Information')
                    ->schema([
                        TextInput::make('contact_name')
                            ->label('Contact name')
                            ->placeholder('Primary contact person')
                            ->maxLength(255),
                        TextInput::make('contact_phone')
                            ->label('Phone')
                            ->placeholder('+1 234 567 8900')
                            ->maxLength(255),
                        TextInput::make('contact_fax')
                            ->label('Fax')
                            ->placeholder('+1 234 567 8901')
                            ->maxLength(255),
                        TextInput::make('contact_email_general')
                            ->label('General email')
                            ->email()
                            ->placeholder('general@example.com')
                            ->maxLength(255),
                        TextInput::make('contact_email_press')
                            ->label('Press email')
                            ->email()
                            ->placeholder('press@example.com')
                            ->maxLength(255),
                        TextInput::make('contact_website')
                            ->label('Website')
                            ->url()
                            ->placeholder('https://example.com')
                            ->maxLength(255),
                        Textarea::make('contact_notes')
                            ->label('Contact notes')
                            ->placeholder('Additional contact information')
                            ->rows(2)
                            ->columnSpanFull(),
                    ])
                    ->columns(2)
                    ->collapsible()
                    ->collapsed(),

                Section::make('Additional Contacts')
                    ->schema([
                        Repeater::make('contact_emails')
                            ->label('Additional email addresses')
                            ->simple(
                                TextInput::make('value')
                                    ->label('Email')
                                    ->email()
                            )
                            ->columnSpanFull(),
                        Repeater::make('contact_phones')
                            ->label('Additional phone numbers')
                            ->simple(
                                TextInput::make('value')
                                    ->label('Phone')
                                    ->maxLength(255)
                            )
                            ->columnSpanFull(),
                    ])
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
            ->recordTitleAttribute('name')
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
                    ->color(fn (PartnerTranslation $r): string => $r->language?->is_default ? 'success' : 'gray')
                    ->url(fn (PartnerTranslation $r): ?string => $r->language
                        ? (auth()->user()?->can('view', $r->language) ? LanguageResource::getUrl('view', ['record' => $r->language]) : null)
                        : null),
                TextColumn::make('context.internal_name')
                    ->label('Context')
                    ->sortable()
                    ->badge()
                    ->color(fn (PartnerTranslation $r): string => $r->context?->is_default ? 'success' : 'gray')
                    ->url(fn (PartnerTranslation $r): ?string => $r->context
                        ? (auth()->user()?->can('view', $r->context) ? ContextResource::getUrl('view', ['record' => $r->context]) : null)
                        : null),
                IconColumn::make('is_default_pair')
                    ->label('★')
                    ->tooltip('Default language + context pair')
                    ->getStateUsing(fn (PartnerTranslation $r): bool => (bool) ($r->language?->is_default && $r->context?->is_default))
                    ->trueIcon('heroicon-s-star')
                    ->falseIcon('heroicon-o-minus')
                    ->trueColor('warning')
                    ->falseColor('gray'),
                TextColumn::make('name')
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
                        TranslationFormSchema::nameField(),
                        TranslationFormSchema::descriptionField(),
                    ])
                    ->fillForm(fn (): array => [
                        'language_id' => Language::default()->first()?->id,
                        'context_id' => Context::default()->first()?->id,
                    ])
                    ->visible(fn (): bool => $this->hostRecordCanBeUpdated()
                        && (auth()->user()?->can('create', PartnerTranslation::class) ?? false)
                        && ! $this->ownerPartner()->translations()
                            ->whereHas('language', fn (Builder $q): Builder => $q->where('is_default', true))
                            ->whereHas('context', fn (Builder $q): Builder => $q->where('is_default', true))
                            ->exists()
                    )
                    ->action(function (array $data): void {
                        /** @var array<string, mixed> $data */
                        $exists = $this->ownerPartner()->translations()
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

                        $this->ownerPartner()->translations()->create($data);

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
                    ->url(fn (PartnerTranslation $r): string => PartnerTranslationResource::getUrl('view', ['record' => $r])),
                Action::make('editTranslation')
                    ->label('Edit translation')
                    ->icon('heroicon-o-pencil')
                    ->url(fn (PartnerTranslation $r): string => PartnerTranslationResource::getUrl('edit', ['record' => $r]))
                    ->visible(fn (PartnerTranslation $r): bool => $this->hostRecordCanBeUpdated()
                        && (auth()->user()?->can('update', $r) ?? false)),
                Action::make('viewParentPartner')
                    ->label('View parent partner')
                    ->icon('heroicon-o-arrow-top-right-on-square')
                    ->url(fn (PartnerTranslation $r): string => PartnerResource::getUrl('view', ['record' => $r->partner_id]))
                    ->openUrlInNewTab(),
                DeleteAction::make(),
            ]);
    }

    private function ownerPartner(): Partner
    {
        /** @var Partner $record */
        $record = $this->ownerRecord;

        return $record;
    }
}
