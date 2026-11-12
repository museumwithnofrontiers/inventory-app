<?php

namespace Tests\Api\Mcp;

use App\Enums\Permission;
use App\Mcp\EntityRegistry;
use App\Mcp\Servers\InventoryServer;
use App\Mcp\Tools\DescribeEntity;
use App\Mcp\Tools\FindByLegacyKey;
use App\Mcp\Tools\Get;
use App\Mcp\Tools\ListEntityTypes;
use App\Mcp\Tools\Search;
use App\Models\Publication;
use App\Models\PublicationEdition;
use App\Models\PublicationImage;
use App\Models\PublicationTranslation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Collection as SupportCollection;
use Illuminate\Testing\Fluent\AssertableJson;
use Tests\TestCase;

/**
 * The read-only MCP tools reach the publications through the entity
 * registry: no new tool, the policies decide.
 */
class PublicationEntitiesTest extends TestCase
{
    use RefreshDatabase;

    private User $reader;

    protected function setUp(): void
    {
        parent::setUp();

        $this->reader = User::factory()->create();
        $this->reader->givePermissionTo([Permission::ACCESS_MCP->value, Permission::VIEW_DATA->value]);
    }

    public function test_the_four_publication_types_are_registered(): void
    {
        foreach (['publication', 'publication_translation', 'publication_edition', 'publication_image'] as $type) {
            $this->assertTrue(EntityRegistry::has($type), $type);
        }

        $this->assertSame(Publication::class, EntityRegistry::model('publication'));
        $this->assertSame(PublicationEdition::class, EntityRegistry::model('publication_edition'));
        $this->assertContains('editions', EntityRegistry::includes('publication'));
    }

    public function test_the_mcp_reads_a_publication_by_its_legacy_key(): void
    {
        $publication = Publication::factory()->create(['backward_compatibility' => 'mwnf3:bookbase:48', 'internal_name' => 'MWNF Educational Guide']);
        PublicationEdition::factory()->forPublication($publication)->create(['backward_compatibility' => 'mwnf3:books:48:en:1:book:1']);

        InventoryServer::actingAs($this->reader)->tool(FindByLegacyKey::class, ['key' => 'mwnf3:bookbase:48'])
            ->assertOk()
            ->assertStructuredContent(fn (AssertableJson $json): AssertableJson => $json
                ->has('matches', 1)
                ->where('matches.0.type', 'publication')
                ->etc());

        InventoryServer::actingAs($this->reader)->tool(FindByLegacyKey::class, ['key' => 'mwnf3:books:48:', 'prefix' => true])
            ->assertOk()
            ->assertStructuredContent(fn (AssertableJson $json): AssertableJson => $json
                ->has('matches', 1)
                ->where('matches.0.type', 'publication_edition')
                ->etc());
    }

    public function test_get_search_and_describe_read_publications(): void
    {
        $publication = Publication::factory()->create(['internal_name' => 'Travel guide Jordan']);
        PublicationTranslation::factory()->forPublication($publication)->create();
        PublicationImage::factory()->forPublication($publication)->cover()->create();

        InventoryServer::actingAs($this->reader)->tool(Get::class, ['type' => 'publication', 'id' => $publication->id, 'include' => ['translations', 'publicationImages']])
            ->assertOk()
            ->assertStructuredContent(fn (AssertableJson $json): AssertableJson => $json
                ->where('data.internal_name', 'Travel guide Jordan')
                ->has('data.translations', 1)
                ->has('data.publicationImages', 1)
                ->etc());

        InventoryServer::actingAs($this->reader)->tool(Search::class, ['type' => 'publication', 'q' => 'Jordan'])
            ->assertOk()
            ->assertStructuredContent(fn (AssertableJson $json): AssertableJson => $json
                ->where('meta.total', 1)
                ->etc());

        InventoryServer::actingAs($this->reader)->tool(DescribeEntity::class, ['type' => 'publication_edition'])
            ->assertOk()
            ->assertStructuredContent(fn (AssertableJson $json): AssertableJson => $json
                ->where('fields', fn (SupportCollection $fields): bool => $fields->contains('isbn') && $fields->contains('visible'))
                ->etc());
    }

    public function test_reading_publications_needs_view_data(): void
    {
        $outsider = User::factory()->create();
        $outsider->givePermissionTo(Permission::ACCESS_MCP->value);
        $publication = Publication::factory()->create();

        InventoryServer::actingAs($outsider)->tool(ListEntityTypes::class)
            ->assertOk()
            ->assertStructuredContent(fn (AssertableJson $json): AssertableJson => $json
                ->where('types', fn (SupportCollection $types): bool => $types->contains(['type' => 'publication', 'may_read' => false])
                    && $types->contains(['type' => 'publication_edition', 'may_read' => false])));

        InventoryServer::actingAs($outsider)->tool(Get::class, ['type' => 'publication', 'id' => $publication->id])
            ->assertHasErrors();
    }
}
