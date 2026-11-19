<?php

namespace Tests\Filament\Resources;

use App\Enums\LinkType;
use App\Filament\Resources\CollectionResource\Pages\ViewCollection;
use App\Filament\Resources\ItemResource\Pages\ViewItem;
use App\Filament\Resources\PartnerResource\Pages\ViewPartner;
use App\Filament\Resources\PublicationEditionResource;
use App\Filament\Resources\PublicationEditionResource\Pages\ViewPublicationEdition;
use App\Filament\Resources\RelationManagers\LinksRelationManager;
use App\Models\Collection;
use App\Models\Item;
use App\Models\Language;
use App\Models\Link;
use App\Models\Partner;
use App\Models\PublicationEdition;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * M16 F3 (#2653): one Links manager on items, collections, partners and
 * publication editions. It keeps what M7 A4.4 (#1908) gave the Media
 * manager: inline Create/Edit with language and extra, every mutation gated
 * on the host record's update ability (AuthorizesRelationMutations). A
 * publication edition has no policy: its publication's governs it.
 */
class LinksRelationManagerTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_media_relation_manager_renders(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(LinksRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->assertSuccessful();
    }

    // ── Authorization: view-only user sees no mutating action ──────────────

    public function test_view_only_user_sees_no_mutating_action(): void
    {
        $viewer = $this->createViewOnlyUser();
        $item = Item::factory()->Object()->create();
        $media = Link::factory()->ownedBy($item)->create();

        $this->setCurrentPanel();

        Livewire::actingAs($viewer)
            ->test(LinksRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->assertTableActionHidden('create')
            ->assertTableActionHidden('edit', $media)
            ->assertTableActionHidden('delete', $media);
    }

    public function test_crud_user_keeps_every_mutating_action(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();
        $media = Link::factory()->ownedBy($item)->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(LinksRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->assertTableActionVisible('create')
            ->assertTableActionVisible('edit', $media)
            ->assertTableActionVisible('delete', $media);
    }

    // ── Create ───────────────────────────────────────────────────────────────

    public function test_crud_user_creates_a_media_row_with_language_and_extra(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();
        $language = Language::factory()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(LinksRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->mountTableAction('create')
            ->setTableActionData([
                'type' => LinkType::VIDEO->value,
                'url' => 'https://www.youtube.com/watch?v=abc123',
                'title' => 'Conservation video',
                'language_id' => $language->id,
                'extra' => json_encode(['source' => 'youtube']),
            ])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $media = Link::where('linkable_type', 'item')->where('linkable_id', $item->id)->first();
        $this->assertNotNull($media);
        $this->assertSame('Conservation video', $media->title);
        $this->assertSame($language->id, $media->language_id);
        $this->assertSame('youtube', $media->extra?->source ?? null);
    }

    public function test_create_action_is_authorized_against_the_item_policy(): void
    {
        $viewer = $this->createViewOnlyUser();
        $item = Item::factory()->Object()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($viewer)
            ->test(LinksRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->assertTableActionHidden('create');

        $this->assertDatabaseCount('links', 0);
    }

    // ── Edit ─────────────────────────────────────────────────────────────────

    public function test_crud_user_edits_a_media_rows_language_and_extra(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();
        $originalLanguage = Language::factory()->create();
        $newLanguage = Language::factory()->create();
        $media = Link::factory()->ownedBy($item)->create([
            'language_id' => $originalLanguage->id,
            'extra' => ['source' => 'legacy'],
        ]);

        $this->setCurrentPanel();

        $component = Livewire::actingAs($user)
            ->test(LinksRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ]);

        $component->mountTableAction('edit', $media);

        $form = $component->instance()->getMountedTableActionForm();
        $this->assertNotNull($form);
        $this->assertSame($originalLanguage->id, $form->getFlatFields()['language_id']->getState());

        $component->setTableActionData([
            'type' => $media->type->value,
            'url' => $media->url,
            'title' => $media->title,
            'language_id' => $newLanguage->id,
            'display_order' => $media->display_order,
            'extra' => json_encode(['source' => 'updated']),
        ])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $media->refresh();
        $this->assertSame($newLanguage->id, $media->language_id);
        $this->assertSame('updated', $media->extra?->source ?? null);
    }

    // ── Delete ───────────────────────────────────────────────────────────────

    public function test_crud_user_deletes_a_media_row(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();
        $media = Link::factory()->ownedBy($item)->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(LinksRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->callTableAction('delete', $media)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('links', ['id' => $media->id]);
    }

    // ── Other owners ─────────────────────────────────────────────────────────

    public function test_collection_and_partner_links_are_listed_and_created(): void
    {
        $user = $this->createCrudUser();
        $collection = Collection::factory()->create();
        $partner = Partner::factory()->create();
        $document = Link::factory()->forCollection($collection)->create();
        $website = Link::factory()->forPartner($partner)->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(LinksRelationManager::class, ['ownerRecord' => $collection, 'pageClass' => ViewCollection::class])
            ->assertCanSeeTableRecords([$document])
            ->assertCanNotSeeTableRecords([$website]);

        Livewire::actingAs($user)
            ->test(LinksRelationManager::class, ['ownerRecord' => $partner, 'pageClass' => ViewPartner::class])
            ->assertCanSeeTableRecords([$website])
            ->callTableAction('create', data: [
                'type' => LinkType::WEBSITE->value,
                'url' => 'https://museum.example.org/',
                'title' => 'The museum',
            ])
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('links', [
            'linkable_type' => 'partner',
            'linkable_id' => $partner->id,
            'type' => 'website',
            'title' => 'The museum',
        ]);
    }

    public function test_an_editions_links_follow_its_publications_policy(): void
    {
        $edition = PublicationEdition::factory()->create();
        $shop = Link::factory()->forEdition($edition)->create();

        $this->setCurrentPanel();

        Livewire::actingAs($this->createViewOnlyUser())
            ->test(LinksRelationManager::class, ['ownerRecord' => $edition, 'pageClass' => ViewPublicationEdition::class])
            ->assertCanSeeTableRecords([$shop])
            ->assertTableActionHidden('create')
            ->assertTableActionHidden('edit', $shop)
            ->assertTableActionHidden('delete', $shop);

        Livewire::actingAs($this->createCrudUser())
            ->test(LinksRelationManager::class, ['ownerRecord' => $edition, 'pageClass' => ViewPublicationEdition::class])
            ->assertTableActionVisible('create')
            ->assertTableActionVisible('edit', $shop)
            ->assertTableActionVisible('delete', $shop);
    }

    public function test_an_edition_page_shows_its_links(): void
    {
        $edition = PublicationEdition::factory()->create();
        Link::factory()->forEdition($edition)->create(['title' => 'Amazon']);

        $this->actingAs($this->createViewOnlyUser());
        $this->setCurrentPanel();

        $this->get(PublicationEditionResource::getUrl('view', ['record' => $edition]))
            ->assertOk()
            ->assertSee('Links');
    }

    public function test_deleting_an_owner_deletes_its_links(): void
    {
        $item = Item::factory()->Object()->create();
        $link = Link::factory()->ownedBy($item)->create();

        $item->delete();

        $this->assertDatabaseMissing('links', ['id' => $link->id]);
    }
}
