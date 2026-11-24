<?php

namespace Tests\Filament\Resources;

use App\Enums\Permission;
use App\Filament\Resources\ArtistResource;
use App\Filament\Resources\ArtistResource\Pages\CreateArtist;
use App\Filament\Resources\ArtistResource\Pages\EditArtist;
use App\Filament\Resources\ArtistResource\Pages\ListArtist;
use App\Filament\Resources\ArtistResource\Pages\ViewArtist;
use App\Filament\Resources\ArtistResource\RelationManagers\ItemsRelationManager;
use App\Filament\Resources\ItemResource\Pages\ViewItem;
use App\Filament\Resources\ItemResource\RelationManagers\ArtistsRelationManager;
use App\Models\Artist;
use App\Models\Item;
use App\Models\User;
use Filament\Actions\DeleteAction as PageDeleteAction;
use Filament\Actions\DetachAction;
use Filament\Actions\ViewAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

class ArtistResourceTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    // ── Access ───────────────────────────────────────────────────────────────

    public function test_reference_data_user_can_render_every_page(): void
    {
        $user = $this->createReferenceDataUser();
        $artist = Artist::factory()->create(['name' => 'Sinan the Architect']);
        $this->setCurrentPanel();

        $this->actingAs($user)->get(ArtistResource::getUrl('index'))
            ->assertOk()
            ->assertSee('Sinan the Architect');

        $this->actingAs($user)->get(ArtistResource::getUrl('create'))
            ->assertOk();

        $this->actingAs($user)->get(ArtistResource::getUrl('edit', ['record' => $artist]))
            ->assertOk()
            ->assertSee('Sinan the Architect');

        $this->actingAs($user)->get(ArtistResource::getUrl('view', ['record' => $artist]))
            ->assertOk()
            ->assertSee('Sinan the Architect');
    }

    public function test_a_visitor_reads_the_resource_but_cannot_change_it(): void
    {
        $artist = Artist::factory()->create();
        $this->setCurrentPanel();
        $visitor = $this->createViewOnlyUser();

        $this->actingAs($visitor)->get(ArtistResource::getUrl('index'))->assertOk();
        $this->actingAs($visitor)->get(ArtistResource::getUrl('view', ['record' => $artist]))->assertOk();
        $this->actingAs($visitor)->get(ArtistResource::getUrl('create'))->assertForbidden();
        $this->actingAs($visitor)->get(ArtistResource::getUrl('edit', ['record' => $artist]))->assertForbidden();
    }

    public function test_navigation_follows_the_policy(): void
    {
        $this->actingAs($this->createViewOnlyUser());
        $this->assertTrue(ArtistResource::canViewAny());
        $this->assertTrue(ArtistResource::shouldRegisterNavigation());

        $panelOnly = User::factory()->create();
        $panelOnly->givePermissionTo(Permission::ACCESS_ADMIN_PANEL->value);
        $this->actingAs($panelOnly);
        $this->assertFalse(ArtistResource::canViewAny());
        $this->assertFalse(ArtistResource::shouldRegisterNavigation());

        $this->assertSame('Shared Data', ArtistResource::getNavigationGroup());
    }

    // ── List, create, edit, delete ───────────────────────────────────────────

    public function test_list_shows_artists_with_their_item_count(): void
    {
        $user = $this->createReferenceDataUser();
        $linked = Artist::factory()->create(['name' => 'Linked Artist']);
        $linked->items()->attach(Item::factory()->count(2)->create()->pluck('id')->all());
        $alone = Artist::factory()->create(['name' => 'Alone Artist']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListArtist::class)
            ->assertCanSeeTableRecords([$linked, $alone])
            ->assertTableColumnStateSet('items_count', 2, $linked->getKey())
            ->assertTableColumnStateSet('items_count', 0, $alone->getKey())
            ->searchTable('Linked')
            ->assertCanSeeTableRecords([$linked])
            ->assertCanNotSeeTableRecords([$alone]);
    }

    public function test_reference_data_user_creates_an_artist(): void
    {
        $user = $this->createReferenceDataUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CreateArtist::class)
            ->fillForm([
                'name' => 'Mimar Sinan',
                'internal_name' => 'sinan_mimar',
                'period_of_activity' => '16th century',
                'place_of_birth' => 'Ağırnas',
                'date_of_birth' => 'c. 1490',
                'place_of_death' => 'Istanbul',
                'date_of_death' => '1588',
                'backward_compatibility' => 'mwnf3:artists:1',
            ])
            ->call('create')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('artists', [
            'name' => 'Mimar Sinan',
            'internal_name' => 'sinan_mimar',
            'period_of_activity' => '16th century',
            'place_of_birth' => 'Ağırnas',
            'date_of_birth' => 'c. 1490',
            'place_of_death' => 'Istanbul',
            'date_of_death' => '1588',
            'backward_compatibility' => 'mwnf3:artists:1',
        ]);
    }

    public function test_name_and_a_unique_internal_name_are_required(): void
    {
        $user = $this->createReferenceDataUser();
        Artist::factory()->create(['internal_name' => 'taken']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CreateArtist::class)
            ->fillForm(['name' => '', 'internal_name' => 'taken'])
            ->call('create')
            ->assertHasFormErrors(['name' => 'required', 'internal_name' => 'unique']);
    }

    public function test_reference_data_user_edits_an_artist(): void
    {
        $user = $this->createReferenceDataUser();
        $artist = Artist::factory()->create([
            'name' => 'Old name',
            'internal_name' => 'old_name',
            'period_of_activity' => null,
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(EditArtist::class, ['record' => $artist->getRouteKey()])
            ->assertFormSet(['name' => 'Old name', 'internal_name' => 'old_name'])
            ->fillForm([
                'name' => 'New name',
                'internal_name' => 'old_name',
                'period_of_activity' => 'Early 17th century',
            ])
            ->call('save')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('artists', [
            'id' => $artist->id,
            'name' => 'New name',
            'internal_name' => 'old_name',
            'period_of_activity' => 'Early 17th century',
        ]);
    }

    public function test_view_page_shows_the_artist(): void
    {
        $user = $this->createReferenceDataUser();
        $artist = Artist::factory()->create([
            'name' => 'Ustad Ahmad',
            'period_of_activity' => '17th century',
            'backward_compatibility' => 'mwnf3:artists:42',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ViewArtist::class, ['record' => $artist->getRouteKey()])
            ->assertSee('Ustad Ahmad')
            ->assertSee('17th century')
            ->assertSee('mwnf3:artists:42');
    }

    public function test_deleting_an_artist_removes_its_links_but_keeps_the_items(): void
    {
        $user = $this->createReferenceDataUser();
        $artist = Artist::factory()->create();
        $item = Item::factory()->create();
        $artist->items()->attach($item->id);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListArtist::class)
            ->mountTableAction(PageDeleteAction::class, $artist)
            ->assertMountedActionModalSee('This artist is linked to 1 item.')
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $this->assertModelMissing($artist);
        $this->assertDatabaseMissing('artist_item', ['artist_id' => $artist->id]);
        $this->assertModelExists($item);
    }

    public function test_view_page_deletes_an_artist(): void
    {
        $user = $this->createReferenceDataUser();
        $artist = Artist::factory()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ViewArtist::class, ['record' => $artist->getRouteKey()])
            ->callAction(PageDeleteAction::class);

        $this->assertModelMissing($artist);
    }

    public function test_delete_confirmation_counts_the_links(): void
    {
        $artist = Artist::factory()->create();
        $this->assertSame('This artist is not linked to any item.', ArtistResource::deleteConfirmation($artist));

        $artist->items()->attach(Item::factory()->count(3)->create()->pluck('id')->all());
        $this->assertStringStartsWith('This artist is linked to 3 items.', ArtistResource::deleteConfirmation($artist));
    }

    // ── Items relation manager (the artist's side) ───────────────────────────

    public function test_reference_data_user_attaches_and_detaches_items_from_the_view_page(): void
    {
        $user = $this->createReferenceDataCrudUser();
        $artist = Artist::factory()->create();
        $item = Item::factory()->Object()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ItemsRelationManager::class, ['ownerRecord' => $artist, 'pageClass' => ViewArtist::class])
            ->callTableAction('attach', data: ['recordId' => $item->id])
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('artist_item', ['artist_id' => $artist->id, 'item_id' => $item->id]);

        Livewire::actingAs($user)
            ->test(ItemsRelationManager::class, ['ownerRecord' => $artist, 'pageClass' => ViewArtist::class])
            ->assertCanSeeTableRecords([$item->getKey()])
            ->callTableAction(DetachAction::class, $item->getKey())
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('artist_item', ['artist_id' => $artist->id, 'item_id' => $item->id]);
        $this->assertModelExists($item);
    }

    public function test_items_relation_manager_needs_update_on_the_artist(): void
    {
        $artist = Artist::factory()->create();
        $item = Item::factory()->Object()->create();
        $artist->items()->attach($item->id);

        $this->setCurrentPanel();

        // A Visitor updates neither.
        Livewire::actingAs($this->createViewOnlyUser())
            ->test(ItemsRelationManager::class, ['ownerRecord' => $artist, 'pageClass' => ViewArtist::class])
            ->assertTableActionHidden('attach')
            ->assertTableActionHidden('detach', $item->getKey());

        Livewire::actingAs($this->createReferenceDataCrudUser())
            ->test(ItemsRelationManager::class, ['ownerRecord' => $artist, 'pageClass' => ViewArtist::class])
            ->assertTableActionVisible('attach')
            ->assertTableActionVisible('detach', $item->getKey())
            ->assertTableActionVisible(ViewAction::class, $item->getKey());
    }

    // ── The item's Artists manager links to this resource ────────────────────

    public function test_item_artists_view_opens_the_artist_page_for_a_reference_data_user(): void
    {
        $item = Item::factory()->Object()->create();
        $artist = Artist::factory()->create();
        $item->artists()->attach($artist->id);

        $this->setCurrentPanel();

        Livewire::actingAs($this->createReferenceDataCrudUser())
            ->test(ArtistsRelationManager::class, ['ownerRecord' => $item, 'pageClass' => ViewItem::class])
            ->assertTableActionHasUrl(ViewAction::class, ArtistResource::getUrl('view', ['record' => $artist]), $artist->getKey());
    }

    public function test_item_artists_view_keeps_the_modal_for_a_data_user(): void
    {
        $item = Item::factory()->Object()->create();
        $artist = Artist::factory()->create(['name' => 'Modal Artist']);
        $item->artists()->attach($artist->id);

        $this->setCurrentPanel();

        Livewire::actingAs($this->createViewOnlyUser())
            ->test(ArtistsRelationManager::class, ['ownerRecord' => $item, 'pageClass' => ViewItem::class])
            ->assertTableActionVisible(ViewAction::class, $artist->getKey())
            ->mountTableAction(ViewAction::class, $artist->getKey())
            ->assertMountedActionModalSee('Place of birth');
    }
}
