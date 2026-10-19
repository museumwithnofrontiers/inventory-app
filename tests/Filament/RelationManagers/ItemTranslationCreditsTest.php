<?php

namespace Tests\Filament\RelationManagers;

use App\Enums\CreditRole;
use App\Enums\Permission;
use App\Filament\Resources\ItemTranslationResource\Pages\ViewItemTranslation;
use App\Filament\Resources\ItemTranslationResource\RelationManagers\AuthorCreditsRelationManager;
use App\Filament\Resources\ItemTranslationResource\RelationManagers\TranslatorCreditsRelationManager;
use App\Models\Author;
use App\Models\ItemTranslation;
use App\Models\User;
use Filament\Tables\Actions\DetachAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * The per-role credit managers on an item translation: attach sets the
 * manager's role, edit and detach touch that role's row only.
 */
class ItemTranslationCreditsTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_crud_user_attaches_edits_and_detaches_a_credit_in_one_role(): void
    {
        $translation = ItemTranslation::factory()->create();
        $author = Author::factory()->create();
        $translation->authorCredits()->attach($author->id, ['display_order' => 0]);
        $user = $this->createCreditsEditor();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(TranslatorCreditsRelationManager::class, [
                'ownerRecord' => $translation,
                'pageClass' => ViewItemTranslation::class,
            ])
            ->mountTableAction('attach')
            ->setTableActionData([
                'recordId' => $author->id,
                'display_order' => 1,
            ])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('item_translation_author', [
            'item_translation_id' => $translation->id,
            'author_id' => $author->id,
            'role' => CreditRole::TRANSLATOR->value,
            'display_order' => 1,
        ]);

        Livewire::actingAs($user)
            ->test(TranslatorCreditsRelationManager::class, [
                'ownerRecord' => $translation,
                'pageClass' => ViewItemTranslation::class,
            ])
            ->mountTableAction('edit', $author)
            ->setTableActionData(['display_order' => 4])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('item_translation_author', [
            'author_id' => $author->id,
            'role' => CreditRole::TRANSLATOR->value,
            'display_order' => 4,
        ]);
        $this->assertDatabaseHas('item_translation_author', [
            'author_id' => $author->id,
            'role' => CreditRole::AUTHOR->value,
            'display_order' => 0,
        ]);

        Livewire::actingAs($user)
            ->test(TranslatorCreditsRelationManager::class, [
                'ownerRecord' => $translation,
                'pageClass' => ViewItemTranslation::class,
            ])
            ->callTableAction(DetachAction::class, $author)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('item_translation_author', [
            'author_id' => $author->id,
            'role' => CreditRole::TRANSLATOR->value,
        ]);
        $this->assertDatabaseHas('item_translation_author', [
            'author_id' => $author->id,
            'role' => CreditRole::AUTHOR->value,
        ]);
        $this->assertModelExists($author);
    }

    public function test_each_role_lists_only_its_own_people(): void
    {
        $translation = ItemTranslation::factory()->create();
        $writer = Author::factory()->create();
        $translator = Author::factory()->create();
        $translation->authorCredits()->attach($writer->id);
        $translation->translatorCredits()->attach($translator->id);

        $this->setCurrentPanel();

        Livewire::actingAs($this->createCreditsEditor())
            ->test(AuthorCreditsRelationManager::class, [
                'ownerRecord' => $translation,
                'pageClass' => ViewItemTranslation::class,
            ])
            ->assertCanSeeTableRecords([$writer])
            ->assertCanNotSeeTableRecords([$translator]);
    }

    /**
     * Credits list authors, which are reference data: seeing them takes
     * manage-reference-data on top of editing the translation.
     */
    private function createCreditsEditor(): User
    {
        $user = $this->createCrudUser();
        $user->givePermissionTo(Permission::MANAGE_REFERENCE_DATA->value);

        return $user;
    }

    public function test_view_only_user_sees_no_credit_mutations(): void
    {
        $translation = ItemTranslation::factory()->create();
        $author = Author::factory()->create();
        $translation->authorCredits()->attach($author->id);

        $this->setCurrentPanel();

        Livewire::actingAs($this->createViewOnlyUser())
            ->test(AuthorCreditsRelationManager::class, [
                'ownerRecord' => $translation,
                'pageClass' => ViewItemTranslation::class,
            ])
            ->assertTableActionHidden('attach')
            ->assertTableActionHidden('edit', $author)
            ->assertTableActionHidden('detach', $author);
    }
}
