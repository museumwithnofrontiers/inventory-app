<?php

namespace App\Http\Controllers;

use App\Http\Resources\AppInfoResource;
use App\Http\Resources\HealthResource;
use App\Http\Resources\VersionResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * InfoController provides application information and health check endpoints.
 *
 * This controller handles requests for application metadata such as version,
 * health status, and system information that may be needed by monitoring
 * systems or API consumers.
 */
class InfoController extends Controller
{
    /**
     * Get application information including version and health status.
     *
     * Returns basic application information including:
     * - Application name and version
     * - Health check status for key services
     * - Timestamp of the response
     *
     * @return JsonResponse Application information and health status
     */
    public function index(): JsonResponse
    {
        $healthChecks = $this->performHealthChecks();

        $versionResource = $this->version();
        $versionData = is_array($versionResource->resource) ? $versionResource->resource : [];

        $info = [
            'application' => [
                'name' => config('app.name'),
                'version' => $versionData['app_version'] ?? '1.0.0-dev',
                'environment' => config('app.env'),
            ],
            'health' => [
                'status' => $healthChecks['overall_status'],
                'checks' => $healthChecks['checks'],
            ],
            'timestamp' => now()->toISOString(),
        ];

        $statusCode = $healthChecks['overall_status'] === 'healthy' ? 200 : 503;

        return response()->json((new AppInfoResource($info))->toArray(request()), $statusCode);
    }

    /**
     * Get only the health check status.
     *
     * Lightweight endpoint for health monitoring that returns
     * only the essential health status information.
     *
     * @return JsonResponse Health check status
     */
    public function health(): JsonResponse
    {
        $healthChecks = $this->performHealthChecks();

        $health = [
            'status' => $healthChecks['overall_status'],
            'checks' => $healthChecks['checks'],
            'timestamp' => now()->toISOString(),
        ];

        $statusCode = $health['status'] === 'healthy' ? 200 : 503;

        return response()->json((new HealthResource($health))->toArray(request()), $statusCode);
    }

    /**
     * Get application version information only.
     *
     * Simple endpoint that returns just the version information
     * for deployment tracking and API compatibility checks.
     *
     * @return VersionResource Version information
     */
    public function version(): VersionResource
    {
        // If a deployment has produced a VERSION file at repo root, return its content as-is.
        $versionPath = base_path('VERSION');
        if (file_exists($versionPath)) {
            try {
                $raw = @file_get_contents($versionPath);
                $decoded = @json_decode((string) $raw, true);
                if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                    return new VersionResource($decoded);
                }
            } catch (\Exception $e) {
                // fallthrough to default behaviour below
            }
        }

        // Fallback to CI/CD structure with default/null values
        return new VersionResource([
            'repository' => null,
            'build_timestamp' => [
                'value' => '/Date('.((int) now()->timestamp * 1000).')/',
                'DisplayHint' => 2,
                'DateTime' => now()->format('l j F Y H:i:s'),
            ],
            'repository_url' => null,
            'app_version' => '1.0.0-dev',
            'commit_sha' => null,
        ]);
    }

    /**
     * Perform health checks on critical application services.
     *
     * Checks the health of key application dependencies including
     * database connectivity and cache functionality.
     *
     * @return array<string, mixed> Health check results with overall status
     */
    private function performHealthChecks(): array
    {
        $checks = [];
        $allHealthy = true;

        // Database health check
        try {
            DB::connection()->getPdo();
            DB::select('SELECT 1');
            $checks['database'] = [
                'status' => 'healthy',
                'message' => 'Database connection successful',
            ];
        } catch (\Exception $e) {
            $checks['database'] = [
                'status' => 'unhealthy',
                'message' => 'Database connection failed: '.$e->getMessage(),
            ];
            $allHealthy = false;
        }

        // Cache health check
        try {
            $testKey = 'health_check_'.now()->timestamp;
            $testValue = 'test_value';

            Cache::put($testKey, $testValue, 60);
            $retrieved = Cache::get($testKey);
            Cache::forget($testKey);

            if ($retrieved === $testValue) {
                $checks['cache'] = [
                    'status' => 'healthy',
                    'message' => 'Cache operations successful',
                ];
            } else {
                $checks['cache'] = [
                    'status' => 'unhealthy',
                    'message' => 'Cache read/write verification failed',
                ];
                $allHealthy = false;
            }
        } catch (\Exception $e) {
            $checks['cache'] = [
                'status' => 'unhealthy',
                'message' => 'Cache operations failed: '.$e->getMessage(),
            ];
            $allHealthy = false;
        }

        return [
            'overall_status' => $allHealthy ? 'healthy' : 'unhealthy',
            'checks' => $checks,
        ];
    }
}
