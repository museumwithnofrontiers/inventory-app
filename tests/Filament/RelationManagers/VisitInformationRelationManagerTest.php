<?php

namespace Tests\Filament\RelationManagers;

use App\Filament\Resources\ItemResource\Pages\ViewItem;
use App\Filament\Resources\ItemResource\RelationManagers\VisitInformationRelationManager as ItemVisitInformationRelationManager;
use App\Filament\Resources\PartnerResource\Pages\ViewPartner;
use App\Filament\Resources\PartnerResource\RelationManagers\VisitInformationRelationManager as PartnerVisitInformationRelationManager;
use App\Models\Context;
use App\Models\Item;
use App\Models\Language;
use App\Models\Partner;
use App\Models\VisitInformation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * M16 D1 (#2645): the visit information managers on Item (monuments only),
 * Collection and Partner, inline Create/Edit.
 */
class VisitInformationRelationManagerTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_crud_user_creates_and_edits_a_partners_visit_information(): void
    {
        $partner = Partner::factory()->create();
        $language = Language::factory()->create();
        $context = Context::factory()->create();
        $this->setCurrentPanel();

        Livewire::actingAs($this->createCrudUser())
            ->test(PartnerVisitInformationRelationManager::class, [
                'ownerRecord' => $partner,
                'pageClass' => ViewPartner::class,
            ])
            ->callTableAction('create', data: [
                'language_id' => $language->id,
                'context_id' => $context->id,
                'how_to_reach' => 'Metro line 2, stop "Museum".',
                'opening_hours' => 'Tuesday to Sunday, 10.00-18.00',
            ])
            ->assertHasNoTableActionErrors();

        $visitInformation = VisitInformation::query()->where('partner_id', $partner->id)->firstOrFail();
        $this->assertNull($visitInformation->item_id);
        $this->assertSame('Tuesday to Sunday, 10.00-18.00', $visitInformation->opening_hours);

        Livewire::actingAs($this->createCrudUser())
            ->test(PartnerVisitInformationRelationManager::class, [
                'ownerRecord' => $partner,
                'pageClass' => ViewPartner::class,
            ])
            ->callTableAction('edit', $visitInformation, data: ['phone' => '+33 1 23 45 67 89'])
            ->assertHasNoTableActionErrors();

        $this->assertSame('+33 1 23 45 67 89', $visitInformation->fresh()?->phone);
    }

    public function test_view_only_user_cannot_create(): void
    {
        $partner = Partner::factory()->create();
        $this->setCurrentPanel();

        Livewire::actingAs($this->createViewOnlyUser())
            ->test(PartnerVisitInformationRelationManager::class, [
                'ownerRecord' => $partner,
                'pageClass' => ViewPartner::class,
            ])
            ->assertTableActionHidden('create');
    }

    public function test_only_a_monument_shows_the_manager(): void
    {
        $this->actingAs($this->createCrudUser());

        $this->assertTrue(ItemVisitInformationRelationManager::canViewForRecord(Item::factory()->Monument()->create(), ViewItem::class));
        $this->assertFalse(ItemVisitInformationRelationManager::canViewForRecord(Item::factory()->Object()->create(), ViewItem::class));
    }
}
