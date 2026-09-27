<?php

namespace Tests\Filament\RelationManagers;

use App\Filament\Resources\ItemResource\Pages\ViewItem;
use App\Filament\Resources\ItemResource\RelationManagers\BaseChildItemsRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\PictureItemsRelationManager;
use App\Models\Item;
use App\Models\Partner;
use Filament\Actions\MountableAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Features\SupportTesting\Testable;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * M7 story A1.3 (epic #1872): the has-many convention on
 * PictureItemsRelationManager, built on the same
 * {@see BaseChildItemsRelationManager}
 * as A1.2's ChildItemsRelationManager, restricted to `type = picture`.
 * Mounted on ViewItem — that's where users land on an Item and where every
 * action here must work per AuthorizesRelationMutations (A0.1), which also
 * makes the manager editable on the resource's View page.
 */
class PictureItemsRelationManagerTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    // ── Header: Create ──────────────────────────────────────────────────────

    public function test_create_action_url_carries_the_parent_id_and_type(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create(['internal_name' => 'Parent item']);

        $this->setCurrentPanel();

        $component = Livewire::actingAs($user)->test(PictureItemsRelationManager::class, [
            'ownerRecord' => $item,
            'pageClass' => ViewItem::class,
        ]);

        $create = $this->headerAction($component, 'create');

        $this->assertStringContainsString('/admin/items/create', (string) $create->getUrl());
        $this->assertStringContainsString("parent_id={$item->id}", (string) $create->getUrl());
        $this->assertStringContainsString('type=picture', (string) $create->getUrl());
        $this->assertStringNotContainsString('partner_id=', (string) $create->getUrl());
    }

    public function test_create_action_url_also_carries_the_parents_own_partner_id(): void
    {
        $user = $this->createCrudUser();
        $partner = Partner::factory()->create();
        $item = Item::factory()->Object()->create(['internal_name' => 'Parent item', 'partner_id' => $partner->id]);

        $this->setCurrentPanel();

        $component = Livewire::actingAs($user)->test(PictureItemsRelationManager::class, [
            'ownerRecord' => $item,
            'pageClass' => ViewItem::class,
        ]);

        $create = $this->headerAction($component, 'create');

        $this->assertStringContainsString("parent_id={$item->id}", (string) $create->getUrl());
        $this->assertStringContainsString('type=picture', (string) $create->getUrl());
        $this->assertStringContainsString("partner_id={$partner->id}", (string) $create->getUrl());
    }

    // ── Header: Attach existing (type scope + cycle guard) ──────────────────

    public function test_associate_only_offers_items_of_type_picture(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create(['internal_name' => 'the-item']);
        $picture = Item::factory()->Picture()->create(['internal_name' => 'unrelated-picture', 'parent_id' => null]);
        $nonPicture = Item::factory()->Object()->create(['internal_name' => 'unrelated-object']);

        $this->setCurrentPanel();

        $component = Livewire::actingAs($user)->test(PictureItemsRelationManager::class, [
            'ownerRecord' => $item,
            'pageClass' => ViewItem::class,
        ]);

        $component->mountTableAction('associate');

        $form = $component->instance()->getMountedTableActionForm();
        $this->assertNotNull($form);
        $select = $form->getFlatFields()['recordId'];

        $this->assertArrayHasKey($picture->id, $select->getSearchResults('unrelated-picture'));
        $this->assertArrayNotHasKey($nonPicture->id, $select->getSearchResults('unrelated-object'));

        $component->call('unmountTableAction', false, false);
    }

    public function test_associate_excludes_the_owner_and_its_ancestors_but_offers_unrelated_picture_items(): void
    {
        $user = $this->createCrudUser();

        // Ancestors are themselves type = picture here so the assertion
        // actually exercises the cycle guard on top of the type scope: if
        // they were a different type, the type filter alone would already
        // exclude them and the cycle guard would never be exercised.
        $grandparent = Item::factory()->Picture()->create(['internal_name' => 'grandparent-item', 'parent_id' => null]);
        $parent = Item::factory()->Picture()->create(['internal_name' => 'parent-item', 'parent_id' => $grandparent->id]);
        $item = Item::factory()->Object()->create(['internal_name' => 'the-item', 'parent_id' => $parent->id]);
        $unrelated = Item::factory()->Picture()->create(['internal_name' => 'unrelated-item', 'parent_id' => null]);

        $this->setCurrentPanel();

        $component = Livewire::actingAs($user)->test(PictureItemsRelationManager::class, [
            'ownerRecord' => $item,
            'pageClass' => ViewItem::class,
        ]);

        $component->mountTableAction('associate');

        $form = $component->instance()->getMountedTableActionForm();
        $this->assertNotNull($form);
        $select = $form->getFlatFields()['recordId'];

        $this->assertArrayNotHasKey($grandparent->id, $select->getSearchResults('grandparent-item'));
        $this->assertArrayNotHasKey($parent->id, $select->getSearchResults('parent-item'));
        $this->assertArrayHasKey($unrelated->id, $select->getSearchResults('unrelated-item'));

        $component->call('unmountTableAction', false, false);
    }

    public function test_associate_does_not_exclude_a_descendant_of_the_owner(): void
    {
        $user = $this->createCrudUser();

        // A grandchild two levels down: a descendant of the owner, but not
        // itself already associated with the owner (Filament's own
        // AssociateAction already excludes records that already carry the
        // owner's id, independent of our cycle guard). Re-parenting this
        // grandchild directly under the owner creates no cycle, so
        // excludingAncestorsOf() must not exclude it either.
        $item = Item::factory()->Object()->create(['internal_name' => 'the-item']);
        $child = Item::factory()->Picture()->create(['internal_name' => 'existing-child', 'parent_id' => $item->id]);
        $grandchild = Item::factory()->Picture()->create(['internal_name' => 'existing-grandchild', 'parent_id' => $child->id]);

        $this->setCurrentPanel();

        $component = Livewire::actingAs($user)->test(PictureItemsRelationManager::class, [
            'ownerRecord' => $item,
            'pageClass' => ViewItem::class,
        ]);

        $component->mountTableAction('associate');

        $form = $component->instance()->getMountedTableActionForm();
        $this->assertNotNull($form);
        $select = $form->getFlatFields()['recordId'];

        $this->assertArrayHasKey($grandchild->id, $select->getSearchResults('existing-grandchild'));

        $component->call('unmountTableAction', false, false);
    }

    public function test_associate_action_sets_parent_id_on_the_attached_item(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create(['internal_name' => 'the-item']);
        $target = Item::factory()->Picture()->create(['internal_name' => 'soon-to-be-child', 'parent_id' => null]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(PictureItemsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->callTableAction('associate', data: ['recordId' => $target->id])
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('items', [
            'id' => $target->id,
            'parent_id' => $item->id,
        ]);
    }

    // ── Row: Detach / Delete ─────────────────────────────────────────────────

    public function test_dissociate_clears_parent_id_only_and_leaves_partner_id_untouched(): void
    {
        $user = $this->createCrudUser();
        $partner = Partner::factory()->create();
        $item = Item::factory()->Object()->create(['internal_name' => 'the-item']);
        $child = Item::factory()->Picture()->create([
            'internal_name' => 'child-picture',
            'parent_id' => $item->id,
            'partner_id' => $partner->id,
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(PictureItemsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->callTableAction('dissociate', $child)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('items', [
            'id' => $child->id,
            'parent_id' => null,
            'partner_id' => $partner->id,
        ]);
    }

    public function test_delete_action_removes_the_child_item(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create(['internal_name' => 'the-item']);
        $child = Item::factory()->Picture()->create(['internal_name' => 'child-picture', 'parent_id' => $item->id]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(PictureItemsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->callTableAction('delete', $child)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('items', ['id' => $child->id]);
    }

    // ── Authorization: view-only user sees no mutating action ──────────────

    public function test_view_only_user_sees_no_mutating_action(): void
    {
        $viewer = $this->createViewOnlyUser();
        $item = Item::factory()->Object()->create(['internal_name' => 'the-item']);
        $child = Item::factory()->Picture()->create(['internal_name' => 'child-picture', 'parent_id' => $item->id]);

        $this->setCurrentPanel();

        Livewire::actingAs($viewer)
            ->test(PictureItemsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->assertTableActionHidden('create')
            ->assertTableActionHidden('associate')
            ->assertTableActionHidden('edit', $child)
            ->assertTableActionHidden('dissociate', $child)
            ->assertTableActionHidden('delete', $child)
            ->assertTableBulkActionHidden('dissociate');
    }

    public function test_crud_user_keeps_every_mutating_action(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create(['internal_name' => 'the-item']);
        $child = Item::factory()->Picture()->create(['internal_name' => 'child-picture', 'parent_id' => $item->id]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(PictureItemsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->assertTableActionVisible('create')
            ->assertTableActionVisible('associate')
            ->assertTableActionVisible('edit', $child)
            ->assertTableActionVisible('dissociate', $child)
            ->assertTableActionVisible('delete', $child)
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
