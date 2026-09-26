<?php

namespace App\Filament\Resources\PartnerResource\RelationManagers;

use App\Filament\Resources\PartnerResource;
use App\Filament\Resources\PartnerTranslationResource;
use App\Filament\Resources\RelationManagers\BaseOwnerTranslationsRelationManager;
use App\Filament\Support\TranslationFormSchema;
use App\Models\Partner;
use Filament\Tables\Actions\Action;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TranslationsRelationManager extends BaseOwnerTranslationsRelationManager
{
    protected static ?string $recordTitleAttribute = 'name';

    protected static function translationResource(): string
    {
        return PartnerTranslationResource::class;
    }

    protected static function titleAttribute(): string
    {
        return 'name';
    }

    protected static function ownerQueryKey(): string
    {
        return 'partner_id';
    }

    protected static function viewParentAction(): Action
    {
        return Action::make('viewParentPartner')
            ->label('View parent partner')
            ->icon('heroicon-o-arrow-top-right-on-square')
            ->url(fn (Model $r): string => PartnerResource::getUrl('view', ['record' => $r->getAttribute('partner_id')]))
            ->openUrlInNewTab();
    }

    protected static function defaultTranslationFormFields(): array
    {
        return [
            TranslationFormSchema::languageField(),
            TranslationFormSchema::contextField(),
            TranslationFormSchema::nameField(),
            TranslationFormSchema::descriptionField(),
        ];
    }

    protected function translationsRelation(): HasMany
    {
        return $this->ownerPartner()->translations();
    }

    private function ownerPartner(): Partner
    {
        /** @var Partner $record */
        $record = $this->ownerRecord;

        return $record;
    }
}
