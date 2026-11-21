<?php

namespace Tests\Filament\Resources;

use App\Filament\Resources\CollectionResource\Pages\CreateCollection;
use App\Filament\Resources\CollectionResource\Pages\EditCollection;
use App\Filament\Resources\CollectionResource\Pages\ListCollection;
use App\Models\Collection;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * M17 A1 (#2742): a collection's draft flag in the panel.
 */
class CollectionFlagsTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_a_new_collection_starts_as_a_draft(): void
    {
        $this->setCurrentPanel();

        Livewire::actingAs($this->createCrudUser())
            ->test(CreateCollection::class)
            ->assertFormSet(['draft' => true]);
    }

    public function test_the_form_sets_the_draft_flag(): void
    {
        $collection = Collection::factory()->create(['draft' => false]);
        $this->setCurrentPanel();

        Livewire::actingAs($this->createCrudUser())
            ->test(EditCollection::class, ['record' => $collection->getRouteKey()])
            ->assertFormSet(['draft' => false])
            ->fillForm(['draft' => true])
            ->call('save')
            ->assertHasNoFormErrors();

        $this->assertTrue($collection->refresh()->draft);
    }

    public function test_the_list_filters_the_drafts(): void
    {
        $ready = Collection::factory()->create(['draft' => false]);
        $draft = Collection::factory()->create(['draft' => true]);
        $this->setCurrentPanel();

        Livewire::actingAs($this->createCrudUser())
            ->test(ListCollection::class)
            ->filterTable('draft', true)
            ->assertCanSeeTableRecords([$draft])
            ->assertCanNotSeeTableRecords([$ready]);
    }
}
