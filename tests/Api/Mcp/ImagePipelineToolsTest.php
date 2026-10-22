<?php

namespace Tests\Api\Mcp;

use App\Enums\Permission;
use App\Mcp\Servers\InventoryServer;
use App\Mcp\Tools\Pipeline\AuditAttachedImages;
use App\Mcp\Tools\Pipeline\FindOrphans;
use App\Mcp\Tools\Pipeline\ImagePipelineStatus;
use App\Mcp\Tools\Pipeline\ListAvailableImages;
use App\Mcp\Tools\Pipeline\ListPendingUploads;
use App\Mcp\Tools\Pipeline\ListStaleRenditions;
use App\Mcp\Tools\Pipeline\QueueStatus;
use App\Mcp\Tools\Pipeline\TraceImage;
use App\Models\AvailableImage;
use App\Models\ImageUpload;
use App\Models\Item;
use App\Models\ItemImage;
use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\Fluent\AssertableJson;
use Laravel\Mcp\Server\Testing\TestResponse;
use Tests\TestCase;

/**
 * The image-pipeline observation tools: each anomaly shows up, and no tool
 * writes to any of the three disks.
 */
class ImagePipelineToolsTest extends TestCase
{
    use RefreshDatabase;

    private User $observer;

    private ItemImage $healthy;

    private ItemImage $missingOriginal;

    private ItemImage $stale;

    private ImageUpload $stuckUpload;

    private AvailableImage $pooled;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        Storage::fake('public');
        config([
            'localstorage.uploads.images.disk' => 'local',
            'localstorage.pictures.disk' => 'public',
            'localstorage.pictures.directory' => 'pictures',
        ]);

        $this->observer = User::factory()->create();
        $this->observer->givePermissionTo([Permission::ACCESS_MCP->value, Permission::VIEW_DATA->value]);

