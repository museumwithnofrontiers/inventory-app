<?php

namespace Tests\Filament\RelationManagers;

use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Resources\CountryResource\Pages\EditCountry;
use App\Filament\Resources\CountryResource\RelationManagers\TranslationsRelationManager;
use App\Models\Country;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

class CountryTranslationsRelationManagerTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_country_translations_relation_manager_uses_authorizes_relation_mutations(): void
    {
        $this->assertTrue(
            in_array(AuthorizesRelationMutations::class, class_uses_recursive(TranslationsRelationManager::class), true),
            'TranslationsRelationManager must use AuthorizesRelationMutations trait.'
        );
    }

    public function test_manager_renders_for_reference_data_user(): void
    {
        $user = $this->createReferenceDataUser();
        $country = Country::factory()->create();

        $this->setCurrentPanel();

        $component = Livewire::actingAs($user)->test(TranslationsRelationManager::class, [
            'ownerRecord' => $country,
            'pageClass' => EditCountry::class,
        ]);

        $component->assertSuccessful();
    }

    public function test_manager_renders_for_view_only_user(): void
    {
        $user = $this->createViewOnlyUser();
        $country = Country::factory()->create();

        $this->setCurrentPanel();

        $component = Livewire::actingAs($user)->test(TranslationsRelationManager::class, [
            'ownerRecord' => $country,
            'pageClass' => EditCountry::class,
        ]);

        $component->assertSuccessful();
    }
}
