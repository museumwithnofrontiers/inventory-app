<?php

namespace Tests\Filament\RelationManagers;

use App\Filament\Resources\CollectionResource\Pages\ViewCollection;
use App\Filament\Resources\CollectionResource\RelationManagers\PartnersRelationManager;
use App\Filament\Resources\PartnerResource\Pages\ViewPartner;
use App\Filament\Resources\PartnerResource\RelationManagers\CollectionParticipationsRelationManager;
use App\Models\Collection;
use App\Models\Context;
use App\Models\Language;
use App\Models\Partner;
use Filament\Tables\Actions\DetachAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * M7 Story A2.2 (#1901): the collection_partner pivot, both sides. Mounted on
 * the View pages (ViewCollection, ViewPartner) — where every entry point into
 * a Collection or Partner lands (M7 Story A0.6, #1895).
 */
class CollectionPartnerPivotTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    // ── Collection side: PartnersRelationManager ─────────────────────────────

    public function test_crud_user_attaches_edits_and_detaches_a_partner_from_the_collection_view_page(): void
    {
        $collection = $this->makeCollection();
        $partner = Partner::factory()->create();
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(PartnersRelationManager::class, [
                'ownerRecord' => $collection,
                'pageClass' => ViewCollection::class,
            ])
            ->mountTableAction('attach')
            ->setTableActionData([
                'recordId' => $partner->id,
                'level' => 'partner',
                'visible' => false,
            ])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('collection_partner', [
            'collection_id' => $collection->id,
            'partner_id' => $partner->id,
            'collection_type' => 'collection',
            'level' => 'partner',
            'visible' => false,
        ]);

        $partnerInternalNameBeforeEdit = $partner->internal_name;

        Livewire::actingAs($user)
            ->test(PartnersRelationManager::class, [
                'ownerRecord' => $collection,
                'pageClass' => ViewCollection::class,
            ])
            ->mountTableAction('edit', $partner)
            ->setTableActionData([
                'level' => 'associated_partner',
                'visible' => true,
            ])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('collection_partner', [
            'collection_id' => $collection->id,
            'partner_id' => $partner->id,
            'level' => 'associated_partner',
            'visible' => true,
        ]);
        // The edit-pivot modal must never touch the related Partner's own columns.
        $this->assertSame($partnerInternalNameBeforeEdit, $partner->fresh()->internal_name);

        Livewire::actingAs($user)
            ->test(PartnersRelationManager::class, [
                'ownerRecord' => $collection,
                'pageClass' => ViewCollection::class,
            ])
            ->callTableAction(DetachAction::class, $partner->fresh())
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('collection_partner', [
            'collection_id' => $collection->id,
            'partner_id' => $partner->id,
        ]);
        $this->assertModelExists($partner);
    }

    public function test_view_only_user_sees_no_partner_pivot_mutations_on_the_collection_view_page(): void
    {
        $collection = $this->makeCollection();
        $partner = Partner::factory()->create();
        $collection->partners()->attach($partner->id, ['collection_type' => 'collection', 'level' => 'partner']);
        $user = $this->createViewOnlyUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(PartnersRelationManager::class, [
                'ownerRecord' => $collection,
                'pageClass' => ViewCollection::class,
            ])
            ->assertTableActionHidden('attach')
            ->assertTableActionHidden('edit', $partner)
            ->assertTableActionHidden('detach', $partner);
    }

    // ── Partner side: CollectionParticipationsRelationManager ────────────────

    public function test_crud_user_attaches_edits_and_detaches_a_collection_from_the_partner_view_page(): void
    {
        $partner = Partner::factory()->create();
        $collection = $this->makeCollection();
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CollectionParticipationsRelationManager::class, [
                'ownerRecord' => $partner,
                'pageClass' => ViewPartner::class,
            ])
            ->mountTableAction('attach')
            ->setTableActionData([
                'recordId' => $collection->id,
                'level' => 'partner',
                'visible' => true,
            ])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('collection_partner', [
            'collection_id' => $collection->id,
            'partner_id' => $partner->id,
            'collection_type' => 'collection',
            'level' => 'partner',
            'visible' => true,
        ]);

        $collectionInternalNameBeforeEdit = $collection->internal_name;

        Livewire::actingAs($user)
            ->test(CollectionParticipationsRelationManager::class, [
                'ownerRecord' => $partner,
                'pageClass' => ViewPartner::class,
            ])
            ->mountTableAction('edit', $collection)
            ->setTableActionData([
                'level' => 'minor_contributor',
                'visible' => false,
            ])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('collection_partner', [
            'collection_id' => $collection->id,
            'partner_id' => $partner->id,
            'level' => 'minor_contributor',
            'visible' => false,
        ]);
        // The edit-pivot modal must never touch the related Collection's own columns.
        $this->assertSame($collectionInternalNameBeforeEdit, $collection->fresh()->internal_name);

        Livewire::actingAs($user)
            ->test(CollectionParticipationsRelationManager::class, [
                'ownerRecord' => $partner,
                'pageClass' => ViewPartner::class,
            ])
            ->callTableAction(DetachAction::class, $collection->fresh())
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('collection_partner', [
            'collection_id' => $collection->id,
            'partner_id' => $partner->id,
        ]);
        $this->assertModelExists($collection);
    }

    public function test_view_only_user_sees_no_collection_pivot_mutations_on_the_partner_view_page(): void
    {
        $partner = Partner::factory()->create();
        $collection = $this->makeCollection();
        $partner->collections()->attach($collection->id, ['collection_type' => 'collection', 'level' => 'partner']);
        $user = $this->createViewOnlyUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CollectionParticipationsRelationManager::class, [
                'ownerRecord' => $partner,
                'pageClass' => ViewPartner::class,
            ])
            ->assertTableActionHidden('attach')
            ->assertTableActionHidden('edit', $collection)
            ->assertTableActionHidden('detach', $collection);
    }

    /**
     * The story's headline acceptance line: from Partner, attaching a
     * collection is restricted to `collection_type = collection` (the
     * `collections` table's own `type` column, via Collection's
     * `scopeCollections()` — distinct from the collection_partner pivot's own
     * fixed `collection_type` discriminator column).
     */
    public function test_partner_side_attach_select_is_restricted_to_collections_of_type_collection(): void
    {
        $partner = Partner::factory()->create();
        $collection = $this->makeCollection();
        $exhibition = Collection::factory()->exhibition()->create([
            'context_id' => Context::factory()->create()->id,
            'language_id' => 'eng',
        ]);
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        $component = Livewire::actingAs($user)
            ->test(CollectionParticipationsRelationManager::class, [
                'ownerRecord' => $partner,
                'pageClass' => ViewPartner::class,
            ])
            ->mountTableAction('attach');

        $form = $component->instance()->getMountedTableActionForm();
        $this->assertNotNull($form);
        $select = $form->getFlatFields()['recordId'];
        $options = $select->getSearchResults('');

        $this->assertArrayHasKey($collection->id, $options);
        $this->assertArrayNotHasKey($exhibition->id, $options);
    }

    private function makeCollection(): Collection
    {
        $context = Context::factory()->create();
        $language = Language::query()->find('eng') ?? Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);

        return Collection::factory()->collection()->create([
            'context_id' => $context->id,
            'language_id' => $language->id,
        ]);
    }
}
