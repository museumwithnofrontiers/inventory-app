<?php

namespace App\Filament\Resources\ItemResource\RelationManagers;

use App\Filament\Resources\ItemResource;
use App\Filament\Resources\ItemTranslationResource;
use App\Filament\Resources\RelationManagers\BaseOwnerTranslationsRelationManager;
use App\Filament\Support\MarkdownState;
use App\Filament\Support\TranslationFormSchema;
use App\Models\Item;
use Filament\Forms\Components\Toggle;
use Filament\Tables\Actions\Action;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TranslationsRelationManager extends BaseOwnerTranslationsRelationManager
{
    protected static ?string $recordTitleAttribute = 'name';

    protected static function translationResource(): string
    {
        return ItemTranslationResource::class;
    }

    protected static function titleAttribute(): string
    {
        return 'name';
    }

    protected static function ownerQueryKey(): string
    {
        return 'item_id';
    }

    protected static function viewParentAction(): Action
    {
        return Action::make('viewParentItem')
            ->label('View parent item')
            ->icon('heroicon-o-arrow-top-right-on-square')
            ->url(fn (Model $r): string => ItemResource::getUrl('view', ['record' => $r->getAttribute('item_id')]))
            ->openUrlInNewTab();
    }

    protected static function extraColumns(): array
    {
        return [
            TextColumn::make('alternate_name')
                ->formatStateUsing(MarkdownState::inline())
                ->label('Alternate name')
                ->toggleable(),
            IconColumn::make('draft')
                ->boolean(),
        ];
    }

    protected static function defaultTranslationFormFields(): array
    {
        return [
            TranslationFormSchema::languageField(),
            TranslationFormSchema::contextField(),
            TranslationFormSchema::nameField(),
            TranslationFormSchema::alternateNameField(),
            TranslationFormSchema::descriptionField(),
            // M17 (#2741): a new text starts as a draft.
            Toggle::make('draft')
                ->helperText('Not ready for the sites: no site shows this text.')
                ->default(true),
        ];
    }

    protected static function defaultTranslationFormState(): array
    {
        return ['draft' => true];
    }

    protected function translationsRelation(): HasMany
    {
        return $this->ownerItem()->translations();
    }

    private function ownerItem(): Item
    {
        /** @var Item $record */
        $record = $this->ownerRecord;

        return $record;
    }
}
