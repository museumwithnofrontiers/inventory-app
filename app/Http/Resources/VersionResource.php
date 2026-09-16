<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Resource for application version information.
 */
class VersionResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $data = is_array($this->resource) ? $this->resource : [];

        return [
            'repository' => $data['repository'] ?? null,
            'build_timestamp' => $data['build_timestamp'] ?? null,
            'repository_url' => $data['repository_url'] ?? null,
            'app_version' => $data['app_version'] ?? '1.0.0-dev',
            'commit_sha' => $data['commit_sha'] ?? null,
        ];
    }
}
