<?php

namespace Tests\Filament\RelationManagers;

use App\Filament\Resources\CollectionResource\Pages\ViewCollection;
use App\Filament\Resources\CollectionResource\RelationManagers\TranslationsRelationManager as CollectionTranslationsRelationManager;
use App\Filament\Resources\CollectionTranslationResource;
use App\Filament\Resources\ItemResource\Pages\ViewItem;
use App\Filament\Resources\ItemResource\RelationManagers\TranslationsRelationManager as ItemTranslationsRelationManager;
use App\Filament\Resources\ItemTranslationResource;
use App\Filament\Resources\PartnerResource\Pages\ViewPartner;
use App\Filament\Resources\PartnerResource\RelationManagers\TranslationsRelationManager as PartnerTranslationsRelationManager;
use App\Filament\Resources\PartnerTranslationResource;
use App\Filament\Support\ResourceCreateUrl;
use App\Models\Collection;
use App\Models\Context;
use App\Models\Item;
use App\Models\Language;
use App\Models\Partner;
use Filament\Tables\Actions\Action;
use Filament\Tables\Actions\DeleteAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * M7 Story A3.1 (#1904): Collection, Partner and Item TranslationsRelationManager
 * replace the inline `Create` form with navigation to the matching
 * `*TranslationResource` Create page (parent pre-filled). `createDefaultTranslation`
 * (one click, no form) and `Delete` stay unchanged.
 *
 * Mounted on the View pages (ViewCollection, ViewItem, ViewPartner), matching
 * where a user actually lands per M7 story A0.6 (#1895).
 */
class OwnerTranslationsCreateNavigationTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    // ── Collection ───────────────────────────────────────────────────────────

    public function test_collection_translations_create_action_navigates_to_resource_create_page(): void
    {
        $user = $this->createCrudUser();
        $collection = $this->makeCollection();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CollectionTranslationsRelationManager::class, [
                'ownerRecord' => $collection,
                'pageClass' => ViewCollection::class,
            ])
            ->assertTableActionExists('create', fn (Action $action): bool => $action->getUrl() === ResourceCreateUrl::for(
                CollectionTranslationResource::class,
                ['collection_id' => $collection->id]
            ));
    }

    public function test_collection_translations_create_default_translation_still_creates_without_a_form(): void
    {
        $user = $this->createCrudUser();
        $collection = $this->makeCollection();
        $language = Language::factory()->create(['id' => 'fra', 'internal_name' => 'French', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Default context', 'is_default' => true]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CollectionTranslationsRelationManager::class, [
                'ownerRecord' => $collection,
                'pageClass' => ViewCollection::class,
            ])
            ->mountTableAction('createDefaultTranslation')
            ->setTableActionData([
                'language_id' => $language->id,
                'context_id' => $context->id,
                'title' => 'Temple of Amman',
            ])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('collection_translations', [
            'collection_id' => $collection->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'title' => 'Temple of Amman',
        ]);
    }

    public function test_collection_translations_delete_still_deletes(): void
    {
        $user = $this->createCrudUser();
        $collection = $this->makeCollection();
        $language = Language::factory()->create(['id' => 'fra', 'internal_name' => 'French']);
        $context = Context::factory()->create();
        $translation = $collection->translations()->create([
            'language_id' => $language->id,
            'context_id' => $context->id,
            'title' => 'Le titre',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CollectionTranslationsRelationManager::class, [
                'ownerRecord' => $collection,
                'pageClass' => ViewCollection::class,
            ])
            ->callTableAction(DeleteAction::class, $translation)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('collection_translations', ['id' => $translation->id]);
    }

    public function test_collection_translations_view_only_user_sees_no_mutating_action(): void
    {
        $collection = $this->makeCollection();
        $language = Language::factory()->create(['id' => 'fra', 'internal_name' => 'French']);
        $context = Context::factory()->create();
        $translation = $collection->translations()->create([
            'language_id' => $language->id,
            'context_id' => $context->id,
            'title' => 'Le titre',
        ]);
        $user = $this->createViewOnlyUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CollectionTranslationsRelationManager::class, [
                'ownerRecord' => $collection,
                'pageClass' => ViewCollection::class,
            ])
            ->assertTableActionHidden('create')
            ->assertTableActionHidden('createDefaultTranslation')
            ->assertTableActionHidden('editTranslation', $translation)
            ->assertTableActionHidden('delete', $translation);
    }

    // ── Item ─────────────────────────────────────────────────────────────────

    public function test_item_translations_create_action_navigates_to_resource_create_page(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ItemTranslationsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->assertTableActionExists('create', fn (Action $action): bool => $action->getUrl() === ResourceCreateUrl::for(
                ItemTranslationResource::class,
                ['item_id' => $item->id]
            ));
    }

    public function test_item_translations_table_keeps_its_alternate_name_column(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ItemTranslationsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->assertTableColumnExists('alternate_name');
    }

    public function test_item_translations_create_default_translation_still_creates_without_a_form(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Default context', 'is_default' => true]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ItemTranslationsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->mountTableAction('createDefaultTranslation')
            ->setTableActionData([
                'language_id' => $language->id,
                'context_id' => $context->id,
                'name' => 'Temple Relief',
            ])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('item_translations', [
            'item_id' => $item->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Temple Relief',
        ]);
    }

    public function test_item_translations_delete_still_deletes(): void
    {
        $user = $this->createCrudUser();
        $item = Item::factory()->Object()->create();
        $language = Language::factory()->create(['id' => 'fra', 'internal_name' => 'French']);
        $context = Context::factory()->create();
        $translation = $item->translations()->create([
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Nom',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ItemTranslationsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->callTableAction(DeleteAction::class, $translation)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('item_translations', ['id' => $translation->id]);
    }

    public function test_item_translations_view_only_user_sees_no_mutating_action(): void
    {
        $item = Item::factory()->Object()->create();
        $language = Language::factory()->create(['id' => 'fra', 'internal_name' => 'French']);
        $context = Context::factory()->create();
        $translation = $item->translations()->create([
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Nom',
        ]);
        $user = $this->createViewOnlyUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ItemTranslationsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->assertTableActionHidden('create')
            ->assertTableActionHidden('createDefaultTranslation')
            ->assertTableActionHidden('editTranslation', $translation)
            ->assertTableActionHidden('delete', $translation);
    }

    // ── Partner ──────────────────────────────────────────────────────────────

    public function test_partner_translations_create_action_navigates_to_resource_create_page(): void
    {
        $user = $this->createCrudUser();
        $partner = Partner::factory()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(PartnerTranslationsRelationManager::class, [
                'ownerRecord' => $partner,
                'pageClass' => ViewPartner::class,
            ])
            ->assertTableActionExists('create', fn (Action $action): bool => $action->getUrl() === ResourceCreateUrl::for(
                PartnerTranslationResource::class,
                ['partner_id' => $partner->id]
            ));
    }

    public function test_partner_translations_create_default_translation_still_creates_without_a_form(): void
    {
        $user = $this->createCrudUser();
        $partner = Partner::factory()->create();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Default context', 'is_default' => true]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(PartnerTranslationsRelationManager::class, [
                'ownerRecord' => $partner,
                'pageClass' => ViewPartner::class,
            ])
            ->mountTableAction('createDefaultTranslation')
            ->setTableActionData([
                'language_id' => $language->id,
                'context_id' => $context->id,
                'name' => 'Jordan Museum',
            ])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('partner_translations', [
            'partner_id' => $partner->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Jordan Museum',
        ]);
    }

    public function test_partner_translations_delete_still_deletes(): void
    {
        $user = $this->createCrudUser();
        $partner = Partner::factory()->create();
        $language = Language::factory()->create(['id' => 'fra', 'internal_name' => 'French']);
        $context = Context::factory()->create();
        $translation = $partner->translations()->create([
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Nom',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(PartnerTranslationsRelationManager::class, [
                'ownerRecord' => $partner,
                'pageClass' => ViewPartner::class,
            ])
            ->callTableAction(DeleteAction::class, $translation)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('partner_translations', ['id' => $translation->id]);
    }

    public function test_partner_translations_view_only_user_sees_no_mutating_action(): void
    {
        $partner = Partner::factory()->create();
        $language = Language::factory()->create(['id' => 'fra', 'internal_name' => 'French']);
        $context = Context::factory()->create();
        $translation = $partner->translations()->create([
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Nom',
        ]);
        $user = $this->createViewOnlyUser();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(PartnerTranslationsRelationManager::class, [
                'ownerRecord' => $partner,
                'pageClass' => ViewPartner::class,
            ])
            ->assertTableActionHidden('create')
            ->assertTableActionHidden('createDefaultTranslation')
            ->assertTableActionHidden('editTranslation', $translation)
            ->assertTableActionHidden('delete', $translation);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function makeCollection(): Collection
    {
        $context = Context::factory()->create();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);

        return Collection::factory()->create([
            'context_id' => $context->id,
            'language_id' => $language->id,
        ]);
    }
}
