<?php

namespace Tests\Filament\Resources;

use App\Filament\Resources\CollectionResource\Pages\EditCollection;
use App\Filament\Resources\CollectionResource\Pages\ListCollection;
use App\Models\Collection;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * M16 E4a (#2650): a collection's editorial flags in the panel.
 */
class CollectionFlagsTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_the_form_sets_the_flags(): void
    {
        $collection = Collection::factory()->create();
        $this->setCurrentPanel();

        Livewire::actingAs($this->createCrudUser())
            ->test(EditCollection::class, ['record' => $collection->getRouteKey()])
            ->fillForm(['visible' => false, 'featured' => true, 'published_at' => '2026-03-24'])
            ->call('save')
            ->assertHasNoFormErrors();

        $collection->refresh();
        $this->assertFalse($collection->visible);
        $this->assertTrue($collection->featured);
        $this->assertSame('2026-03-24', $collection->published_at?->format('Y-m-d'));
    }

    public function test_the_list_filters_by_visibility(): void
    {
        $shown = Collection::factory()->create(['visible' => true]);
        $hidden = Collection::factory()->create(['visible' => false]);
        $this->setCurrentPanel();

        Livewire::actingAs($this->createCrudUser())
            ->test(ListCollection::class)
            ->filterTable('visible', false)
            ->assertCanSeeTableRecords([$hidden])
            ->assertCanNotSeeTableRecords([$shown]);
    }
}
