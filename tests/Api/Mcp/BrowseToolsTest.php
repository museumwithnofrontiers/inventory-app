<?php

namespace Tests\Api\Mcp;

use App\Enums\Permission;
use App\Mcp\Servers\InventoryServer;
use App\Mcp\Tools\DescribeEntity;
use App\Mcp\Tools\FindByLegacyKey;
use App\Mcp\Tools\Get;
use App\Mcp\Tools\GetCollection;
use App\Mcp\Tools\GetItem;
use App\Mcp\Tools\ListEntityTypes;
use App\Mcp\Tools\Search;
use App\Mcp\Tools\ViewImage;
use App\Models\Collection;
use App\Models\Item;
use App\Models\ItemImage;
use App\Models\ItemTranslation;
use App\Models\Project;
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
