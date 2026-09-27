<?php

namespace Tests\Filament\RelationManagers;

use App\Filament\Resources\ItemItemLinkResource\Pages\ViewItemItemLink;
use App\Filament\Resources\ItemItemLinkResource\RelationManagers\TranslationsRelationManager;
use App\Models\ItemItemLink;
use App\Models\ItemItemLinkTranslation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * Every mutation of an item link's translations needs `update` on the link,
 * which ItemItemLinkPolicy grants with `update-data`; viewing a translation
 * stays open to anyone who can view data.
 */
class ItemItemLinkTranslationsRelationManagerTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_view_only_user_can_view_but_sees_no_mutating_actions(): void
    {
        $link = ItemItemLink::factory()->create();
        $translation = ItemItemLinkTranslation::factory()->create(['item_item_link_id' => $link->id]);
        $user = $this->createViewOnlyUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(TranslationsRelationManager::class, [
                'ownerRecord' => $link,
                'pageClass' => ViewItemItemLink::class,
            ])
            ->assertTableActionHidden('create')
            ->assertTableActionVisible('view', $translation->getKey())
            ->assertTableActionHidden('edit', $translation->getKey())
            ->assertTableActionHidden('delete', $translation->getKey());
    }

    public function test_crud_user_keeps_every_action(): void
    {
        $link = ItemItemLink::factory()->create();
        $translation = ItemItemLinkTranslation::factory()->create(['item_item_link_id' => $link->id]);
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(TranslationsRelationManager::class, [
                'ownerRecord' => $link,
                'pageClass' => ViewItemItemLink::class,
            ])
            ->assertTableActionVisible('create')
            ->assertTableActionVisible('view', $translation->getKey())
            ->assertTableActionVisible('edit', $translation->getKey())
            ->assertTableActionVisible('delete', $translation->getKey());
    }
}
