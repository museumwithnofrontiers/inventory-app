<?php

namespace Tests\Filament\RelationManagers;

use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Resources\GlossaryResource\Pages\EditGlossary;
use App\Filament\Resources\GlossaryResource\RelationManagers\SpellingsRelationManager;
use App\Filament\Resources\GlossaryResource\RelationManagers\TranslationsRelationManager;
use App\Models\Glossary;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

class GlossaryTranslationsSpellingsRelationManagerTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_glossary_translations_relation_manager_uses_authorizes_relation_mutations(): void
    {
        $this->assertTrue(
            in_array(AuthorizesRelationMutations::class, class_uses_recursive(TranslationsRelationManager::class), true),
            'TranslationsRelationManager must use AuthorizesRelationMutations trait.'
        );
    }

    public function test_glossary_spellings_relation_manager_uses_authorizes_relation_mutations(): void
    {
        $this->assertTrue(
            in_array(AuthorizesRelationMutations::class, class_uses_recursive(SpellingsRelationManager::class), true),
            'SpellingsRelationManager must use AuthorizesRelationMutations trait.'
        );
    }

    public function test_translations_manager_renders_for_reference_data_user(): void
    {
        $user = $this->createReferenceDataUser();
        $glossary = Glossary::factory()->create();

        $this->setCurrentPanel();

        $component = Livewire::actingAs($user)->test(TranslationsRelationManager::class, [
            'ownerRecord' => $glossary,
            'pageClass' => EditGlossary::class,
        ]);

        $component->assertSuccessful();
    }

    public function test_translations_manager_renders_for_view_only_user(): void
    {
        $user = $this->createViewOnlyUser();
        $glossary = Glossary::factory()->create();

        $this->setCurrentPanel();

        $component = Livewire::actingAs($user)->test(TranslationsRelationManager::class, [
            'ownerRecord' => $glossary,
            'pageClass' => EditGlossary::class,
        ]);

        $component->assertSuccessful();
    }

    public function test_spellings_manager_renders_for_reference_data_user(): void
    {
        $user = $this->createReferenceDataUser();
        $glossary = Glossary::factory()->create();

        $this->setCurrentPanel();

        $component = Livewire::actingAs($user)->test(SpellingsRelationManager::class, [
            'ownerRecord' => $glossary,
            'pageClass' => EditGlossary::class,
        ]);

        $component->assertSuccessful();
    }

    public function test_spellings_manager_renders_for_view_only_user(): void
    {
        $user = $this->createViewOnlyUser();
        $glossary = Glossary::factory()->create();

        $this->setCurrentPanel();

        $component = Livewire::actingAs($user)->test(SpellingsRelationManager::class, [
            'ownerRecord' => $glossary,
            'pageClass' => EditGlossary::class,
        ]);

        $component->assertSuccessful();
    }
}
