<?php

namespace Tests\Filament\RelationManagers;

use App\Filament\Concerns\AuthorizesRelationMutations;
use App\Filament\Resources\ItemItemLinkResource\Pages\EditItemItemLink;
use App\Filament\Resources\ItemItemLinkResource\RelationManagers\TranslationsRelationManager;
use App\Models\ItemItemLink;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

class ItemItemLinkTranslationsRelationManagerTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_item_item_link_translations_relation_manager_uses_authorizes_relation_mutations(): void
    {
        $this->assertTrue(
            in_array(AuthorizesRelationMutations::class, class_uses_recursive(TranslationsRelationManager::class), true),
            'TranslationsRelationManager must use AuthorizesRelationMutations trait.'
        );
    }

    public function test_manager_renders_for_crud_user(): void
    {
        $user = $this->createCrudUser();
        $itemItemLink = ItemItemLink::factory()->create();

        $this->setCurrentPanel();

        $component = Livewire::actingAs($user)->test(TranslationsRelationManager::class, [
            'ownerRecord' => $itemItemLink,
            'pageClass' => EditItemItemLink::class,
        ]);

        $component->assertSuccessful();
    }

    public function test_manager_renders_for_view_only_user(): void
    {
        $user = $this->createViewOnlyUser();
        $itemItemLink = ItemItemLink::factory()->create();

        $this->setCurrentPanel();

        $component = Livewire::actingAs($user)->test(TranslationsRelationManager::class, [
            'ownerRecord' => $itemItemLink,
            'pageClass' => EditItemItemLink::class,
        ]);

        $component->assertSuccessful();
    }
}