        $this->buildAnomalies();
    }

    public function test_the_status_shows_every_stage_and_its_anomalies(): void
    {
        $this->observe(ImagePipelineStatus::class)
            ->assertOk()
            ->assertStructuredContent(fn (AssertableJson $json): AssertableJson => $json
                ->where('uploads.pending', 1)
                ->where('uploads.stuck', 1)
                ->where('available_images.count', 1)
                ->where('attached.has_issues', true)
                // Just written, so within the grace period an upload may need
                ->where('originals_disk.orphans', 0)
                ->where('originals_disk.recent_unreferenced', 1)
                ->where('pictures_cache.orphans', 1)
                ->etc());
    }

    public function test_each_anomaly_shows_up_in_its_tool(): void
    {
        $this->observe(ListPendingUploads::class)->assertOk()->assertSee($this->stuckUpload->id);
        $this->observe(ListAvailableImages::class)->assertOk()->assertSee($this->pooled->id);
        $this->observe(AuditAttachedImages::class)->assertOk()->assertSee($this->missingOriginal->imageStoragePath());
        $this->observe(FindOrphans::class, ['disk' => 'originals', 'older_than_hours' => 0])->assertOk()->assertSee('orphan-original.jpg');
        $this->observe(FindOrphans::class, ['disk' => 'pictures'])->assertOk()->assertSee('orphan-picture.jpg');
        $this->observe(ListStaleRenditions::class)
            ->assertOk()
            ->assertStructuredContent(fn (AssertableJson $json): AssertableJson => $json
                ->where('cache.stale', 1)
                ->where('renditions.shown.0.id', $this->stale->id)
                ->etc());
        $this->observe(QueueStatus::class)->assertOk()->assertSee('"pending"');
    }

    public function test_trace_finds_one_image_by_id_filename_or_public_url(): void
    {
        $refs = [
            $this->healthy->id,
            $this->healthy->path,
            route('pub.picture', ['filename' => $this->healthy->path]),
        ];

        foreach ($refs as $ref) {
            $this->observe(TraceImage::class, ['ref' => $ref])
                ->assertOk()
                ->assertStructuredContent(fn (AssertableJson $json): AssertableJson => $json
                    ->where('stage', 'attached')
                    ->where('type', 'item_image')
                    ->where('id', $this->healthy->id)
                    ->where('original.present', true)
                    ->where('copyright.text', 'Project rights')
                    ->where('copyright.source', 'project')
                    ->where('rendition.cache', 'missing')
                    ->etc());
        }

        $this->observe(TraceImage::class, ['ref' => $this->stuckUpload->id])
            ->assertOk()
            ->assertStructuredContent(fn (AssertableJson $json): AssertableJson => $json->where('stage', 'upload')->etc());
        $this->observe(TraceImage::class, ['ref' => $this->pooled->id])
            ->assertOk()
            ->assertStructuredContent(fn (AssertableJson $json): AssertableJson => $json->where('stage', 'available')->etc());
    }

    public function test_no_tool_writes_to_any_disk(): void
    {
        $before = $this->allFiles();

        $this->observe(ImagePipelineStatus::class);
        $this->observe(ListPendingUploads::class);
        $this->observe(ListAvailableImages::class);
        $this->observe(AuditAttachedImages::class);
        $this->observe(FindOrphans::class, ['disk' => 'originals', 'older_than_hours' => 0]);
        $this->observe(FindOrphans::class, ['disk' => 'pictures']);
        $this->observe(ListStaleRenditions::class);
        $this->observe(QueueStatus::class);
        $this->observe(TraceImage::class, ['ref' => $this->healthy->id]);
        $this->observe(TraceImage::class, ['ref' => $this->stale->id]);

        $this->assertSame($before, $this->allFiles());
    }

    public function test_observing_needs_view_data(): void
    {
        $outsider = User::factory()->create();
        $outsider->givePermissionTo(Permission::ACCESS_MCP->value);

        InventoryServer::actingAs($outsider)->tool(ImagePipelineStatus::class)->assertHasErrors();
        InventoryServer::actingAs($outsider)->tool(TraceImage::class, ['ref' => $this->healthy->id])->assertHasErrors();
    }

    private function buildAnomalies(): void
    {
        $originals = Storage::disk(config('localstorage.available.images.disk'));
        $originalsDirectory = trim(config('localstorage.available.images.directory'), '/');
        $project = Project::factory()->create(['copyright' => 'Project rights']);
        $item = Item::factory()->Object()->create(['project_id' => $project->id]);

        // Attached, original present, nothing burned yet
        $this->healthy = ItemImage::factory()->forItem($item)->create(['path' => 'healthy.jpg', 'copyright' => null]);
        $originals->put($originalsDirectory.'/healthy.jpg', 'original');

        // Attached, original gone
        $this->missingOriginal = ItemImage::factory()->forItem($item)->create(['path' => 'gone.jpg']);

        // Attached, cached rendition burned for an older copyright
        $this->stale = ItemImage::factory()->forItem($item)->create(['path' => 'stale.jpg', 'copyright' => 'Now']);
        $originals->put($originalsDirectory.'/stale.jpg', 'original');
        Storage::disk('public')->put('pictures/stale.jpg', 'burned-long-ago');
        Cache::forever('image-copyright-etag:stale.jpg', '"an-older-etag"');

        // Orphans on both disks
        $originals->put($originalsDirectory.'/orphan-original.jpg', 'nobody');
        Storage::disk('public')->put('pictures/orphan-picture.jpg', 'nobody');

        // An upload the listener never finished, and an image in the pool
        $this->stuckUpload = ImageUpload::factory()->create(['created_at' => now()->subMinutes(30)]);
        $this->pooled = AvailableImage::factory()->create();
    }

    /**
     * @param  class-string  $tool
     * @param  array<string, mixed>  $arguments
     */
    private function observe(string $tool, array $arguments = []): TestResponse
    {
        return InventoryServer::actingAs($this->observer)->tool($tool, $arguments);
    }

    /**
     * @return array<string, list<string>>
     */
    private function allFiles(): array
    {
        return [
            'uploads' => Storage::disk('local')->allFiles(),
            'originals' => Storage::disk(config('localstorage.available.images.disk'))->allFiles(),
            'pictures' => Storage::disk('public')->allFiles(),
        ];
    }
}
