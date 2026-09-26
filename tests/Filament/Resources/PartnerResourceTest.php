<?php

namespace Tests\Filament\Resources;

use App\Enums\Permission;
use App\Filament\Resources\ContextResource;
use App\Filament\Resources\CountryResource;
use App\Filament\Resources\LanguageResource;
use App\Filament\Resources\PartnerResource\Pages\CreatePartner;
use App\Filament\Resources\PartnerResource\Pages\EditPartner;
use App\Filament\Resources\PartnerResource\Pages\ListPartner;
use App\Filament\Resources\PartnerResource\Pages\ViewPartner;
use App\Filament\Resources\PartnerResource\RelationManagers\CollectionParticipationsRelationManager;
use App\Filament\Resources\PartnerResource\RelationManagers\OwnedItemsRelationManager;
use App\Filament\Resources\PartnerResource\RelationManagers\TranslationsRelationManager;
use App\Filament\Resources\ProjectResource;
use App\Models\Collection;
use App\Models\Context;
use App\Models\Country;
use App\Models\Item;
use App\Models\Language;
use App\Models\Partner;
use App\Models\Project;
use App\Models\User;
use Filament\Tables\Actions\DeleteAction;
use Filament\Tables\Columns\TextColumn;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

class PartnerResourceTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_authorized_users_can_render_all_partner_resource_pages_and_relation_managers(): void
    {
        $user = $this->createCrudUser();
        $country = Country::factory()->create(['id' => 'jor', 'internal_name' => 'Jordan']);
        $context = Context::factory()->create(['internal_name' => 'Catalogue']);
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);
        $project = Project::factory()->create(['internal_name' => 'Temple catalogue']);
        $monument = Item::factory()->Monument()->create(['internal_name' => 'Great monument']);
        $partner = Partner::factory()->create([
            'internal_name' => 'Jordan Museum',
            'type' => 'museum',
            'country_id' => $country->id,
            'project_id' => $project->id,
            'monument_item_id' => $monument->id,
            'visible' => true,
        ]);
        $ownedItem = Item::factory()->Object()->create([
            'partner_id' => $partner->id,
            'project_id' => $project->id,
            'internal_name' => 'Relief fragment',
        ]);
        $collection = Collection::factory()->create([
            'internal_name' => 'Temple collection',
            'context_id' => $context->id,
            'language_id' => $language->id,
        ]);
        $partner->collections()->attach($collection->id, [
            'collection_type' => 'collection',
            'level' => 'partner',
            'visible' => true,
        ]);
        $partner->translations()->create([
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Jordan Museum',
            'description' => 'Museum description',
        ]);

        $this->actingAs($user)->get('/admin/partners')
            ->assertOk()
            ->assertSee('Partners');

        $this->actingAs($user)->get('/admin/partners/create')
            ->assertOk()
            ->assertSee('Create');

        $this->actingAs($user)->get("/admin/partners/{$partner->getKey()}/edit")
            ->assertOk()
            ->assertSee('Jordan Museum')
            ->assertSee('Owned items')
            ->assertSee('Collection participations')
            ->assertSee('Translations');

        $this->actingAs($user)->get("/admin/partners/{$partner->getKey()}")
            ->assertOk()
            ->assertSee('Jordan Museum')
            ->assertSee('Partner')
            ->assertSee('Owned items')
            ->assertSee('Collection participations')
            ->assertSee('Legacy links');

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(OwnedItemsRelationManager::class, [
                'ownerRecord' => $partner,
                'pageClass' => ViewPartner::class,
            ])
            ->assertCanSeeTableRecords([$ownedItem]);

        Livewire::actingAs($user)
            ->test(CollectionParticipationsRelationManager::class, [
                'ownerRecord' => $partner,
                'pageClass' => ViewPartner::class,
            ])
            ->assertCanSeeTableRecords([$collection]);
    }

    public function test_authorized_users_can_create_edit_and_delete_partners(): void
    {
        $user = $this->createCrudUser();
        $country = Country::factory()->create(['id' => 'jor', 'internal_name' => 'Jordan']);
        $project = Project::factory()->create(['internal_name' => 'Temple catalogue']);
        $monument = Item::factory()->Monument()->create(['internal_name' => 'Great monument']);
        $partner = Partner::factory()->create([
            'internal_name' => 'Jordan Museum',
            'type' => 'museum',
            'country_id' => $country->id,
            'project_id' => $project->id,
            'monument_item_id' => $monument->id,
            'visible' => false,
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CreatePartner::class)
            ->fillForm([
                'internal_name' => 'Petra Institute',
                'type' => 'institution',
                'backward_compatibility' => 'par-02',
                'country_id' => $country->id,
                'latitude' => 31.95,
                'longitude' => 35.91,
                'map_zoom' => 12,
                'project_id' => $project->id,
                'monument_item_id' => $monument->id,
                'visible' => true,
            ])
            ->call('create')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('partners', [
            'internal_name' => 'Petra Institute',
            'type' => 'institution',
            'backward_compatibility' => 'par-02',
            'country_id' => $country->id,
            'project_id' => $project->id,
            'monument_item_id' => $monument->id,
            'visible' => true,
        ]);

        Livewire::actingAs($user)
            ->test(EditPartner::class, [
                'record' => $partner->getRouteKey(),
            ])
            ->assertFormSet([
                'internal_name' => 'Jordan Museum',
                'type' => 'museum',
                'country_id' => $country->id,
                'project_id' => $project->id,
                'monument_item_id' => $monument->id,
                'visible' => false,
            ])
            ->fillForm([
                'internal_name' => 'Jordan Heritage Museum',
                'type' => 'museum',
                'backward_compatibility' => 'par-11',
                'country_id' => $country->id,
                'latitude' => 31.96,
                'longitude' => 35.92,
                'map_zoom' => 13,
                'project_id' => $project->id,
                'monument_item_id' => $monument->id,
                'visible' => true,
            ])
            ->call('save')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('partners', [
            'id' => $partner->id,
            'internal_name' => 'Jordan Heritage Museum',
            'backward_compatibility' => 'par-11',
            'visible' => true,
        ]);

        Livewire::actingAs($user)
            ->test(ListPartner::class)
            ->callTableAction(DeleteAction::class, $partner)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('partners', [
            'id' => $partner->id,
        ]);
    }

    public function test_partner_translations_relation_manager_supports_crud_operations(): void
    {
        $user = $this->createCrudUser();
        $partner = Partner::factory()->create(['internal_name' => 'Jordan Museum']);
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);
        $context = Context::factory()->create(['internal_name' => 'Catalogue']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(TranslationsRelationManager::class, [
                'ownerRecord' => $partner,
                'pageClass' => EditPartner::class,
            ])
            ->mountTableAction('create')
            ->setTableActionData([
                'language_id' => $language->id,
                'context_id' => $context->id,
                'name' => 'Jordan Museum',
                'description' => 'Museum description',
            ])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $translation = $partner->translations()->firstOrFail();

        Livewire::actingAs($user)
            ->test(TranslationsRelationManager::class, [
                'ownerRecord' => $partner,
                'pageClass' => EditPartner::class,
            ])
            ->callTableAction(DeleteAction::class, $translation->fresh())
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('partner_translations', [
            'id' => $translation->id,
        ]);
    }

    public function test_partner_table_filter_has_fallback_translation(): void
    {
        $user = $this->createCrudUser();
        $defaultLang = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $defaultCtx = Context::factory()->create(['internal_name' => 'Default context', 'is_default' => true]);

        $partnerWithFallback = Partner::factory()->create(['internal_name' => 'Partner A']);
        $partnerWithFallback->translations()->create([
            'language_id' => $defaultLang->id,
            'context_id' => $defaultCtx->id,
            'name' => 'Partner A name',
        ]);

        $partnerWithoutFallback = Partner::factory()->create(['internal_name' => 'Partner B']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListPartner::class)
            ->filterTable('has_fallback_translation')
            ->assertCanSeeTableRecords([$partnerWithFallback])
            ->assertCanNotSeeTableRecords([$partnerWithoutFallback]);
    }

    public function test_partner_table_filter_missing_fallback_translation(): void
    {
        $user = $this->createCrudUser();
        $defaultLang = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $defaultCtx = Context::factory()->create(['internal_name' => 'Default context', 'is_default' => true]);

        $partnerWithFallback = Partner::factory()->create(['internal_name' => 'Partner A']);
        $partnerWithFallback->translations()->create([
            'language_id' => $defaultLang->id,
            'context_id' => $defaultCtx->id,
            'name' => 'Partner A name',
        ]);

        $partnerWithoutFallback = Partner::factory()->create(['internal_name' => 'Partner B']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListPartner::class)
            ->filterTable('missing_fallback_translation')
            ->assertCanSeeTableRecords([$partnerWithoutFallback])
            ->assertCanNotSeeTableRecords([$partnerWithFallback]);
    }

    public function test_partner_table_filter_has_translation_in_non_default_language(): void
    {
        $user = $this->createCrudUser();
        $langEn = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $langFr = Language::factory()->create(['id' => 'fra', 'internal_name' => 'French', 'is_default' => false]);
        $ctx = Context::factory()->create(['internal_name' => 'Default context', 'is_default' => true]);

        $partnerEn = Partner::factory()->create(['internal_name' => 'English partner']);
        $partnerEn->translations()->create([
            'language_id' => $langEn->id,
            'context_id' => $ctx->id,
            'name' => 'English partner name',
        ]);

        $partnerFr = Partner::factory()->create(['internal_name' => 'French partner']);
        $partnerFr->translations()->create([
            'language_id' => $langFr->id,
            'context_id' => $ctx->id,
            'name' => 'French partner name',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListPartner::class)
            ->filterTable('translation_language_has', $langFr->id)
            ->assertCanSeeTableRecords([$partnerFr])
            ->assertCanNotSeeTableRecords([$partnerEn]);
    }

    public function test_partner_table_filter_has_translation_in_non_default_context(): void
    {
        $user = $this->createCrudUser();
        $lang = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $ctxDefault = Context::factory()->create(['internal_name' => 'Default context', 'is_default' => true]);
        $ctxCatalogue = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => false]);

        $partnerDefault = Partner::factory()->create(['internal_name' => 'Default partner']);
        $partnerDefault->translations()->create([
            'language_id' => $lang->id,
            'context_id' => $ctxDefault->id,
            'name' => 'Default partner name',
        ]);

        $partnerCatalogue = Partner::factory()->create(['internal_name' => 'Catalogue partner']);
        $partnerCatalogue->translations()->create([
            'language_id' => $lang->id,
            'context_id' => $ctxCatalogue->id,
            'name' => 'Catalogue partner name',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListPartner::class)
            ->filterTable('translation_context_has', $ctxCatalogue->id)
            ->assertCanSeeTableRecords([$partnerCatalogue])
            ->assertCanNotSeeTableRecords([$partnerDefault]);
    }

    public function test_partner_table_country_column_links_to_country_resource_with_manage_reference_data(): void
    {
        $user = $this->createViewAndReferenceDataUser();

        $country = Country::factory()->create(['id' => 'jor', 'internal_name' => 'Jordan']);
        $partner = Partner::factory()->create(['country_id' => $country->id]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListPartner::class)
            ->assertTableColumnExists(
                'country.internal_name',
                fn (TextColumn $column): bool => $column->getUrl() === CountryResource::getUrl('view', ['record' => $country]),
                $partner
            );
    }

    public function test_partner_table_country_column_is_plain_text_without_manage_reference_data(): void
    {
        $user = $this->createCrudUser();
        $country = Country::factory()->create(['id' => 'jor', 'internal_name' => 'Jordan']);
        $partner = Partner::factory()->create(['country_id' => $country->id]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListPartner::class)
            ->assertTableColumnExists(
                'country.internal_name',
                fn (TextColumn $column): bool => $column->getUrl() === null,
                $partner
            );
    }

    public function test_partner_table_project_column_links_to_project_resource_for_authorized_user(): void
    {
        $user = $this->createCrudUser();
        $project = Project::factory()->create(['internal_name' => 'Temple catalogue']);
        $partner = Partner::factory()->create(['project_id' => $project->id]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListPartner::class)
            ->assertTableColumnExists(
                'project.internal_name',
                fn (TextColumn $column): bool => $column->getUrl() === ProjectResource::getUrl('view', ['record' => $project]),
                $partner
            );
    }

    public function test_partner_translations_relation_manager_language_badge_links_to_language_resource(): void
    {
        $user = $this->createViewAndReferenceDataUser();

        $partner = Partner::factory()->create(['internal_name' => 'Jordan Museum']);
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue']);
        $translation = $partner->translations()->create([
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Jordan Museum',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(TranslationsRelationManager::class, [
                'ownerRecord' => $partner,
                'pageClass' => EditPartner::class,
            ])
            ->assertTableColumnExists(
                'language.internal_name',
                fn (TextColumn $column): bool => $column->getUrl() === LanguageResource::getUrl('view', ['record' => $language]),
                $translation
            );
    }

    public function test_partner_translations_relation_manager_context_badge_links_to_context_resource(): void
    {
        $user = $this->createViewAndReferenceDataUser();

        $partner = Partner::factory()->create(['internal_name' => 'Jordan Museum']);
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English', 'is_default' => true]);
        $context = Context::factory()->create(['internal_name' => 'Catalogue', 'is_default' => false]);
        $translation = $partner->translations()->create([
            'language_id' => $language->id,
            'context_id' => $context->id,
            'name' => 'Jordan Museum',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(TranslationsRelationManager::class, [
                'ownerRecord' => $partner,
                'pageClass' => EditPartner::class,
            ])
            ->assertTableColumnExists(
                'context.internal_name',
                fn (TextColumn $column): bool => $column->getUrl() === ContextResource::getUrl('view', ['record' => $context]),
                $translation
            );
    }

    public function test_owned_items_relation_manager_project_column_links_to_project_resource(): void
    {
        $user = $this->createCrudUser();
        $project = Project::factory()->create(['internal_name' => 'Temple catalogue']);
        $partner = Partner::factory()->create(['internal_name' => 'Jordan Museum']);
        $item = Item::factory()->Object()->create([
            'partner_id' => $partner->id,
            'project_id' => $project->id,
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(OwnedItemsRelationManager::class, [
                'ownerRecord' => $partner,
                'pageClass' => ViewPartner::class,
            ])
            ->assertTableColumnExists(
                'project.internal_name',
                fn (TextColumn $column): bool => $column->getUrl() === ProjectResource::getUrl('view', ['record' => $project]),
                $item
            );
    }

    protected function createViewAndReferenceDataUser(): User
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo([
            Permission::ACCESS_ADMIN_PANEL->value,
            Permission::VIEW_DATA->value,
            Permission::MANAGE_REFERENCE_DATA->value,
        ]);

        return $user;
    }
}
