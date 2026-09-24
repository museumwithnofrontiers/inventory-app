<?php

namespace Tests\Unit\Models;

use App\Models\Context;
use App\Models\Language;
use App\Models\Project;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Tests for Project factory states and methods.
 */
class ProjectFactoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_projects_table_has_url_columns(): void
    {
        $this->assertTrue(Schema::hasColumn('projects', 'site_url'), 'projects must carry a `site_url` column');
        $this->assertTrue(Schema::hasColumn('projects', 'related_database_url'), 'projects must carry a `related_database_url` column');
        $this->assertTrue(Schema::hasColumn('projects', 'artistic_introduction_url'), 'projects must carry an `artistic_introduction_url` column');
    }

    public function test_projects_table_has_copyright_column(): void
    {
        $this->assertTrue(Schema::hasColumn('projects', 'copyright'), 'projects must carry a `copyright` column');
    }

    public function test_project_copyright_defaults_to_null_and_can_be_set(): void
    {
        $project = Project::factory()->create();

        $this->assertNull($project->copyright);

        $project->update(['copyright' => '© Discover Islamic Art']);

        $this->assertSame('© Discover Islamic Art', $project->fresh()->copyright);
    }

    public function test_factory_creates_valid_project(): void
    {
        $project = Project::factory()->create();

        $this->assertInstanceOf(Project::class, $project);
        $this->assertNotEmpty($project->id);
        $this->assertNotEmpty($project->internal_name);
        $this->assertFalse($project->is_enabled);
        $this->assertFalse($project->is_launched);
        $this->assertNull($project->site_url);
        $this->assertNull($project->related_database_url);
        $this->assertNull($project->artistic_introduction_url);
    }

    public function test_factory_with_urls_sets_url_fields(): void
    {
        $project = Project::factory()->withUrls()->create();

        $this->assertNotNull($project->site_url);
        $this->assertNotNull($project->related_database_url);
        $this->assertNotNull($project->artistic_introduction_url);
        $this->assertNotFalse(filter_var($project->site_url, FILTER_VALIDATE_URL));
        $this->assertNotFalse(filter_var($project->related_database_url, FILTER_VALIDATE_URL));
        $this->assertNotFalse(filter_var($project->artistic_introduction_url, FILTER_VALIDATE_URL));
    }

    public function test_factory_with_enabled_sets_enabled_flag(): void
    {
        $project = Project::factory()->withEnabled()->create();

        $this->assertTrue($project->is_enabled);
    }

    public function test_factory_with_launched_sets_launched_state(): void
    {
        $project = Project::factory()->withLaunched()->create();

        $this->assertTrue($project->is_launched);
        $this->assertNotNull($project->launch_date);
    }

    public function test_factory_with_context_creates_context_relationship(): void
    {
        $project = Project::factory()->withContext()->create();

        $this->assertNotNull($project->context_id);
        $this->assertInstanceOf(Context::class, $project->context);
    }

    public function test_factory_with_language_creates_language_relationship(): void
    {
        $project = Project::factory()->withLanguage()->create();

        $this->assertNotNull($project->language_id);
        $this->assertInstanceOf(Language::class, $project->language);
    }
}
