<?php

namespace Tests\Filament\RelationManagers;

use App\Filament\Resources\GlossaryResource\Pages\ViewGlossary;
use App\Filament\Resources\GlossaryResource\RelationManagers\SpellingsRelationManager;
use App\Filament\Resources\GlossaryResource\RelationManagers\TranslationsRelationManager;
use App\Models\Glossary;
use App\Models\GlossarySpelling;
use App\Models\GlossaryTranslation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * Every mutation of a Glossary entry's translations and spellings needs
 * `update` on the Glossary entry, which GlossaryPolicy grants with
 * `manage-reference-data`.
 */
class GlossaryTranslationsSpellingsRelationManagerTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_view_only_user_sees_no_mutating_translation_actions(): void
    {
        $glossary = Glossary::factory()->create();
        $translation = GlossaryTranslation::factory()->create(['glossary_id' => $glossary->id]);
        $user = $this->createViewOnlyUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(TranslationsRelationManager::class, [
                'ownerRecord' => $glossary,
                'pageClass' => ViewGlossary::class,
            ])
            ->assertTableActionHidden('create')
            ->assertTableActionHidden('edit', $translation->getKey())
            ->assertTableActionHidden('delete', $translation->getKey());
    }

    public function test_reference_data_user_keeps_every_mutating_translation_action(): void
    {
        $glossary = Glossary::factory()->create();
        $translation = GlossaryTranslation::factory()->create(['glossary_id' => $glossary->id]);
        $user = $this->createReferenceDataUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(TranslationsRelationManager::class, [
                'ownerRecord' => $glossary,
                'pageClass' => ViewGlossary::class,
            ])
            ->assertTableActionVisible('create')
            ->assertTableActionVisible('edit', $translation->getKey())
            ->assertTableActionVisible('delete', $translation->getKey());
    }

    public function test_view_only_user_sees_no_mutating_spelling_actions(): void
    {
        $glossary = Glossary::factory()->create();
        $spelling = GlossarySpelling::factory()->create(['glossary_id' => $glossary->id]);
        $user = $this->createViewOnlyUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(SpellingsRelationManager::class, [
                'ownerRecord' => $glossary,
                'pageClass' => ViewGlossary::class,
            ])
            ->assertTableActionHidden('create')
            ->assertTableActionHidden('edit', $spelling->getKey())
            ->assertTableActionHidden('delete', $spelling->getKey());
    }

    public function test_reference_data_user_keeps_every_mutating_spelling_action(): void
    {
        $glossary = Glossary::factory()->create();
        $spelling = GlossarySpelling::factory()->create(['glossary_id' => $glossary->id]);
        $user = $this->createReferenceDataUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(SpellingsRelationManager::class, [
                'ownerRecord' => $glossary,
                'pageClass' => ViewGlossary::class,
            ])
            ->assertTableActionVisible('create')
            ->assertTableActionVisible('edit', $spelling->getKey())
            ->assertTableActionVisible('delete', $spelling->getKey());
    }
}
