<?php

namespace Tests\Filament\Resources;

use App\Enums\ContributorCategory;
use App\Filament\Resources\CollectionResource\Pages\ViewCollection;
use App\Filament\Resources\CollectionResource\RelationManagers\ContributorsRelationManager;
use App\Filament\Resources\ContributorResource;
use App\Filament\Resources\ContributorResource\Pages\CreateContributor;
use App\Filament\Resources\ContributorResource\Pages\EditContributor;
use App\Filament\Resources\ContributorResource\Pages\ListContributor;
use App\Filament\Resources\ContributorResource\Pages\ViewContributor;
use App\Filament\Resources\ContributorResource\RelationManagers\TranslationsRelationManager;
use App\Models\Collection;
use App\Models\Context;
use App\Models\Contributor;
use App\Models\ContributorImage;
use App\Models\Language;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

class ContributorResourceTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_authorized_users_can_render_all_contributor_pages(): void
    {
        $user = $this->createCrudUser();
        $contributor = Contributor::factory()->create(['internal_name' => 'Curated by', 'category' => 'curated_by']);

        $this->actingAs($user)->get(ContributorResource::getUrl('index'))
            ->assertOk()
            ->assertSee('Contributors');

        $this->actingAs($user)->get(ContributorResource::getUrl('create'))
            ->assertOk();

        $this->actingAs($user)->get(ContributorResource::getUrl('edit', ['record' => $contributor]))
            ->assertOk()
            ->assertSee('Curated by');

        $this->actingAs($user)->get(ContributorResource::getUrl('view', ['record' => $contributor]))
            ->assertOk()
            ->assertSee('Curated by');
    }

    public function test_a_view_only_user_can_view_but_not_create_or_edit(): void
    {
        $user = $this->createViewOnlyUser();
        $contributor = Contributor::factory()->create();

        $this->actingAs($user)->get(ContributorResource::getUrl('view', ['record' => $contributor]))
            ->assertOk();
        $this->actingAs($user)->get(ContributorResource::getUrl('create'))
            ->assertForbidden();
        $this->actingAs($user)->get(ContributorResource::getUrl('edit', ['record' => $contributor]))
            ->assertForbidden();
    }

    public function test_authorized_users_can_create_edit_and_delete_contributors(): void
    {
        $user = $this->createCrudUser();
        $collection = Collection::factory()->create();
        $contributor = Contributor::factory()->create([
            'collection_id' => $collection->id,
            'category' => 'author',
            'internal_name' => 'Author',
        ]);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->withQueryParams(['collection_id' => $collection->id])
            ->test(CreateContributor::class)
            ->assertFormSet(['collection_id' => $collection->id])
            ->fillForm([
                'category' => 'curated_by',
                'display_order' => 2,
                'visible' => true,
                'internal_name' => 'Curated by',
            ])
            ->call('create')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('contributors', [
            'collection_id' => $collection->id,
            'category' => 'curated_by',
            'internal_name' => 'Curated by',
        ]);

        Livewire::actingAs($user)
            ->test(EditContributor::class, ['record' => $contributor->getRouteKey()])
            ->fillForm(['visible' => false])
            ->call('save')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('contributors', ['id' => $contributor->id, 'visible' => false]);

        Livewire::actingAs($user)
            ->test(ListContributor::class)
            ->callTableAction(DeleteAction::class, $contributor)
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseMissing('contributors', ['id' => $contributor->id]);
    }

    public function test_the_collection_lists_its_contributors_and_creates_them_for_itself(): void
    {
        $user = $this->createCrudUser();
        $collection = Collection::factory()->create();
        $own = Contributor::factory()->create(['collection_id' => $collection->id, 'category' => 'exhibition_credits']);
        $other = Contributor::factory()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ContributorsRelationManager::class, [
                'ownerRecord' => $collection,
                'pageClass' => ViewCollection::class,
            ])
            ->assertCanSeeTableRecords([$own])
            ->assertCanNotSeeTableRecords([$other])
            ->assertTableActionVisible('create')
            ->assertTableActionHasUrl('create', ContributorResource::getUrl('create', ['collection_id' => $collection->id]))
            ->assertTableActionHasUrl(EditAction::class, ContributorResource::getUrl('edit', ['record' => $own]), $own);
    }

    public function test_every_category_shows_its_label_in_the_list_and_on_the_collection(): void
    {
        $user = $this->createCrudUser();
        $collection = Collection::factory()->create();
        $cooperator = Contributor::factory()->create([
            'collection_id' => $collection->id,
            'category' => ContributorCategory::IN_COOPERATION_WITH,
            'internal_name' => 'UNAOC',
        ]);

        $this->actingAs($user)->get(ContributorResource::getUrl('index'))
            ->assertOk()
            ->assertSee('In cooperation with');
        $this->actingAs($user)->get(ContributorResource::getUrl('view', ['record' => $cooperator]))
            ->assertOk()
            ->assertSee('In cooperation with');

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ContributorsRelationManager::class, [
                'ownerRecord' => $collection,
                'pageClass' => ViewCollection::class,
            ])
            ->assertSee('In cooperation with');
    }

    public function test_the_form_offers_exactly_the_enum_categories(): void
    {
        $user = $this->createCrudUser();
        Contributor::factory()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(CreateContributor::class)
            ->fillForm([
                'collection_id' => Collection::factory()->create()->id,
                'category' => 'not-a-category',
                'display_order' => 0,
                'internal_name' => 'Unknown',
            ])
            ->call('create')
            ->assertHasFormErrors(['category']);
    }

    public function test_a_view_only_user_sees_no_create_on_the_collection(): void
    {
        $user = $this->createViewOnlyUser();
        $collection = Collection::factory()->create();

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ContributorsRelationManager::class, [
                'ownerRecord' => $collection,
                'pageClass' => ViewCollection::class,
            ])
            ->assertTableActionHidden('create');
    }

    public function test_translations_are_created_in_their_language_and_context(): void
    {
        $user = $this->createCrudUser();
        $language = Language::factory()->create(['id' => 'eng', 'internal_name' => 'English']);
        $context = Context::factory()->create();
        $contributor = Contributor::factory()->create(['category' => 'exhibition_credits']);

        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(TranslationsRelationManager::class, [
                'ownerRecord' => $contributor,
                'pageClass' => ViewContributor::class,
            ])
            ->callTableAction('create', data: [
                'language_id' => $language->id,
                'context_id' => $context->id,
                'description' => "Curators & authors\nAna",
            ])
            ->assertHasNoTableActionErrors();

        $this->assertDatabaseHas('contributor_translations', [
            'contributor_id' => $contributor->id,
            'language_id' => $language->id,
            'context_id' => $context->id,
            'description' => "Curators & authors\nAna",
        ]);
    }

    public function test_an_image_is_served_only_for_its_own_contributor(): void
    {
        $user = $this->createCrudUser();
        $image = ContributorImage::factory()->create();
        $other = Contributor::factory()->create();

        $this->actingAs($user)
            ->get(route('filament.admin.contributor-image.view', ['contributor' => $other, 'contributorImage' => $image]))
            ->assertNotFound();
    }
}
