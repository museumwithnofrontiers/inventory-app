<?php

namespace Tests\Filament\RelationManagers;

use App\Enums\Permission;
use App\Filament\Resources\ItemResource\Pages\ViewItem;
use App\Filament\Resources\ItemResource\RelationManagers\ArtistsRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\DynastiesRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\TagsRelationManager;
use App\Filament\Resources\ItemResource\RelationManagers\WorkshopsRelationManager;
use App\Filament\Resources\TagResource\Pages\ViewTag;
use App\Models\Artist;
use App\Models\Dynasty;
use App\Models\Item;
use App\Models\Tag;
use App\Models\User;
use App\Models\Workshop;
use Filament\Tables\Actions\DetachAction;
use Filament\Tables\Actions\ViewAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * M7 Story A2.4 (#1903): the four simple, metadata-free pivots (tags,
 * artists, workshops, dynasties) aligned on the pivot convention's Attach /
 * View / Detach / bulk Detach shape, mounted on the Item View page (M7 Story
 * A0.6, #1895). No inverse managers exist to align: TagResource registers no
 * relation managers of its own, and Artist, Workshop and Dynasty have no
 * Filament Resource at all.
 */
class SimplePivotsTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    // ── Tags (Tag has its own Resource/policy) ───────────────────────────────

    /**
     * Tag's own policy (TagPolicy) gates `view` on `manage-reference-data`,
     * not on the generic data permissions `createCrudUser()`/
     * `createViewOnlyUser()` grant (see
     * AuthorizesRelationMutationsTest::test_item_tags_relation_manager_ignores_tags_own_policy_and_requires_host_update()
     * for the equivalent Attach/Detach case). A user needs both: the generic
     * data permissions to attach/detach (host Item's `update`), and
     * `manage-reference-data` to be allowed to view Tag's own details.
     */
    private function createCrudUserWithTagViewAccess(): User
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo([
            Permission::ACCESS_ADMIN_PANEL->value,
            Permission::VIEW_DATA->value,
            Permission::CREATE_DATA->value,
            Permission::UPDATE_DATA->value,
            Permission::DELETE_DATA->value,
            Permission::MANAGE_REFERENCE_DATA->value,
        ]);

        return $user;
    }

    private function createViewOnlyUserWithTagViewAccess(): User
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo([
            Permission::ACCESS_ADMIN_PANEL->value,
            Permission::VIEW_DATA->value,
            Permission::MANAGE_REFERENCE_DATA->value,
        ]);

        return $user;
    }

    public function test_crud_user_attaches_views_and_detaches_a_tag_from_the_item_view_page(): void
    {
        $item = Item::factory()->Object()->create();
        $tag = Tag::factory()->create();
        $user = $this->createCrudUserWithTagViewAccess();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(TagsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->callTableAction('attach', data: ['recordId' => $tag->id])
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('item_tag', [
            'item_id' => $item->id,
            'tag_id' => $tag->id,
        ]);

        Livewire::actingAs($user)
            ->test(TagsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->assertTableActionVisible(ViewAction::class, $tag)
            ->assertTableActionVisible('detach', $tag);

        Livewire::actingAs($user)
            ->test(TagsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->callTableAction(DetachAction::class, $tag)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('item_tag', [
            'item_id' => $item->id,
            'tag_id' => $tag->id,
        ]);
        $this->assertModelExists($tag);
    }

    public function test_tags_relation_manager_view_action_navigates_to_tag_resource(): void
    {
        $item = Item::factory()->Object()->create();
        $tag = Tag::factory()->create();
        $item->tags()->attach($tag->id);
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        $action = Livewire::actingAs($user)
            ->test(TagsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->instance()
            ->getTable()
            ->getAction('view');

        $this->assertNotNull($action);
        $action->record($tag);

        $this->assertSame(ViewTag::getUrl(['record' => $tag]), $action->getUrl());
    }

    public function test_view_only_user_sees_no_tag_pivot_mutations_but_keeps_view(): void
    {
        $item = Item::factory()->Object()->create();
        $tag = Tag::factory()->create();
        $item->tags()->attach($tag->id);
        $user = $this->createViewOnlyUserWithTagViewAccess();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(TagsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->assertTableActionHidden('attach')
            ->assertTableActionHidden('detach', $tag)
            ->assertTableActionVisible(ViewAction::class, $tag);
    }

    // ── Artists, Workshops, Dynasties (no Resource, no policy) ──────────────

    public function test_crud_user_attaches_views_and_detaches_an_artist_from_the_item_view_page(): void
    {
        $item = Item::factory()->Object()->create();
        $artist = Artist::factory()->create();
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ArtistsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->callTableAction('attach', data: ['recordId' => $artist->id])
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('artist_item', [
            'item_id' => $item->id,
            'artist_id' => $artist->id,
        ]);

        Livewire::actingAs($user)
            ->test(ArtistsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->assertTableActionVisible(ViewAction::class, $artist);

        Livewire::actingAs($user)
            ->test(ArtistsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->callTableAction(DetachAction::class, $artist)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('artist_item', [
            'item_id' => $item->id,
            'artist_id' => $artist->id,
        ]);
        $this->assertModelExists($artist);
    }

    public function test_view_only_user_sees_no_artist_pivot_mutations_but_keeps_view(): void
    {
        $item = Item::factory()->Object()->create();
        $artist = Artist::factory()->create();
        $item->artists()->attach($artist->id);
        $user = $this->createViewOnlyUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ArtistsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->assertTableActionHidden('attach')
            ->assertTableActionHidden('detach', $artist)
            ->assertTableActionVisible(ViewAction::class, $artist);
    }

    public function test_crud_user_attaches_views_and_detaches_a_workshop_from_the_item_view_page(): void
    {
        $item = Item::factory()->Object()->create();
        $workshop = Workshop::factory()->create();
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(WorkshopsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->callTableAction('attach', data: ['recordId' => $workshop->id])
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('item_workshop', [
            'item_id' => $item->id,
            'workshop_id' => $workshop->id,
        ]);

        Livewire::actingAs($user)
            ->test(WorkshopsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->assertTableActionVisible(ViewAction::class, $workshop)
            ->callTableAction(DetachAction::class, $workshop)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('item_workshop', [
            'item_id' => $item->id,
            'workshop_id' => $workshop->id,
        ]);
        $this->assertModelExists($workshop);
    }

    public function test_view_only_user_sees_no_workshop_pivot_mutations_but_keeps_view(): void
    {
        $item = Item::factory()->Object()->create();
        $workshop = Workshop::factory()->create();
        $item->workshops()->attach($workshop->id);
        $user = $this->createViewOnlyUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(WorkshopsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->assertTableActionHidden('attach')
            ->assertTableActionHidden('detach', $workshop)
            ->assertTableActionVisible(ViewAction::class, $workshop);
    }

    public function test_crud_user_attaches_views_and_detaches_a_dynasty_from_the_item_view_page(): void
    {
        $item = Item::factory()->Object()->create();
        $dynasty = Dynasty::factory()->create();
        $user = $this->createCrudUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(DynastiesRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->callTableAction('attach', data: ['recordId' => $dynasty->id])
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('item_dynasty', [
            'item_id' => $item->id,
            'dynasty_id' => $dynasty->id,
        ]);

        Livewire::actingAs($user)
            ->test(DynastiesRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->assertTableActionVisible(ViewAction::class, $dynasty)
            ->callTableAction(DetachAction::class, $dynasty)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('item_dynasty', [
            'item_id' => $item->id,
            'dynasty_id' => $dynasty->id,
        ]);
        $this->assertModelExists($dynasty);
    }

    public function test_view_only_user_sees_no_dynasty_pivot_mutations_but_keeps_view(): void
    {
        $item = Item::factory()->Object()->create();
        $dynasty = Dynasty::factory()->create();
        $item->dynasties()->attach($dynasty->id);
        $user = $this->createViewOnlyUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(DynastiesRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->assertTableActionHidden('attach')
            ->assertTableActionHidden('detach', $dynasty)
            ->assertTableActionVisible(ViewAction::class, $dynasty);
    }
}
