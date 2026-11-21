<?php

namespace Tests\Filament;

use App\Filament\Pages\BrowseTimelineTree;
use App\Filament\Resources\CollectionResource;
use App\Filament\Resources\CollectionResource\Pages\ListCollection;
use App\Filament\Resources\GlossaryResource;
use App\Filament\Resources\GlossaryResource\Pages\ListGlossary;
use App\Filament\Resources\ItemResource;
use App\Filament\Resources\ItemResource\Pages\ListItem;
use App\Filament\Resources\ItemResource\Pages\ViewItem;
use App\Filament\Resources\ItemResource\RelationManagers\TranslationsRelationManager;
use App\Filament\Resources\ItemTranslationResource;
use App\Filament\Resources\PartnerResource;
use App\Filament\Support\ItemDisplayLabel;
use App\Filament\Support\PartnerDisplayLabel;
use App\Models\Collection;
use App\Models\CollectionTranslation;
use App\Models\Context;
use App\Models\Glossary;
use App\Models\Item;
use App\Models\ItemTranslation;
use App\Models\Language;
use App\Models\Partner;
use App\Models\Timeline;
use App\Models\TimelineEvent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Filament\Concerns\InteractsWithAdminPanel;
use Tests\TestCase;

/**
 * Stored text is Markdown (the importer converts legacy HTML to it). The
 * panel shows it rendered, never as raw syntax: emphasis in tables, tree
 * nodes and infolists; plain text in titles, select options and search
 * results; and raw HTML escaped everywhere.
 */
class MarkdownDisplayTest extends TestCase
{
    use InteractsWithAdminPanel;
    use RefreshDatabase;

    private Language $language;

    private Context $context;

    protected function setUp(): void
    {
        parent::setUp();

        $this->language = Language::factory()->create(['id' => 'eng', 'is_default' => true]);
        $this->context = Context::factory()->create(['is_default' => true]);
    }

    private function itemNamedDavid(): Item
    {
        $item = Item::factory()->Object()->create(['internal_name' => '*David* (1)']);
        ItemTranslation::factory()->create([
            'item_id' => $item->id,
            'language_id' => $this->language->id,
            'context_id' => $this->context->id,
            'name' => '*David*',
            'description' => "**Marble**, carved.\n\n<script>alert(1)</script>",
        ]);

        return $item;
    }

    public function test_item_table_shows_emphasis_instead_of_asterisks(): void
    {
        $item = $this->itemNamedDavid();
        $this->setCurrentPanel();

        Livewire::actingAs($this->createCrudUser())
            ->test(ListItem::class)
            ->assertCanSeeTableRecords([$item])
            ->assertSeeHtml('<em>David</em>')
            ->assertDontSee('*David*');
    }

    public function test_item_record_title_and_select_label_are_plain_text(): void
    {
        $item = $this->itemNamedDavid();

        $this->assertSame('David', ItemResource::getRecordTitle($item));
        $this->assertSame('David', ItemDisplayLabel::resolveLabel($item->id));

        $this->actingAs($this->createCrudUser())
            ->get(ItemResource::getUrl('view', ['record' => $item]))
            ->assertOk()
            ->assertSee('View David')
            ->assertDontSee('View *David*');
    }

    public function test_item_translation_infolist_renders_markdown_and_escapes_html(): void
    {
        $item = $this->itemNamedDavid();
        $translation = $item->translations()->firstOrFail();

        $this->actingAs($this->createCrudUser())
            ->get(ItemTranslationResource::getUrl('view', ['record' => $translation]))
            ->assertOk()
            ->assertSee('<em>David</em>', false)
            ->assertSee('<strong>Marble</strong>', false)
            ->assertDontSee('<script>alert(1)', false);
    }

    public function test_translations_relation_manager_shows_emphasis_and_a_plain_record_title(): void
    {
        $item = $this->itemNamedDavid();
        $translation = $item->translations()->firstOrFail();
        $this->setCurrentPanel();

        $component = Livewire::actingAs($this->createCrudUser())
            ->test(TranslationsRelationManager::class, [
                'ownerRecord' => $item,
                'pageClass' => ViewItem::class,
            ])
            ->assertCanSeeTableRecords([$translation])
            ->assertSeeHtml('<em>David</em>');

        // Action headings and notifications read the table's record title.
        $this->assertSame('David', $component->instance()->getTable()->getRecordTitle($translation));
    }

    public function test_collection_table_and_record_title(): void
    {
        $collection = Collection::factory()->create(['internal_name' => 'hijaz']);
        CollectionTranslation::factory()->create([
            'collection_id' => $collection->id,
            'language_id' => $this->language->id,
            'context_id' => $this->context->id,
            'title' => 'The *Hijaz* Railway',
        ]);
        $this->setCurrentPanel();

        Livewire::actingAs($this->createCrudUser())
            ->test(ListCollection::class)
            ->assertCanSeeTableRecords([$collection])
            ->assertSeeHtml('The <em>Hijaz</em> Railway')
            ->assertDontSee('*Hijaz*');

        $this->assertSame('The Hijaz Railway', CollectionResource::getRecordTitle($collection->fresh()));
    }

    public function test_partner_record_title_and_option_label_are_plain_text(): void
    {
        $partner = Partner::factory()->create(['internal_name' => 'Museo *Nazionale*']);

        $this->assertSame('Museo Nazionale', PartnerResource::getRecordTitle($partner));
        $this->assertSame('Museo Nazionale', PartnerDisplayLabel::resolveLabel($partner->id));
    }

    public function test_glossary_table_and_global_search_result(): void
    {
        $glossary = Glossary::factory()->create(['internal_name' => '*sabil*']);
        $user = $this->createReferenceDataCrudUser();
        $this->setCurrentPanel();

        Livewire::actingAs($user)
            ->test(ListGlossary::class)
            ->assertCanSeeTableRecords([$glossary])
            ->assertSeeHtml('<em>sabil</em>');

        $this->actingAs($user);
        $titles = GlossaryResource::getGlobalSearchResults('sabil')->map(fn ($result): string => (string) $result->title)->all();

        $this->assertSame(['sabil'], $titles);
    }

    public function test_timeline_tree_shows_emphasis_and_escapes_html(): void
    {
        $timeline = Timeline::factory()->create(['internal_name' => 'The *Umayyads* <b>x</b>', 'country_id' => null]);
        TimelineEvent::factory()->create(['timeline_id' => $timeline->id]);

        $this->actingAs($this->createCrudUser())
            ->get(BrowseTimelineTree::getUrl())
            ->assertOk()
            ->assertSee('The <em>Umayyads</em> &lt;b&gt;x&lt;/b&gt;', false)
            ->assertDontSee('<b>x</b>', false);
    }
}
