<?php

namespace Tests\Filament\Resources;

use App\Filament\Resources\ItemResource\Pages\ListItem;
use App\Filament\Resources\TimelineEventResource\Pages\CreateTimelineEvent;
use App\Filament\Resources\TimelineResource\Pages\CreateTimeline;
use App\Models\Collection;
use App\Models\Item;
use App\Models\Tag;
use App\Models\Timeline;
use Filament\Forms\Components\Select;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * Resource form fields that pick a record from a large table use
 * RecordSelect: searchable on the server by id, internal_name and legacy
 * code, never preloaded.
 */
class FormRecordSelectsTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    public function test_timeline_event_form_timeline_select_finds_a_timeline_by_its_legacy_code(): void
    {
        $timeline = Timeline::factory()->create(['internal_name' => 'islamic-timeline', 'backward_compatibility' => 'LEGACY-TL-001']);

        $this->setCurrentPanel();

        $component = Livewire::actingAs($this->createCrudUser())->test(CreateTimelineEvent::class);
        $select = $this->field($component->instance()->getForm('form')?->getFlatFields() ?? [], 'timeline_id');

        $this->assertFalse($select->isPreloaded());
        $this->assertTrue($select->isRequired());
        $this->assertSame(
            [$timeline->id => 'islamic-timeline [LEGACY-TL-001]'],
            $select->getSearchResults('LEGACY-TL-001')
        );
    }

    public function test_timeline_form_collection_select_is_optional_and_finds_a_collection_by_its_legacy_code(): void
    {
        $collection = Collection::factory()->create(['backward_compatibility' => 'LEGACY-COL-001']);

        $this->setCurrentPanel();

        $component = Livewire::actingAs($this->createCrudUser())->test(CreateTimeline::class);
        $select = $this->field($component->instance()->getForm('form')?->getFlatFields() ?? [], 'collection_id');

        $this->assertFalse($select->isPreloaded());
        $this->assertFalse($select->isRequired());
        $this->assertArrayHasKey($collection->id, $select->getSearchResults('LEGACY-COL-001'));
    }

    public function test_item_bulk_attach_to_collection_select_finds_a_collection_by_its_legacy_code(): void
    {
        $item = Item::factory()->Object()->create();
        $collection = Collection::factory()->create(['backward_compatibility' => 'LEGACY-COL-002']);

        $this->setCurrentPanel();

        $component = Livewire::actingAs($this->createCrudUser())
            ->test(ListItem::class)
            ->mountTableBulkAction('attachToCollection', [$item->getKey()]);
        $select = $this->field($component->instance()->getMountedTableBulkActionForm()?->getFlatFields() ?? [], 'collection_id');

        $this->assertFalse($select->isPreloaded());
        $this->assertArrayHasKey($collection->id, $select->getSearchResults('LEGACY-COL-002'));
    }

    public function test_item_bulk_attach_tag_select_finds_a_tag_by_its_name_and_legacy_code(): void
    {
        $item = Item::factory()->Object()->create();
        $tag = Tag::factory()->create([
            'internal_name' => 'blue glass',
            'description' => 'Blue Glass',
            'backward_compatibility' => 'LEGACY-TAG-001',
        ]);

        $this->setCurrentPanel();

        $component = Livewire::actingAs($this->createCrudUser())
            ->test(ListItem::class)
            ->mountTableBulkAction('attachTag', [$item->getKey()]);
        $select = $this->field($component->instance()->getMountedTableBulkActionForm()?->getFlatFields() ?? [], 'tag_id');

        $this->assertFalse($select->isPreloaded());
        $this->assertArrayHasKey($tag->id, $select->getSearchResults('LEGACY-TAG-001'));
        $this->assertSame('Blue Glass [LEGACY-TAG-001]', $select->getSearchResults('Blue Glass')[$tag->id] ?? null);
    }

    /**
     * @param  array<string, mixed>  $fields
     */
    private function field(array $fields, string $name): Select
    {
        $field = $fields[$name] ?? null;
        $this->assertInstanceOf(Select::class, $field, "The form has no [{$name}] select.");

        return $field;
    }
}
