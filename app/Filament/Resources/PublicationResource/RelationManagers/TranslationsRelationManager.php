<?php

namespace App\Filament\Resources\PublicationResource\RelationManagers;

use App\Filament\Resources\PublicationResource;
use App\Filament\Resources\PublicationTranslationResource;
use App\Filament\Resources\RelationManagers\BaseOwnerTranslationsRelationManager;
use App\Filament\Support\TranslationFormSchema;
use App\Models\Publication;
use Filament\Forms\Components\TextInput;
use Filament\Tables\Actions\Action;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TranslationsRelationManager extends BaseOwnerTranslationsRelationManager
{
    protected static ?string $recordTitleAttribute = 'title';

    protected static function translationResource(): string
    {
        return PublicationTranslationResource::class;
    }

    protected static function titleAttribute(): string
    {
        return 'title';
    }

    protected static function ownerQueryKey(): string
    {
        return 'publication_id';
    }

    protected static function viewParentAction(): Action
    {
        return Action::make('viewParentPublication')
            ->label('View parent publication')
            ->icon('heroicon-o-arrow-top-right-on-square')
            ->url(fn (Model $r): string => PublicationResource::getUrl('view', ['record' => $r->getAttribute('publication_id')]))
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
            TextInput::make('subtitle')
                ->maxLength(255)
                ->nullable(),
        ];
    }

    protected function translationsRelation(): HasMany
    {
        return $this->ownerPublication()->translations();
    }

    private function ownerPublication(): Publication
    {
        /** @var Publication $record */
        $record = $this->ownerRecord;

        return $record;
    }
}
