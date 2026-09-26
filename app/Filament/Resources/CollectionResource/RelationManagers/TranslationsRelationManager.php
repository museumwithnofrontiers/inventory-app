<?php

namespace App\Filament\Resources\CollectionResource\RelationManagers;

use App\Filament\Resources\CollectionResource;
use App\Filament\Resources\CollectionTranslationResource;
use App\Filament\Resources\RelationManagers\BaseOwnerTranslationsRelationManager;
use App\Filament\Support\TranslationFormSchema;
use App\Models\Collection;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Tables\Actions\Action;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TranslationsRelationManager extends BaseOwnerTranslationsRelationManager
{
    protected static ?string $recordTitleAttribute = 'title';

    protected static function translationResource(): string
    {
        return CollectionTranslationResource::class;
    }

    protected static function titleAttribute(): string
    {
        return 'title';
    }

    protected static function ownerQueryKey(): string
    {
        return 'collection_id';
    }

    protected static function viewParentAction(): Action
    {
        return Action::make('viewParentCollection')
            ->label('View parent collection')
            ->icon('heroicon-o-arrow-top-right-on-square')
            ->url(fn (Model $r): string => CollectionResource::getUrl('view', ['record' => $r->getAttribute('collection_id')]))
            ->openUrlInNewTab();
    }

    protected static function defaultTranslationFormFields(): array
    {
        return [
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
        ];
    }

    protected function translationsRelation(): HasMany
    {
        return $this->ownerCollection()->translations();
    }

    private function ownerCollection(): Collection
    {
        /** @var Collection $record */
        $record = $this->ownerRecord;

        return $record;
    }
}
