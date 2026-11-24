<?php

namespace Tests\Filament\Resources;

use Filament\Actions\DeleteAction;
use Filament\Actions\CreateAction;
use Filament\Actions\EditAction;
use Filament\Actions\DetachAction;
use Filament\Actions\ViewAction;
use App\Enums\Permission;
use App\Filament\Resources\DynastyResource;
use App\Filament\Resources\DynastyResource\Pages\CreateDynasty;
use App\Filament\Resources\DynastyResource\Pages\EditDynasty;
use App\Filament\Resources\DynastyResource\Pages\ListDynasty;
use App\Filament\Resources\DynastyResource\Pages\ViewDynasty;
use App\Filament\Resources\DynastyResource\RelationManagers\ItemsRelationManager;
use App\Filament\Resources\DynastyResource\RelationManagers\TranslationsRelationManager;
use App\Filament\Resources\ItemResource\Pages\ViewItem;
use App\Filament\Resources\ItemResource\RelationManagers\DynastiesRelationManager;
use App\Models\Author;
use App\Models\Dynasty;
use App\Models\DynastyTranslation;
use App\Models\Item;
use App\Models\Language;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

class DynastyResourceTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    private function english(): Language
    {
        return Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
    }

    private function dynastyNamed(string $name, ?Language $language = null): Dynasty
    {
        $dynasty = Dynasty::factory()->create(['from_ad' => 1299, 'to_ad' => 1922]);
        DynastyTranslation::factory()->create([
            'dynasty_id' => $dynasty->id,
            'language_id' => ($language ?? $this->english())->id,
            'name' => $name,
        ]);

        return $dynasty;
    }

    // ── Access ───────────────────────────────────────────────────────────────

    public function test_reference_data_user_can_render_every_page(): void
    {
        $user = $this->createReferenceDataUser();
        $dynasty = $this->dynastyNamed('Ottomans');
        $this->setCurrentPanel();

        $this->actingAs($user)->get(DynastyResource::getUrl('index'))
            ->assertOk()
            ->assertSee('Ottomans');

        $this->actingAs($user)->get(DynastyResource::getUrl('create'))
            ->assertOk();

        $this->actingAs($user)->get(DynastyResource::getUrl('edit', ['record' => $dynasty]))
            ->assertOk()
            ->assertSee('Ottomans');

        $this->actingAs($user)->get(DynastyResource::getUrl('view', ['record' => $dynasty]))
            ->assertOk()
            ->assertSee('Ottomans');
    }

    public function test_a_visitor_reads_the_resource_but_cannot_change_it(): void
    {
        $dynasty = Dynasty::factory()->create();
        $this->setCurrentPanel();
        $visitor = $this->createViewOnlyUser();

        $this->actingAs($visitor)->get(DynastyResource::getUrl('index'))->assertOk();
        $this->actingAs($visitor)->get(DynastyResource::getUrl('view', ['record' => $dynasty]))->assertOk();
        $this->actingAs($visitor)->get(DynastyResource::getUrl('create'))->assertForbidden();
        $this->actingAs($visitor)->get(DynastyResource::getUrl('edit', ['record' => $dynasty]))->assertForbidden();
    }

    public function test_navigation_follows_the_policy(): void
    {
        $this->actingAs($this->createViewOnlyUser());
        $this->assertTrue(DynastyResource::canViewAny());
        $this->assertTrue(DynastyResource::shouldRegisterNavigation());

        $panelOnly = User::factory()->create();
        $panelOnly->givePermissionTo(Permission::ACCESS_ADMIN_PANEL->value);
        $this->actingAs($panelOnly);
        $this->assertFalse(DynastyResource::canViewAny());
        $this->assertFalse(DynastyResource::shouldRegisterNavigation());

        $this->assertSame('Shared Data', DynastyResource::getNavigationGroup());
    }

    // ── List, create, edit, delete ───────────────────────────────────────────

    public function test_list_shows_the_translated_name_and_searches_it(): void
    {
        $user = $this->createReferenceDataUser();
        $english = $this->english();
        $ottomans = $this->dynastyNamed('Ottomans', $english);
        $ottomans->items()->attach(Item::factory()->count(2)->create()->pluck('id')->all());
        $mamluks = $this->dynastyNamed('Mamluks', $english);
        $untranslated = Dynasty::factory()->create(['backward_compatibility' => 'mwnf3:dynasties:99']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListDynasty::class)
            ->assertCanSeeTableRecords([$ottomans, $mamluks, $untranslated])
            ->assertTableColumnStateSet('display_label', 'Ottomans', $ottomans->getKey())
            ->assertTableColumnStateSet('display_label', 'mwnf3:dynasties:99', $untranslated->getKey())
            ->assertTableColumnStateSet('items_count', 2, $ottomans->getKey())
            ->searchTable('Mamluk')
            ->assertCanSeeTableRecords([$mamluks])
            ->assertCanNotSeeTableRecords([$ottomans, $untranslated]);
    }

    public function test_list_sorts_by_the_translated_name(): void
    {
        $user = $this->createReferenceDataUser();
        $english = $this->english();
        $b = $this->dynastyNamed('Buyids', $english);
        $a = $this->dynastyNamed('Abbasids', $english);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListDynasty::class)
            ->sortTable('display_label')
            ->assertCanSeeTableRecords([$a, $b], inOrder: true)
            ->sortTable('display_label', 'desc')
            ->assertCanSeeTableRecords([$b, $a], inOrder: true);
    }

    public function test_reference_data_user_creates_and_edits_a_dynasty(): void
    {
        $user = $this->createReferenceDataUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CreateDynasty::class)
            ->fillForm([
                'from_ad' => 1250,
                'to_ad' => 1517,
                'from_ah' => 648,
                'to_ah' => 923,
                'backward_compatibility' => 'mwnf3:dynasties:7',
            ])
            ->call('create')
            ->assertHasNoFormErrors();

        $dynasty = Dynasty::query()->where('backward_compatibility', 'mwnf3:dynasties:7')->firstOrFail();
        $this->assertSame([1250, 1517, 648, 923], [$dynasty->from_ad, $dynasty->to_ad, $dynasty->from_ah, $dynasty->to_ah]);

        Livewire::actingAs($user)
            ->test(EditDynasty::class, ['record' => $dynasty->getRouteKey()])
            ->assertFormSet(['from_ad' => 1250, 'backward_compatibility' => 'mwnf3:dynasties:7'])
            ->fillForm(['to_ad' => 1516])
            ->call('save')
            ->assertHasNoFormErrors();

        $this->assertSame(1516, $dynasty->refresh()->to_ad);
    }

    public function test_dates_must_be_whole_numbers(): void
    {
        $this->setCurrentPanel();

        Livewire::actingAs($this->createReferenceDataUser())
            ->test(CreateDynasty::class)
            ->fillForm(['from_ad' => 'thirteenth century'])
            ->call('create')
            ->assertHasFormErrors(['from_ad']);
    }

    public function test_view_page_and_record_title_use_the_translated_name(): void
    {
        $user = $this->createReferenceDataUser();
        $dynasty = $this->dynastyNamed('Safavids');

        $this->setCurrentPanel();

        $this->assertSame('Safavids', DynastyResource::getRecordTitle($dynasty->load('translations')));

        Livewire::actingAs($user)
            ->test(ViewDynasty::class, ['record' => $dynasty->getRouteKey()])
            ->assertSee('Safavids')
            ->assertSee('1299');
    }

    public function test_global_search_finds_a_dynasty_by_its_translated_name(): void
    {
        $dynasty = $this->dynastyNamed('Umayyads');
        Dynasty::factory()->create(['backward_compatibility' => 'mwnf3:dynasties:1']);

        $this->setCurrentPanel();
        $this->actingAs($this->createReferenceDataUser());

        $results = DynastyResource::getGlobalSearchResults('Umayy');

        $this->assertCount(1, $results);
        $this->assertSame('Umayyads', (string) $results->first()?->title);
        $this->assertSame(DynastyResource::getUrl('edit', ['record' => $dynasty]), $results->first()?->url);
    }

    public function test_deleting_a_dynasty_removes_its_translations_and_links_but_keeps_the_items(): void
    {
        $user = $this->createReferenceDataUser();
        $dynasty = $this->dynastyNamed('Timurids');
        $item = Item::factory()->create();
        $dynasty->items()->attach($item->id);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListDynasty::class)
            ->mountTableAction(DeleteAction::class, $dynasty)
            ->assertSee('This dynasty is linked to 1 item.')
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $this->assertModelMissing($dynasty);
        $this->assertDatabaseMissing('dynasty_translations', ['dynasty_id' => $dynasty->id]);
        $this->assertDatabaseMissing('item_dynasty', ['dynasty_id' => $dynasty->id]);
        $this->assertModelExists($item);
    }

    // ── Translations relation manager ────────────────────────────────────────

    public function test_reference_data_user_adds_edits_and_deletes_a_translation(): void
    {
        $user = $this->createReferenceDataUser();
        $english = $this->english();
        $dynasty = Dynasty::factory()->create();
        $author = Author::factory()->create();
        $editor = Author::factory()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(TranslationsRelationManager::class, ['ownerRecord' => $dynasty, 'pageClass' => ViewDynasty::class])
            ->callTableAction(CreateAction::class, data: [
                'language_id' => $english->id,
                'name' => 'Ottomans',
                'also_known_as' => 'Osmanlı',
                'area' => 'Anatolia, the Balkans',
                'history' => '<p>Founded by Osman I.</p>',
                'date_description_ad' => '1299–1922',
                'date_description_ah' => '699–1341',
                'author_id' => $author->id,
                'text_copy_editor_id' => $editor->id,
            ])
            ->assertHasNoTableActionErrors();

        $translation = DynastyTranslation::query()->where('dynasty_id', $dynasty->id)->firstOrFail();
        $this->assertSame('Ottomans', $translation->name);
        $this->assertSame('<p>Founded by Osman I.</p>', $translation->getAttribute('history'));
        $this->assertSame($author->id, $translation->getAttribute('author_id'));
        $this->assertSame($editor->id, $translation->getAttribute('text_copy_editor_id'));

        Livewire::actingAs($user)
            ->test(TranslationsRelationManager::class, ['ownerRecord' => $dynasty, 'pageClass' => ViewDynasty::class])
            ->callTableAction(EditAction::class, $translation, data: ['name' => 'Ottoman Empire'])
            ->assertHasNoTableActionErrors();

        $this->assertSame('Ottoman Empire', $translation->refresh()->name);

        Livewire::actingAs($user)
            ->test(TranslationsRelationManager::class, ['ownerRecord' => $dynasty, 'pageClass' => ViewDynasty::class])
            ->callTableAction(DeleteAction::class, $translation)
            ->assertHasNoTableActionErrors();

        $this->assertModelMissing($translation);
    }

    public function test_one_translation_per_language(): void
    {
        $user = $this->createReferenceDataUser();
        $english = $this->english();
        $dynasty = $this->dynastyNamed('Ayyubids', $english);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(TranslationsRelationManager::class, ['ownerRecord' => $dynasty, 'pageClass' => ViewDynasty::class])
            ->callTableAction(CreateAction::class, data: [
                'language_id' => $english->id,
                'name' => 'Ayyubids again',
            ])
            ->assertHasTableActionErrors(['language_id' => 'unique']);
    }

    public function test_translations_need_update_on_the_dynasty(): void
    {
        $dynasty = $this->dynastyNamed('Fatimids');
        $translation = $dynasty->translations()->firstOrFail();

        $this->setCurrentPanel();

        Livewire::actingAs($this->createViewOnlyUser())
            ->test(TranslationsRelationManager::class, ['ownerRecord' => $dynasty, 'pageClass' => ViewDynasty::class])
            ->assertTableActionHidden(CreateAction::class)
            ->assertTableActionHidden(EditAction::class, $translation)
            ->assertTableActionHidden(DeleteAction::class, $translation);

        Livewire::actingAs($this->createReferenceDataUser())
            ->test(TranslationsRelationManager::class, ['ownerRecord' => $dynasty, 'pageClass' => ViewDynasty::class])
            ->assertTableActionVisible(CreateAction::class)
            ->assertTableActionVisible(EditAction::class, $translation)
            ->assertTableActionVisible(DeleteAction::class, $translation);
    }

    // ── Items relation manager (the dynasty's side) ──────────────────────────

    public function test_reference_data_user_attaches_and_detaches_items_from_the_view_page(): void
    {
        $user = $this->createReferenceDataCrudUser();
        $dynasty = Dynasty::factory()->create();
        $item = Item::factory()->Object()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ItemsRelationManager::class, ['ownerRecord' => $dynasty, 'pageClass' => ViewDynasty::class])
            ->callTableAction('attach', data: ['recordId' => $item->id])
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('item_dynasty', ['dynasty_id' => $dynasty->id, 'item_id' => $item->id]);

        Livewire::actingAs($user)
            ->test(ItemsRelationManager::class, ['ownerRecord' => $dynasty, 'pageClass' => ViewDynasty::class])
            ->callTableAction(DetachAction::class, $item->getKey())
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('item_dynasty', ['dynasty_id' => $dynasty->id, 'item_id' => $item->id]);
        $this->assertModelExists($item);
    }

    public function test_items_relation_manager_needs_update_on_the_dynasty(): void
    {
        $dynasty = Dynasty::factory()->create();
        $item = Item::factory()->Object()->create();
        $dynasty->items()->attach($item->id);

        $this->setCurrentPanel();

        Livewire::actingAs($this->createViewOnlyUser())
            ->test(ItemsRelationManager::class, ['ownerRecord' => $dynasty, 'pageClass' => ViewDynasty::class])
            ->assertTableActionHidden('attach')
            ->assertTableActionHidden('detach', $item->getKey());

        Livewire::actingAs($this->createReferenceDataCrudUser())
            ->test(ItemsRelationManager::class, ['ownerRecord' => $dynasty, 'pageClass' => ViewDynasty::class])
            ->assertTableActionVisible('attach')
            ->assertTableActionVisible('detach', $item->getKey());
    }

    // ── The item's Dynasties manager links to this resource ──────────────────

    public function test_item_dynasties_view_opens_the_dynasty_page_for_a_reference_data_user(): void
    {
        $item = Item::factory()->Object()->create();
        $dynasty = $this->dynastyNamed('Seljuks');
        $item->dynasties()->attach($dynasty->id);

        $this->setCurrentPanel();

        Livewire::actingAs($this->createReferenceDataCrudUser())
            ->test(DynastiesRelationManager::class, ['ownerRecord' => $item, 'pageClass' => ViewItem::class])
            ->assertTableActionHasUrl(ViewAction::class, DynastyResource::getUrl('view', ['record' => $dynasty]), $dynasty->getKey());

        Livewire::actingAs($this->createViewOnlyUser())
            ->test(DynastiesRelationManager::class, ['ownerRecord' => $item, 'pageClass' => ViewItem::class])
            ->assertTableActionVisible(ViewAction::class, $dynasty->getKey())
            ->assertTableActionHasUrl(ViewAction::class, DynastyResource::getUrl('view', ['record' => $dynasty]), $dynasty->getKey());
    }
}
