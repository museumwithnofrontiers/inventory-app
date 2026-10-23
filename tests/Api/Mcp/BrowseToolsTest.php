<?php

namespace Tests\Api\Mcp;

use App\Enums\LegacyLinkConfidence;
use App\Enums\LegacyLinkType;
use App\Enums\Permission;
use App\Mcp\Servers\InventoryServer;
use App\Mcp\Tools\DescribeEntity;
use App\Mcp\Tools\FindByLegacyKey;
use App\Mcp\Tools\FindItemsByTags;
use App\Mcp\Tools\Get;
use App\Mcp\Tools\GetCollection;
use App\Mcp\Tools\GetItem;
use App\Mcp\Tools\ListEntityTypes;
use App\Mcp\Tools\ListTags;
use App\Mcp\Tools\Search;
use App\Mcp\Tools\ViewImage;
use App\Models\Collection;
use App\Models\Item;
use App\Models\ItemImage;
use App\Models\ItemTranslation;
use App\Models\Project;
use App\Models\Tag;
use App\Models\User;
use App\Support\Images\PublicRenditions;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Collection as SupportCollection;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\Fluent\AssertableJson;
use Tests\TestCase;

/**
 * The read-only browse tools of the inventory MCP server.
 */
class BrowseToolsTest extends TestCase
{
    use RefreshDatabase;

    private const MINIMAL_JPEG = '/9j/4AAQSkZJRgABAQEAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';

    private User $reader;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('image-originals');
        Storage::fake('public');
        config([
            'localstorage.available.images.disk' => 'image-originals',
            'localstorage.available.images.directory' => 'images',
            'localstorage.pictures.disk' => 'public',
            'localstorage.pictures.directory' => 'pictures',
        ]);

