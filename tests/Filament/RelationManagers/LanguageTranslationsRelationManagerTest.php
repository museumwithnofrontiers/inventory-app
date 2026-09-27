<?php

namespace Tests\Filament\RelationManagers;

use App\Filament\Resources\LanguageResource\Pages\ViewLanguage;
use App\Filament\Resources\LanguageResource\RelationManagers\TranslationsRelationManager;
use App\Models\Language;
use App\Models\LanguageTranslation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * Every mutation of a Language's translations needs `update` on the
 * Language, which LanguagePolicy grants with `manage-reference-data`.
 */
class LanguageTranslationsRelationManagerTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_view_only_user_sees_no_mutating_actions(): void
    {
        $language = Language::factory()->create();
        $translation = LanguageTranslation::factory()->create(['language_id' => $language->id]);
        $user = $this->createViewOnlyUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(TranslationsRelationManager::class, [
                'ownerRecord' => $language,
                'pageClass' => ViewLanguage::class,
            ])
            ->assertTableActionHidden('create')
            ->assertTableActionHidden('edit', $translation->getKey())
            ->assertTableActionHidden('delete', $translation->getKey());
    }

    public function test_reference_data_user_keeps_every_mutating_action(): void
    {
        $language = Language::factory()->create();
        $translation = LanguageTranslation::factory()->create(['language_id' => $language->id]);
        $user = $this->createReferenceDataUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(TranslationsRelationManager::class, [
                'ownerRecord' => $language,
                'pageClass' => ViewLanguage::class,
            ])
            ->assertTableActionVisible('create')
            ->assertTableActionVisible('edit', $translation->getKey())
            ->assertTableActionVisible('delete', $translation->getKey());
    }
}
