<?php

namespace Tests\Api\Info;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class VersionTest extends TestCase
{
    use RefreshDatabase;

    protected ?User $user = null;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        $this->actingAs($this->user);
    }

    protected function tearDown(): void
    {
        // Clean up any VERSION file created during tests
        $versionPath = base_path('VERSION');
        if (file_exists($versionPath)) {
            unlink($versionPath);
        }

        parent::tearDown();
    }

    private function createMockVersionFile(?array $data = null): void
    {
        $defaultData = [
            'repository' => 'museumwithnofrontiers/inventory-app',
            'build_timestamp' => [
                'value' => '/Date(271310400000)/',
                'DisplayHint' => 2,
                'DateTime' => 'Saturday, August 5, 1978 5:00:00 AM',
            ],
            'repository_url' => 'https://github.com/museumwithnofrontiers/inventory-app',
            'app_version' => '1.0.0-dev',
            'commit_sha' => '1e3b8e37cab51bf27faa916eec9e66b2beadb931',
        ];

        $versionData = $data ?? $defaultData;
        File::put(base_path('VERSION'), json_encode($versionData));
    }

    /**
     * Success: Assert authenticated users can access version endpoint.
     */
    public function test_authenticated_user_can_access_version()
    {
        $response = $this->getJson(route('info.version'));

        $response->assertOk();
    }

    /**
     * Structure: Assert version response structure when VERSION file exists (CI/CD scenario).
     */
    public function test_authenticated_version_response_structure_with_version_file()
    {
        $this->createMockVersionFile();

        $response = $this->getJson(route('info.version'));

        $response->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'repository',
                    'build_timestamp' => [
                        'value',
                        'DisplayHint',
                        'DateTime',
                    ],
                    'repository_url',
                    'app_version',
                    'commit_sha',
                ],
            ]);
    }

    /**
     * Structure: Assert version response structure when no VERSION file exists (fallback scenario).
     */
    public function test_authenticated_version_response_structure_fallback()
    {
        // Ensure no VERSION file exists
        $versionPath = base_path('VERSION');
        if (file_exists($versionPath)) {
            unlink($versionPath);
        }

        $response = $this->getJson(route('info.version'));

        $response->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'repository',
                    'build_timestamp' => [
                        'value',
                        'DisplayHint',
                        'DateTime',
                    ],
                    'repository_url',
                    'app_version',
                    'commit_sha',
                ],
            ]);
    }

    /**
     * Fallback: Assert fallback behavior when VERSION file is corrupted.
     */
    public function test_version_fallback_on_corrupted_file()
    {
        // Create a corrupted VERSION file
        File::put(base_path('VERSION'), '{"invalid": json}');

        $response = $this->getJson(route('info.version'));

        $response->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'repository',
                    'build_timestamp' => [
                        'value',
                        'DisplayHint',
                        'DateTime',
                    ],
                    'repository_url',
                    'app_version',
                    'commit_sha',
                ],
            ]);
    }
}
