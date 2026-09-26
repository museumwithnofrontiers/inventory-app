<?php

namespace Tests\Filament\Resources;

use App\Filament\Resources\GlossaryResource\Pages\CreateGlossary;
use App\Filament\Resources\GlossaryResource\Pages\EditGlossary;
use App\Filament\Resources\GlossaryResource\Pages\ListGlossary;
use App\Filament\Resources\GlossaryResource\RelationManagers\SpellingsRelationManager;
use App\Filament\Resources\GlossaryResource\RelationManagers\TranslationsRelationManager;
use App\Models\Glossary;
use App\Models\Language;
use Filament\Tables\Actions\DeleteAction;
use Filament\Tables\Actions\EditAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

class GlossaryResourceTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_authorized_users_can_render_all_glossary_resource_pages(): void
    {
        $user = $this->createReferenceDataUser();
        $glossary = Glossary::factory()->create(['internal_name' => 'Mashrabiya']);

        $this->actingAs($user)->get('/admin/glossaries')
            ->assertOk()
            ->assertSee('Glossaries');

        $this->actingAs($user)->get('/admin/glossaries/create')
            ->assertOk()
            ->assertSee('Create');

        $this->actingAs($user)->get("/admin/glossaries/{$glossary->getKey()}/edit")
            ->assertOk()
            ->assertSee('Mashrabiya')
            ->assertSee('Translations')
            ->assertSee('Spellings');

        $this->actingAs($user)->get("/admin/glossaries/{$glossary->getKey()}")
            ->assertOk()
            ->assertSee('Mashrabiya');
    }

    public function test_authorized_users_can_create_edit_and_delete_glossaries(): void
    {
        $user = $this->createReferenceDataUser();
        $glossary = Glossary::factory()->create([
            'internal_name' => 'Mashrabiya',
            'backward_compatibility' => 'g-01',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CreateGlossary::class)
            ->fillForm([
                'internal_name' => 'Iwan',
                'backward_compatibility' => 'g-02',
            ])
            ->call('create')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('glossaries', [
            'internal_name' => 'Iwan',
            'backward_compatibility' => 'g-02',
        ]);

        Livewire::actingAs($user)
            ->test(EditGlossary::class, [
                'record' => $glossary->getRouteKey(),
            ])
            ->assertFormSet([
                'internal_name' => 'Mashrabiya',
                'backward_compatibility' => 'g-01',
            ])
            ->fillForm([
                'internal_name' => 'Wooden mashrabiya',
                'backward_compatibility' => 'g-11',
            ])
            ->call('save')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('glossaries', [
            'id' => $glossary->id,
            'internal_name' => 'Wooden mashrabiya',
            'backward_compatibility' => 'g-11',
        ]);

        Livewire::actingAs($user)
            ->test(ListGlossary::class)
            ->callTableAction(DeleteAction::class, $glossary)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('glossaries', [
            'id' => $glossary->id,
        ]);
    }

    public function test_glossary_relation_managers_allow_editing_translations_and_spellings(): void
    {
        $user = $this->createReferenceDataUser();
        $glossary = Glossary::factory()->create(['internal_name' => 'Mashrabiya']);
        $english = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);
        $arabic = Language::factory()->create(['id' => 'ara', 'internal_name' => 'Arabic']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(TranslationsRelationManager::class, [
                'ownerRecord' => $glossary,
                'pageClass' => EditGlossary::class,
            ])
            ->mountTableAction('create')
            ->setTableActionData([
                'language_id' => $english->id,
                'definition' => 'A projecting oriel window enclosed with carved wood latticework.',
            ])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $translation = $glossary->translations()->firstOrFail();

        Livewire::actingAs($user)
            ->test(TranslationsRelationManager::class, [
                'ownerRecord' => $glossary,
                'pageClass' => EditGlossary::class,
            ])
            ->assertCanSeeTableRecords([$translation])
            ->mountTableAction(EditAction::class, $translation)
            ->setTableActionData([
                'language_id' => $english->id,
                'definition' => 'A screened projecting window with carved wooden latticework.',
            ])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('glossary_translations', [
            'id' => $translation->id,
            'definition' => 'A screened projecting window with carved wooden latticework.',
        ]);

        Livewire::actingAs($user)
            ->test(SpellingsRelationManager::class, [
                'ownerRecord' => $glossary,
                'pageClass' => EditGlossary::class,
            ])
            ->mountTableAction('create')
            ->setTableActionData([
                'language_id' => $arabic->id,
                'spelling' => 'مشربية',
            ])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $spelling = $glossary->spellings()->firstOrFail();

        Livewire::actingAs($user)
            ->test(SpellingsRelationManager::class, [
                'ownerRecord' => $glossary,
                'pageClass' => EditGlossary::class,
            ])
            ->assertCanSeeTableRecords([$spelling])
            ->mountTableAction(EditAction::class, $spelling)
            ->setTableActionData([
                'language_id' => $arabic->id,
                'spelling' => 'المشربية',
            ])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('glossary_spellings', [
            'id' => $spelling->id,
            'spelling' => 'المشربية',
        ]);

        $translation = $translation->fresh();

        Livewire::actingAs($user)
            ->test(TranslationsRelationManager::class, [
                'ownerRecord' => $glossary,
                'pageClass' => EditGlossary::class,
            ])
            ->callTableAction(DeleteAction::class, $translation)
            ->assertHasNoTableActionErrors();

        Livewire::actingAs($user)
            ->test(SpellingsRelationManager::class, [
                'ownerRecord' => $glossary,
                'pageClass' => EditGlossary::class,
            ])
            ->callTableAction(DeleteAction::class, $spelling)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('glossary_translations', [
            'id' => $translation->id,
        ]);
        $this->assertDatabaseMissing('glossary_spellings', [
            'id' => $spelling->id,
        ]);
    }
}
