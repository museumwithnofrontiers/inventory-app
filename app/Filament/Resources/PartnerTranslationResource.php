<?php

namespace App\Filament\Resources;

use App\Enums\Permission;
use App\Filament\Concerns\HasTimestampsColumns;
use App\Filament\Resources\PartnerTranslationResource\Pages\CreatePartnerTranslation;
use App\Filament\Resources\PartnerTranslationResource\Pages\EditPartnerTranslation;
use App\Filament\Resources\PartnerTranslationResource\Pages\ListPartnerTranslation;
use App\Filament\Resources\PartnerTranslationResource\Pages\ViewPartnerTranslation;
use App\Filament\Resources\PartnerTranslationResource\RelationManagers\ImagesRelationManager;
use App\Filament\Resources\PartnerTranslationResource\RelationManagers\SiblingTranslationsRelationManager;
use App\Filament\Support\TranslationFormSchema;
use App\Filament\Support\TranslationInfolistSchema;
use App\Models\PartnerTranslation;
use Filament\Forms\Components\Repeater;
use Filament\Forms\Components\Section;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Form;
use Filament\Forms\Get;
use Filament\Infolists\Components\Section as InfolistSection;
use Filament\Infolists\Components\TextEntry;
use Filament\Infolists\Infolist;
use Filament\Resources\Resource;
use Filament\Tables\Actions\Action;
use Filament\Tables\Actions\DeleteAction;
use Filament\Tables\Actions\EditAction;
use Filament\Tables\Actions\ViewAction;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\Filter;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\Rules\Unique;

class PartnerTranslationResource extends Resource
{
    use HasTimestampsColumns;

    protected static ?string $model = PartnerTranslation::class;

    protected static ?string $navigationIcon = 'heroicon-o-language';

    protected static ?string $navigationGroup = 'Translations';

    protected static ?string $navigationLabel = 'Partner Translations';

    protected static ?int $navigationSort = 3;

    protected static ?string $recordTitleAttribute = 'name';

    public static function canViewAny(): bool
    {
        return auth()->user()?->hasPermissionTo(Permission::VIEW_DATA->value) ?? false;
    }

    public static function shouldRegisterNavigation(): bool
    {
        return static::canViewAny();
    }

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                TranslationFormSchema::partnerSelectField(includeIdInSearch: true),
                Select::make('language_id')
                    ->label('Language')
                    ->relationship('language', 'internal_name')
                    ->searchable()
                    ->required()
                    ->unique(
                        table: 'partner_translations',
                        column: 'language_id',
                        modifyRuleUsing: fn (Unique $rule, Get $get, ?PartnerTranslation $record): Unique => $rule
                            ->where(fn (\Illuminate\Database\Query\Builder $q) => $q
                                ->where('partner_id', $get('partner_id'))
                                ->where('context_id', $get('context_id'))
                            )
                            ->ignore($record?->id),
                        ignoreRecord: true,
                    )
                    ->validationMessages(['unique' => 'A translation for this partner, language and context already exists.']),
                Select::make('context_id')
                    ->label('Context')
                    ->relationship('context', 'internal_name')
                    ->searchable()
                    ->required(),

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

