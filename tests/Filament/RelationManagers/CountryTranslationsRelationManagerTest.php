<?php

namespace Tests\Filament\RelationManagers;

use App\Filament\Resources\CountryResource\Pages\ViewCountry;
use App\Filament\Resources\CountryResource\RelationManagers\TranslationsRelationManager;
use App\Models\Country;
use App\Models\CountryTranslation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * Every mutation of a Country's translations needs `update` on the Country,
 * which CountryPolicy grants with `manage-reference-data`.
 */
class CountryTranslationsRelationManagerTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_view_only_user_sees_no_mutating_actions(): void
    {
        $country = Country::factory()->create();
        $translation = CountryTranslation::factory()->create(['country_id' => $country->id]);
        $user = $this->createViewOnlyUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(TranslationsRelationManager::class, [
                'ownerRecord' => $country,
                'pageClass' => ViewCountry::class,
            ])
            ->assertTableActionHidden('create')
            ->assertTableActionHidden('edit', $translation->getKey())
            ->assertTableActionHidden('delete', $translation->getKey());
    }

    public function test_reference_data_user_keeps_every_mutating_action(): void
    {
        $country = Country::factory()->create();
        $translation = CountryTranslation::factory()->create(['country_id' => $country->id]);
        $user = $this->createReferenceDataUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(TranslationsRelationManager::class, [
                'ownerRecord' => $country,
                'pageClass' => ViewCountry::class,
            ])
            ->assertTableActionVisible('create')
            ->assertTableActionVisible('edit', $translation->getKey())
            ->assertTableActionVisible('delete', $translation->getKey());
    }
}
