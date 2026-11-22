<?php

namespace App\Filament\Resources;

use App\Filament\Concerns\HasBackwardCompatibilityColumn;
use App\Filament\Concerns\HasInternalNameColumn;
use App\Filament\Concerns\HasTimestampsColumns;
use App\Filament\Concerns\HasUuidColumn;
use App\Filament\Resources\LanguageResource\Pages\CreateLanguage;
use App\Filament\Resources\LanguageResource\Pages\EditLanguage;
use App\Filament\Resources\LanguageResource\Pages\ListLanguage;
use App\Filament\Resources\LanguageResource\Pages\ViewLanguage;
use App\Filament\Resources\LanguageResource\RelationManagers\TranslationsRelationManager;
use App\Models\Language;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Form;
use Filament\Infolists\Components\IconEntry;
use Filament\Infolists\Components\Section as InfolistSection;
use Filament\Infolists\Components\TextEntry;
use Filament\Infolists\Infolist;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Tables\Actions\BulkAction;
use Filament\Tables\Actions\DeleteAction;
use Filament\Tables\Actions\EditAction;
use Filament\Tables\Actions\ViewAction;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Filters\TernaryFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

class LanguageResource extends Resource
{
    use HasBackwardCompatibilityColumn;
    use HasInternalNameColumn;
    use HasTimestampsColumns;
    use HasUuidColumn;

    protected static ?string $model = Language::class;

    protected static ?string $navigationIcon = 'heroicon-o-language';

    protected static ?string $navigationGroup = 'Reference Data';

    protected static ?int $navigationSort = 1;

    protected static ?string $recordTitleAttribute = 'internal_name';

    public static function getGloballySearchableAttributes(): array
    {
        return ['id', 'internal_name', 'backward_compatibility'];
    }

    public static function canViewAny(): bool
    {
        return auth()->user()?->can('viewAny', static::getModel()) ?? false;
    }

    public static function shouldRegisterNavigation(): bool
    {
        return static::canViewAny();
    }

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                TextInput::make('id')
                    ->label('ISO code')
                    ->length(3)
                    ->required()
                    ->unique(ignoreRecord: true)
                    ->disabled(fn (?Language $record): bool => $record !== null)
                    ->dehydrated(fn (?Language $record): bool => $record === null),
                TextInput::make('internal_name')
                    ->required()
                    ->maxLength(255),
                TextInput::make('backward_compatibility')
                    ->label('Legacy code')
                    ->maxLength(2),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->recordUrl(fn ($record): ?string => auth()->user()?->can('view', $record) ? static::getUrl('view', ['record' => $record]) : null)
            ->defaultSort('internal_name', 'asc')
            ->columns([
                static::internalNameColumn()
                    ->searchable(['internal_name', 'id']),
                static::backwardCompatibilityColumn(),
                IconColumn::make('is_default')
                    ->label('Default')
                    ->boolean()
                    ->sortable(),
                static::uuidColumn()
                    ->label('ISO code')
                    ->searchable()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: false),
                ...static::timestampsColumns(),
            ])
            ->filters([
                TernaryFilter::make('is_default')
                    ->label('Default')
                    ->queries(
                        true: fn (Builder $query): Builder => $query->where('is_default', true),
                        false: fn (Builder $query): Builder => $query->where('is_default', false),
                        blank: fn (Builder $query): Builder => $query,
                    ),
            ])
            ->actions([
                ViewAction::make(),
                EditAction::make(),
                DeleteAction::make(),
            ])
            ->bulkActions([
                BulkAction::make('setDefault')
                    ->label('Set as default')
                    ->requiresConfirmation()
                    ->deselectRecordsAfterCompletion()
                    ->action(function (Collection $records): void {
                        if ($records->count() !== 1) {
                            Notification::make()
                                ->warning()
                                ->title('Select exactly one language')
                                ->body('The Set as default action can only be applied to a single language.')
                                ->send();

                            return;
                        }

                        /** @var Language $language */
                        $language = $records->first();
                        $language->setDefault();

                        Notification::make()
                            ->success()
                            ->title('Default language updated')
                            ->send();
                    }),
            ]);
    }

    public static function infolist(Infolist $infolist): Infolist
    {
        return $infolist
            ->inlineLabel()
            ->schema([
                InfolistSection::make('Core Information')
                    ->schema([
                        TextEntry::make('id')
                            ->label('ISO code'),
                        TextEntry::make('internal_name'),
                        IconEntry::make('is_default')
                            ->label('Default')
                            ->boolean(),
                    ])
                    ->columns(2),
                InfolistSection::make('System Information')
                    ->schema([
                        TextEntry::make('backward_compatibility')
                            ->label('Legacy code'),
                        ...static::timestampsInfolistEntries(),
                    ])
                    ->columns(2)
                    ->collapsible()
                    ->collapsed(),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => ListLanguage::route('/'),
            'create' => CreateLanguage::route('/create'),
            'edit' => EditLanguage::route('/{record}/edit'),
            'view' => ViewLanguage::route('/{record}'),
        ];
    }

    public static function getRelations(): array
    {
        return [
            TranslationsRelationManager::class,
        ];
    }
}