    public static function infolist(Infolist $infolist): Infolist
    {
        return $infolist
            ->inlineLabel()
            ->schema([
                InfolistSection::make('Translation For')
                    ->schema([
                        TextEntry::make('partner.internal_name')
                            ->label('Partner')
                            ->url(fn (PartnerTranslation $record): ?string => $record->partner
                                ? (auth()->user()?->can('view', $record->partner) ? PartnerResource::getUrl('view', ['record' => $record->partner]) : null)
                                : null),
                        TextEntry::make('language.internal_name')
                            ->label('Language')
                            ->url(fn (PartnerTranslation $record): ?string => $record->language
                                ? (auth()->user()?->can('view', $record->language) ? LanguageResource::getUrl('view', ['record' => $record->language]) : null)
                                : null),
                        TextEntry::make('context.internal_name')
                            ->label('Context')
                            ->url(fn (PartnerTranslation $record): ?string => $record->context
                                ? (auth()->user()?->can('view', $record->context) ? ContextResource::getUrl('view', ['record' => $record->context]) : null)
                                : null),
                    ])
                    ->columns(2),

                InfolistSection::make('Basic Information')
                    ->schema([
                        TranslationInfolistSchema::rtlTextEntry('name'),
                        TranslationInfolistSchema::rtlTextEntry('city_display', 'City (display)'),
                        TranslationInfolistSchema::markdownEntry('description', columnSpanFull: true),
                    ])
                    ->columns(2),

                InfolistSection::make('Address')
                    ->schema([
                        TranslationInfolistSchema::rtlTextEntry('address_line_1', 'Address line 1'),
                        TranslationInfolistSchema::rtlTextEntry('address_line_2', 'Address line 2'),
                        TranslationInfolistSchema::rtlTextEntry('postal_code', 'Postal code'),
                        TranslationInfolistSchema::rtlTextEntry('address_notes', 'Address notes')->columnSpanFull(),
                    ])
                    ->columns(2)
                    ->collapsible()
                    ->collapsed(),

                InfolistSection::make('Contact Information')
                    ->schema([
                        TranslationInfolistSchema::rtlTextEntry('contact_name', 'Contact name'),
                        TextEntry::make('contact_phone')->label('Phone'),
                        TextEntry::make('contact_fax')->label('Fax'),
                        TextEntry::make('contact_email_general')->label('General email'),
                        TextEntry::make('contact_email_press')->label('Press email'),
                        TextEntry::make('contact_website')->label('Website'),
                        TranslationInfolistSchema::rtlTextEntry('contact_notes', 'Contact notes')->columnSpanFull(),
                    ])
                    ->columns(2)
                    ->collapsible()
                    ->collapsed(),

                InfolistSection::make('Extra Data')
                    ->schema([
                        TranslationInfolistSchema::extraEntry(),
                    ])
                    ->collapsible()
                    ->collapsed(),

                InfolistSection::make('System Information')
                    ->schema([
                        TextEntry::make('id')->label('UUID')->copyable(),
                        TextEntry::make('backward_compatibility')->label('Legacy code'),
                        ...static::timestampsInfolistEntries(),
                    ])
                    ->columns(2)
                    ->collapsible()
                    ->collapsed(),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->recordUrl(fn (PartnerTranslation $record): ?string => auth()->user()?->can('view', $record) ? static::getUrl('view', ['record' => $record]) : null)
            ->modifyQueryUsing(fn (Builder $query): Builder => $query->with([
                'partner:id,internal_name',
                'language:id,internal_name,is_default',
                'context:id,internal_name,is_default',
            ]))
            ->columns([
                TextColumn::make('partner.internal_name')
                    ->label('Partner')
                    ->sortable()
                    ->searchable(query: fn (Builder $query, string $search): Builder => $query
                        ->orWhereHas('partner', fn (Builder $q): Builder => $q
                            ->where('internal_name', 'like', "%{$search}%")
                            ->orWhere('id', 'like', "%{$search}%")
                            ->orWhere('backward_compatibility', 'like', "%{$search}%")
                        )
                    ),
                TextColumn::make('language.internal_name')
                    ->label('Language')
                    ->sortable()
                    ->badge()
                    ->color(fn (PartnerTranslation $r): string => $r->language?->is_default ? 'success' : 'gray')
                    ->searchable(query: fn (Builder $query, string $search): Builder => $query
                        ->orWhereHas('language', fn (Builder $q): Builder => $q
                            ->where('internal_name', 'like', "%{$search}%")
                            ->orWhere('id', 'like', "%{$search}%")
                        )
                    ),
                TextColumn::make('context.internal_name')
                    ->label('Context')
                    ->sortable()
                    ->badge()
                    ->color(fn (PartnerTranslation $r): string => $r->context?->is_default ? 'success' : 'gray')
                    ->searchable(query: fn (Builder $query, string $search): Builder => $query
                        ->orWhereHas('context', fn (Builder $q): Builder => $q
                            ->where('internal_name', 'like', "%{$search}%")
                            ->orWhere('id', 'like', "%{$search}%")
                        )
                    ),
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
                TextColumn::make('backward_compatibility')
                    ->label('Legacy ID')
                    ->searchable()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('id')
                    ->label('UUID')
                    ->searchable()
                    ->toggleable(isToggledHiddenByDefault: true),
                ...static::timestampsColumns(),
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
                Filter::make('default_language')
                    ->label('Default language only')
                    ->query(fn (Builder $query): Builder => $query->whereHas('language', fn (Builder $q): Builder => $q->where('is_default', true))),
                Filter::make('default_context')
                    ->label('Default context only')
                    ->query(fn (Builder $query): Builder => $query->whereHas('context', fn (Builder $q): Builder => $q->where('is_default', true))),
                Filter::make('is_default_pair')
                    ->label('Default pair only')
                    ->query(fn (Builder $query): Builder => $query
                        ->whereHas('language', fn (Builder $q): Builder => $q->where('is_default', true))
                        ->whereHas('context', fn (Builder $q): Builder => $q->where('is_default', true))
                    ),
                Filter::make('missing_fallback')
                    ->label('Owner missing default translation')
                    ->query(fn (Builder $query): Builder => $query->whereHas('partner', fn (Builder $pq): Builder => $pq->whereDoesntHave('translations', fn (Builder $tq): Builder => $tq
                        ->whereHas('language', fn (Builder $lq): Builder => $lq->where('is_default', true))
                        ->whereHas('context', fn (Builder $dq): Builder => $dq->where('is_default', true))
                    ))),
                Filter::make('recently_updated')
                    ->label('Recently updated (30 days)')
                    ->query(fn (Builder $query): Builder => $query->where('updated_at', '>=', now()->subDays(30))),
            ])
            ->actions([
                ViewAction::make(),
                Action::make('viewPartner')
                    ->label('View partner')
                    ->icon('heroicon-o-arrow-top-right-on-square')
                    ->url(fn (PartnerTranslation $r): string => PartnerResource::getUrl('view', ['record' => $r->partner_id]))
                    ->openUrlInNewTab(),
                EditAction::make(),
                DeleteAction::make(),
            ]);
    }

    public static function getRelations(): array
    {
        return [
            ImagesRelationManager::class,
            SiblingTranslationsRelationManager::class,
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => ListPartnerTranslation::route('/'),
            'create' => CreatePartnerTranslation::route('/create'),
            'edit' => EditPartnerTranslation::route('/{record}/edit'),
            'view' => ViewPartnerTranslation::route('/{record}'),
        ];
    }
}
