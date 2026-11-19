<?php

namespace Tests\Filament\Resources;

use App\Enums\PartnerCategory;
use App\Filament\Resources\PartnerResource\Pages\EditPartner;
use App\Filament\Resources\PartnerResource\Pages\ViewPartner;
use App\Filament\Resources\PartnerResource\RelationManagers\ContactsRelationManager;
use App\Models\Partner;
use App\Models\PartnerContact;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * M16 D2 (#2646): the partner's category, featured flag and city on its form,
 * and its contacts in their own manager.
 */
class PartnerContactsAndFieldsTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_the_partner_form_edits_the_decision_7_fields(): void
    {
        $partner = Partner::factory()->create(['type' => 'institution']);
        $this->setCurrentPanel();

        Livewire::actingAs($this->createCrudUser())
            ->test(EditPartner::class, ['record' => $partner->getRouteKey()])
            ->fillForm([
                'internal_name' => $partner->internal_name,
                'type' => 'institution',
                'category' => 'archives',
                'featured' => true,
                'city' => 'Alger',
            ])
            ->call('save')
            ->assertHasNoFormErrors();

        $partner->refresh();
        $this->assertSame(PartnerCategory::ARCHIVES, $partner->category);
        $this->assertTrue($partner->featured);
        $this->assertSame('Alger', $partner->city);
    }

    public function test_crud_user_adds_and_edits_a_contact(): void
    {
        $partner = Partner::factory()->create();
        $this->setCurrentPanel();

        Livewire::actingAs($this->createCrudUser())
            ->test(ContactsRelationManager::class, ['ownerRecord' => $partner, 'pageClass' => ViewPartner::class])
            ->callTableAction('create', data: [
                'display_order' => 1,
                'name' => 'Ana Ruiz',
                'title' => 'Curator',
                'email' => 'ana@example.org',
            ])
            ->assertHasNoTableActionErrors();

        $contact = PartnerContact::query()->where('partner_id', $partner->id)->firstOrFail();
        $this->assertSame(1, $contact->display_order);

        Livewire::actingAs($this->createCrudUser())
            ->test(ContactsRelationManager::class, ['ownerRecord' => $partner, 'pageClass' => ViewPartner::class])
            ->callTableAction('edit', $contact, data: ['display_order' => 1, 'fax' => '+34 91 000 00 00'])
            ->assertHasNoTableActionErrors();

        $this->assertSame('+34 91 000 00 00', $contact->fresh()?->fax);
    }

    public function test_view_only_user_cannot_add_a_contact(): void
    {
        $partner = Partner::factory()->create();
        $this->setCurrentPanel();

        Livewire::actingAs($this->createViewOnlyUser())
            ->test(ContactsRelationManager::class, ['ownerRecord' => $partner, 'pageClass' => ViewPartner::class])
            ->assertTableActionHidden('create');
    }
}