        $this->reader = User::factory()->create();
        $this->reader->givePermissionTo([Permission::ACCESS_MCP->value, Permission::VIEW_DATA->value]);
    }

    public function test_list_entity_types_says_what_the_user_may_read(): void
    {
        $outsider = User::factory()->create();
        $outsider->givePermissionTo(Permission::ACCESS_MCP->value);

        InventoryServer::actingAs($this->reader)->tool(ListEntityTypes::class)
            ->assertOk()
            ->assertStructuredContent(fn (AssertableJson $json): AssertableJson => $json
                ->where('types', fn (SupportCollection $types): bool => $types->contains(['type' => 'item', 'may_read' => true])));

        InventoryServer::actingAs($outsider)->tool(ListEntityTypes::class)
            ->assertOk()
            ->assertStructuredContent(fn (AssertableJson $json): AssertableJson => $json
                ->where('types', fn (SupportCollection $types): bool => $types->contains(['type' => 'item', 'may_read' => false])));
    }

    public function test_describe_entity_lists_fields_and_includes(): void
    {
        InventoryServer::actingAs($this->reader)->tool(DescribeEntity::class, ['type' => 'item'])
            ->assertOk()
            ->assertStructuredContent(fn (AssertableJson $json): AssertableJson => $json
                ->where('fields', fn (SupportCollection $fields): bool => $fields->contains('backward_compatibility'))
                ->where('includes', fn (SupportCollection $includes): bool => $includes->contains('translations'))
                ->where('has_translations', true)
                ->where('has_legacy_key', true)
                ->etc());
    }

    public function test_search_matches_text_and_filters(): void
    {
        $project = Project::factory()->create();
        Item::factory()->Object()->create(['internal_name' => 'Ewer with birds', 'project_id' => $project->id]);
        Item::factory()->Object()->create(['internal_name' => 'Ewer with lions']);
        Item::factory()->Object()->create(['internal_name' => 'Bowl']);

        InventoryServer::actingAs($this->reader)->tool(Search::class, ['type' => 'item', 'q' => 'ewer'])
            ->assertOk()
            ->assertStructuredContent(fn (AssertableJson $json): AssertableJson => $json
                ->where('meta.total', 2)
                ->etc());

        InventoryServer::actingAs($this->reader)->tool(Search::class, ['type' => 'item', 'q' => 'ewer', 'filters' => ['project_id' => $project->id]])
            ->assertOk()
            ->assertStructuredContent(fn (AssertableJson $json): AssertableJson => $json
                ->where('meta.total', 1)
                ->where('data.0.internal_name', 'Ewer with birds')
                ->etc());
    }

    public function test_search_refuses_unknown_filters_and_unknown_types(): void
    {
        InventoryServer::actingAs($this->reader)->tool(Search::class, ['type' => 'item', 'filters' => ['password' => 'x']])
            ->assertHasErrors();
        InventoryServer::actingAs($this->reader)->tool(Search::class, ['type' => 'user'])
            ->assertHasErrors();
    }

    public function test_reading_needs_the_permission_the_api_needs(): void
    {
        $outsider = User::factory()->create();
        $outsider->givePermissionTo(Permission::ACCESS_MCP->value);
        $item = Item::factory()->Object()->create();

        InventoryServer::actingAs($outsider)->tool(Search::class, ['type' => 'item'])->assertHasErrors();
        InventoryServer::actingAs($outsider)->tool(Get::class, ['type' => 'item', 'id' => $item->id])->assertHasErrors();
        InventoryServer::actingAs($outsider)->tool(GetItem::class, ['id' => $item->id])->assertHasErrors();
    }

    public function test_get_returns_the_record_with_allowed_includes_only(): void
    {
        $item = Item::factory()->Object()->create(['internal_name' => 'Ewer']);
        ItemTranslation::factory()->for($item)->create();

        InventoryServer::actingAs($this->reader)->tool(Get::class, ['type' => 'item', 'id' => $item->id, 'include' => ['translations']])
            ->assertOk()
            ->assertStructuredContent(fn (AssertableJson $json): AssertableJson => $json
                ->where('data.internal_name', 'Ewer')
                ->has('data.translations', 1)
                ->etc());

        InventoryServer::actingAs($this->reader)->tool(Get::class, ['type' => 'item', 'id' => $item->id, 'include' => ['secrets']])
            ->assertHasErrors();
    }

    public function test_get_item_gives_the_sheet_with_public_image_urls(): void
    {
        $item = Item::factory()->Object()->create(['internal_name' => 'Ewer']);
        ItemTranslation::factory()->for($item)->create();
        $image = ItemImage::factory()->forItem($item)->create(['path' => 'ewer.jpg', 'copyright' => '© Somebody']);

        InventoryServer::actingAs($this->reader)->tool(GetItem::class, ['id' => $item->id])
            ->assertOk()
            ->assertStructuredContent(fn (AssertableJson $json): AssertableJson => $json
                ->where('item.internal_name', 'Ewer')
                ->has('item.translations', 1)
                ->where('images.0.id', $image->id)
                ->where('images.0.public_url', route('pub.picture', ['filename' => 'ewer.jpg']))
                ->where('images.0.copyright', '© Somebody')
                ->etc());
    }

    public function test_get_item_gives_the_tags_and_the_legacy_links_the_panel_shows(): void
    {
        $item = Item::factory()->Object()->create(['backward_compatibility' => 'mwnf3:objects:ISL:eg:Mus01:1']);
        $tag = Tag::factory()->create(['internal_name' => 'gold', 'category' => 'material']);
        $item->tags()->attach($tag);

        InventoryServer::actingAs($this->reader)->tool(GetItem::class, ['id' => $item->id, 'language' => 'fr'])
            ->assertOk()
            ->assertStructuredContent(fn (AssertableJson $json): AssertableJson => $json
                ->where('item.tags.0.internal_name', 'gold')
                ->where('legacy_links.0.url', 'https://islamicart.museumwnf.org/database_item.php?id=object;ISL;eg;Mus01;1;fr')
                ->where('legacy_links.0.type', LegacyLinkType::PUBLIC->value)
                ->where('legacy_links.0.confidence', LegacyLinkConfidence::EXACT->value)
                ->where('legacy_links', fn (SupportCollection $links): bool => $links->contains('type', LegacyLinkType::BACKOFFICE->value))
                ->etc());
    }

    public function test_get_item_says_when_an_item_has_no_legacy_link(): void
    {
        $item = Item::factory()->Object()->create(['backward_compatibility' => null]);

        InventoryServer::actingAs($this->reader)->tool(GetItem::class, ['id' => $item->id])
            ->assertOk()
            ->assertStructuredContent(fn (AssertableJson $json): AssertableJson => $json
                ->where('legacy_links.0.url', null)
                ->where('legacy_links.0.type', LegacyLinkType::DIAGNOSTIC->value)
                ->etc());
    }

    public function test_list_tags_counts_items_and_filters(): void
    {
        $gold = Tag::factory()->create(['internal_name' => 'gold', 'description' => 'Gold', 'category' => 'material']);
        $goldKeyword = Tag::factory()->create(['internal_name' => 'gold leaf', 'description' => 'Gold leaf', 'category' => 'keyword']);
        Tag::factory()->create(['internal_name' => 'silver', 'category' => 'material']);
        $gold->items()->attach(Item::factory()->Object()->count(2)->create());
        $goldKeyword->items()->attach(Item::factory()->Object()->create());

        InventoryServer::actingAs($this->reader)->tool(ListTags::class, ['q' => 'gold'])
            ->assertOk()
            ->assertStructuredContent(fn (AssertableJson $json): AssertableJson => $json
                ->where('meta.total', 2)
                ->where('data.0.id', $gold->id)
                ->where('data.0.items_count', 2)
                ->where('data.1.items_count', 1)
                ->where('categories', fn (SupportCollection $categories): bool => $categories->contains('material') && $categories->contains('keyword'))
                ->etc());

        InventoryServer::actingAs($this->reader)->tool(ListTags::class, ['q' => 'gold', 'category' => 'keyword'])
            ->assertOk()
            ->assertStructuredContent(fn (AssertableJson $json): AssertableJson => $json
                ->where('meta.total', 1)
                ->where('data.0.id', $goldKeyword->id)
                ->etc());
    }

    public function test_find_items_by_tags_matches_all_or_any(): void
    {
        $gold = Tag::factory()->create(['internal_name' => 'gold', 'description' => 'Gold', 'category' => 'material']);
        $ewer = Tag::factory()->create(['internal_name' => 'ewer', 'description' => 'Ewer', 'category' => 'keyword']);
        $both = Item::factory()->Object()->create(['internal_name' => 'Golden ewer']);
        $goldOnly = Item::factory()->Object()->create(['internal_name' => 'Gold coin']);
        Item::factory()->Object()->create(['internal_name' => 'Untagged']);
        $both->tags()->attach([$gold->id, $ewer->id]);
        $goldOnly->tags()->attach($gold);

        // By description, internal name and id alike
        InventoryServer::actingAs($this->reader)->tool(FindItemsByTags::class, ['tags' => ['Gold', $ewer->id]])
            ->assertOk()
            ->assertStructuredContent(fn (AssertableJson $json): AssertableJson => $json
                ->where('meta.total', 1)
                ->where('data.0.id', $both->id)
                ->has('data.0.tags', 2)
                ->etc());

        InventoryServer::actingAs($this->reader)->tool(FindItemsByTags::class, ['tags' => ['gold', 'ewer'], 'match' => 'any'])
            ->assertOk()
            ->assertStructuredContent(fn (AssertableJson $json): AssertableJson => $json
                ->where('meta.total', 2)
                ->where('data', fn (SupportCollection $items): bool => $items->pluck('id')->sort()->values()->all() === collect([$both->id, $goldOnly->id])->sort()->values()->all())
                ->etc());
    }

    public function test_find_items_by_tags_takes_every_tag_a_name_stands_for(): void
    {
        $material = Tag::factory()->create(['internal_name' => 'gold', 'category' => 'material']);
        $keyword = Tag::factory()->create(['internal_name' => 'gold', 'category' => 'keyword']);
        Item::factory()->Object()->create()->tags()->attach($material);
        Item::factory()->Object()->create()->tags()->attach($keyword);

        InventoryServer::actingAs($this->reader)->tool(FindItemsByTags::class, ['tags' => ['gold']])
            ->assertOk()
            ->assertStructuredContent(fn (AssertableJson $json): AssertableJson => $json
                ->where('meta.total', 2)
                ->has('tags.gold', 2)
                ->etc());
    }

    public function test_find_items_by_tags_says_which_names_match_nothing(): void
    {
        $gold = Tag::factory()->create(['internal_name' => 'gold']);
        Item::factory()->Object()->create()->tags()->attach($gold);

        InventoryServer::actingAs($this->reader)->tool(FindItemsByTags::class, ['tags' => ['gold', 'unobtainium']])
            ->assertHasErrors(['unobtainium']);

        InventoryServer::actingAs($this->reader)->tool(FindItemsByTags::class, ['tags' => ['gold', 'unobtainium'], 'match' => 'any'])
            ->assertOk()
            ->assertStructuredContent(fn (AssertableJson $json): AssertableJson => $json
                ->where('meta.total', 1)
                ->where('unmatched', ['unobtainium'])
                ->etc());

        InventoryServer::actingAs($this->reader)->tool(FindItemsByTags::class, ['tags' => []])->assertHasErrors();
    }

    public function test_the_tag_tools_need_view_data_not_manage_reference_data(): void
    {
        Item::factory()->Object()->create()->tags()->attach(Tag::factory()->create(['internal_name' => 'gold']));
        $this->assertFalse($this->reader->hasPermissionTo(Permission::MANAGE_REFERENCE_DATA->value));

        InventoryServer::actingAs($this->reader)->tool(ListTags::class)->assertOk();
        InventoryServer::actingAs($this->reader)->tool(FindItemsByTags::class, ['tags' => ['gold']])->assertOk();

        $outsider = User::factory()->create();
        $outsider->givePermissionTo(Permission::ACCESS_MCP->value);

        InventoryServer::actingAs($outsider)->tool(ListTags::class)->assertHasErrors();
        InventoryServer::actingAs($outsider)->tool(FindItemsByTags::class, ['tags' => ['gold']])->assertHasErrors();
    }

    public function test_get_collection_lists_native_and_attached_members(): void
    {
        $collection = Collection::factory()->create();
        $child = Collection::factory()->create(['parent_id' => $collection->id]);
        Item::factory()->Object()->create(['internal_name' => 'Native', 'collection_id' => $collection->id]);
        $attached = Item::factory()->Object()->create(['internal_name' => 'Attached']);
        $collection->attachItem($attached);
        Item::factory()->Object()->create(['internal_name' => 'Elsewhere']);

        InventoryServer::actingAs($this->reader)->tool(GetCollection::class, ['id' => $collection->id])
            ->assertOk()
            ->assertStructuredContent(fn (AssertableJson $json): AssertableJson => $json
                ->where('members_meta.total', 2)
                ->where('members', fn (SupportCollection $members): bool => $members->pluck('internal_name')->sort()->values()->all() === ['Attached', 'Native'])
                ->where('collection.children.0.id', $child->id)
                ->etc());
    }

    public function test_find_by_legacy_key_matches_exactly_or_by_prefix(): void
    {
        Item::factory()->Object()->create(['backward_compatibility' => 'mwnf3:objects:EPM:dn:Mus21:50']);
        Item::factory()->Object()->create(['backward_compatibility' => 'mwnf3:objects:EPM:dn:Mus21:51']);

        InventoryServer::actingAs($this->reader)->tool(FindByLegacyKey::class, ['key' => 'mwnf3:objects:EPM:dn:Mus21:50'])
            ->assertOk()
            ->assertStructuredContent(fn (AssertableJson $json): AssertableJson => $json
                ->has('matches', 1)
                ->where('matches.0.type', 'item')
                ->etc());

        InventoryServer::actingAs($this->reader)->tool(FindByLegacyKey::class, ['key' => 'mwnf3:objects:EPM:dn:Mus21:', 'prefix' => true])
            ->assertOk()
            ->assertStructuredContent(fn (AssertableJson $json): AssertableJson => $json
                ->has('matches', 2)
                ->etc());
    }

    public function test_view_image_shows_only_a_cached_rendition_unless_allowed_to_burn(): void
    {
        $image = $this->burnableItemImage('ewer.jpg');

        InventoryServer::actingAs($this->reader)->tool(ViewImage::class, ['type' => 'item_image', 'id' => $image->id])
            ->assertOk()
            ->assertSee('No rendition of this image is cached yet');
        $this->assertSame([], Storage::disk('public')->allFiles(), 'Viewing must not write the pictures cache');

        InventoryServer::actingAs($this->reader)->tool(ViewImage::class, ['type' => 'item_image', 'id' => $image->id, 'allow_burn' => true])
            ->assertOk()
            ->assertSee(route('pub.picture', ['filename' => 'ewer.jpg']));
        $this->assertTrue(Storage::disk('public')->exists('pictures/ewer.jpg'));

        // Now cached: shown without burning, and it is the rendition, not the original
        $cached = app(PublicRenditions::class)->cached($image);
        $this->assertNotNull($cached);
        $this->assertNotSame(base64_decode(self::MINIMAL_JPEG), $cached->contents);
        InventoryServer::actingAs($this->reader)->tool(ViewImage::class, ['type' => 'item_image', 'id' => $image->id])
            ->assertOk()
            ->assertDontSee('No rendition of this image is cached yet');
    }

    public function test_view_image_refuses_what_is_not_an_attached_image(): void
    {
        $item = Item::factory()->Object()->create();

        InventoryServer::actingAs($this->reader)->tool(ViewImage::class, ['type' => 'item', 'id' => $item->id])
            ->assertHasErrors();
        InventoryServer::actingAs($this->reader)->tool(ViewImage::class, ['type' => 'available_image', 'id' => 'x'])
            ->assertHasErrors();
    }

    private function burnableItemImage(string $filename): ItemImage
    {
        $image = ItemImage::factory()->forItem(Item::factory()->Object()->create())->create([
            'path' => $filename,
            'mime_type' => 'image/jpeg',
        ]);
        Storage::disk('image-originals')->put('images/'.$filename, base64_decode(self::MINIMAL_JPEG));

        return $image;
    }
}
