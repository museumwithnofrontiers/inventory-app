<?php

namespace Tests\Filament\RelationManagers;

use App\Filament\Resources\PartnerResource\Pages\ViewPartner;
use App\Filament\Resources\PartnerResource\RelationManagers\OwnedItemsRelationManager;
use App\Models\Item;
use App\Models\Partner;
use Filament\Actions\MountableAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Features\SupportTesting\Testable;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * M7 story A1.4 (epic #1872): the has-many convention on
 * OwnedItemsRelationManager. Mounted on ViewPartner — that's where users land
 * on a Partner and where every action here must work per
 * AuthorizesRelationMutations (A0.1), which also makes the manager editable
 * on the resource's View page.
 */
class OwnedItemsRelationManagerTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    // ── Header: Create ──────────────────────────────────────────────────────

    public function test_create_action_url_carries_the_partner_id(): void
    {
        $user = $this->createCrudUser();
        $partner = Partner::factory()->create(['internal_name' => 'The partner']);

        $this->setCurrentPanel();

        $component = Livewire::actingAs($user)->test(OwnedItemsRelationManager::class, [
            'ownerRecord' => $partner,
            'pageClass' => ViewPartner::class,
        ]);

        $create = $this->headerAction($component, 'create');

        $this->assertStringContainsString('/admin/items/create', (string) $create->getUrl());
        $this->assertStringContainsString("partner_id={$partner->id}", (string) $create->getUrl());
    }

    // ── Header: Attach existing ──────────────────────────────────────────────

    public function test_associate_excludes_items_already_owned_by_the_current_partner_but_offers_the_rest(): void
    {
        $user = $this->createCrudUser();
        $partner = Partner::factory()->create();
        $otherPartner = Partner::factory()->create();

        $alreadyMine = Item::factory()->Object()->create(['internal_name' => 'already-mine-item', 'partner_id' => $partner->id]);
        $ownedByOther = Item::factory()->Object()->create(['internal_name' => 'owned-by-other-item', 'partner_id' => $otherPartner->id]);
        $unowned = Item::factory()->Object()->create(['internal_name' => 'unowned-item']);

        $this->setCurrentPanel();

        $component = Livewire::actingAs($user)->test(OwnedItemsRelationManager::class, [
            'ownerRecord' => $partner,
            'pageClass' => ViewPartner::class,
        ]);

        $component->mountTableAction('associate');

        $form = $component->instance()->getMountedTableActionForm();
        $this->assertNotNull($form);
        $select = $form->getFlatFields()['recordId'];

        $this->assertArrayNotHasKey($alreadyMine->id, $select->getSearchResults('already-mine-item'));
        $this->assertArrayHasKey($ownedByOther->id, $select->getSearchResults('owned-by-other-item'));
        $this->assertArrayHasKey($unowned->id, $select->getSearchResults('unowned-item'));

        $component->call('unmountTableAction', false, false);
    }

    public function test_associate_form_shows_previous_owner_once_an_already_owned_item_is_selected(): void
    {
        $user = $this->createCrudUser();
        $partner = Partner::factory()->create();
        $previousPartner = Partner::factory()->create(['internal_name' => 'Previous partner']);
        $item = Item::factory()->Object()->create(['internal_name' => 'already-owned-item', 'partner_id' => $previousPartner->id]);

        $this->setCurrentPanel();

        $component = Livewire::actingAs($user)->test(OwnedItemsRelationManager::class, [
            'ownerRecord' => $partner,
            'pageClass' => ViewPartner::class,
        ]);

        $component->mountTableAction('associate')
            ->setTableActionData(['recordId' => $item->id]);

        $form = $component->instance()->getMountedTableActionForm();
        $this->assertNotNull($form);

        $placeholder = $form->getComponent('previousOwner', withHidden: true);
        $this->assertNotNull($placeholder);
        $this->assertTrue($placeholder->isVisible());
        $this->assertStringContainsString('Previous partner', (string) $placeholder->getContent());

        $component->call('unmountTableAction', false, false);
    }

    public function test_associate_form_hides_previous_owner_placeholder_for_an_unowned_item(): void
    {
        $user = $this->createCrudUser();
        $partner = Partner::factory()->create();
        $item = Item::factory()->Object()->create(['internal_name' => 'unowned-item']);

        $this->setCurrentPanel();

        $component = Livewire::actingAs($user)->test(OwnedItemsRelationManager::class, [
            'ownerRecord' => $partner,
            'pageClass' => ViewPartner::class,
        ]);

        $component->mountTableAction('associate')
            ->setTableActionData(['recordId' => $item->id]);

        $form = $component->instance()->getMountedTableActionForm();
        $this->assertNotNull($form);

        $placeholder = $form->getComponent('previousOwner', withHidden: true);
        $this->assertNotNull($placeholder);
        $this->assertFalse($placeholder->isVisible());

        $component->call('unmountTableAction', false, false);
    }

    public function test_associate_action_reassigns_ownership_from_the_previous_partner(): void
    {
        $user = $this->createCrudUser();
        $partner = Partner::factory()->create();
        $previousPartner = Partner::factory()->create();
        $item = Item::factory()->Object()->create(['internal_name' => 'already-owned-item', 'partner_id' => $previousPartner->id]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(OwnedItemsRelationManager::class, [
                'ownerRecord' => $partner,
                'pageClass' => ViewPartner::class,
            ])
            ->callTableAction('associate', data: ['recordId' => $item->id])
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('items', [
            'id' => $item->id,
            'partner_id' => $partner->id,
        ]);
    }

    // ── Row: Detach / Delete ─────────────────────────────────────────────────

    public function test_dissociate_sets_partner_id_to_null_without_deleting_the_record(): void
    {
        $user = $this->createCrudUser();
        $partner = Partner::factory()->create();
        $item = Item::factory()->Object()->create(['internal_name' => 'owned-item', 'partner_id' => $partner->id]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(OwnedItemsRelationManager::class, [
                'ownerRecord' => $partner,
                'pageClass' => ViewPartner::class,
            ])
            ->callTableAction('dissociate', $item)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('items', [
            'id' => $item->id,
            'partner_id' => null,
        ]);
    }

    public function test_delete_action_removes_the_owned_item(): void
    {
        $user = $this->createCrudUser();
        $partner = Partner::factory()->create();
        $item = Item::factory()->Object()->create(['internal_name' => 'owned-item', 'partner_id' => $partner->id]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(OwnedItemsRelationManager::class, [
                'ownerRecord' => $partner,
                'pageClass' => ViewPartner::class,
            ])
            ->callTableAction('delete', $item)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('items', ['id' => $item->id]);
    }

    // ── Authorization: view-only user sees no mutating action ──────────────

    public function test_view_only_user_sees_no_mutating_action(): void
    {
        $viewer = $this->createViewOnlyUser();
        $partner = Partner::factory()->create();
        $item = Item::factory()->Object()->create(['internal_name' => 'owned-item', 'partner_id' => $partner->id]);

        $this->setCurrentPanel();

        Livewire::actingAs($viewer)
            ->test(OwnedItemsRelationManager::class, [
                'ownerRecord' => $partner,
                'pageClass' => ViewPartner::class,
            ])
            ->assertTableActionHidden('create')
            ->assertTableActionHidden('associate')
            ->assertTableActionHidden('edit', $item)
            ->assertTableActionHidden('dissociate', $item)
            ->assertTableActionHidden('delete', $item)
            ->assertTableBulkActionHidden('dissociate');
    }

    public function test_crud_user_keeps_every_mutating_action(): void
    {
        $user = $this->createCrudUser();
        $partner = Partner::factory()->create();
        $item = Item::factory()->Object()->create(['internal_name' => 'owned-item', 'partner_id' => $partner->id]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(OwnedItemsRelationManager::class, [
                'ownerRecord' => $partner,
                'pageClass' => ViewPartner::class,
            ])
            ->assertTableActionVisible('create')
            ->assertTableActionVisible('associate')
            ->assertTableActionVisible('edit', $item)
            ->assertTableActionVisible('dissociate', $item)
            ->assertTableActionVisible('delete', $item)
            ->assertTableBulkActionVisible('dissociate');
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function headerAction(Testable $component, string $name): MountableAction
    {
        $table = $component->instance()->getTable();

        foreach ($table->getHeaderActions() as $action) {
            if ($action instanceof MountableAction && $action->getName() === $name) {
                return $action;
            }
        }

        $this->fail("Header action [{$name}] not found.");
    }
}
