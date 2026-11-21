<?php

namespace App\Http\Resources;

use App\Models\Project;
use Illuminate\Http\Request;

/** @extends BaseJsonResource<Project> */
class ProjectResource extends BaseJsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        // return parent::toArray($request);
        return [
            // The unique identifier (GUID)
            'id' => $this->resource->id,
            // A name for this resource, for internal use only.
            'internal_name' => $this->resource->internal_name,
            // The Id(s) of matching resource in the legacy system (if any).
            'backward_compatibility' => $this->resource->backward_compatibility,
            // The date MWNF started the work, nullable
            'launch_date' => $this->resource->launch_date,
            // The public URL of the project's website, nullable
            'site_url' => $this->resource->site_url,
            // The URL of a related external database, nullable
            'related_database_url' => $this->resource->related_database_url,
            // The URL of the project's artistic introduction page, nullable
            'artistic_introduction_url' => $this->resource->artistic_introduction_url,
            // The default context used within the project (ContextResource)
            'context' => new ContextResource($this->whenLoaded('context')),
            // The default language used within the project (LanguageResource)
            'language' => new LanguageResource($this->whenLoaded('language')),
            // The project's name in each language (ProjectTranslationResource[])
            'translations' => ProjectTranslationResource::collection($this->whenLoaded('translations')),
            // The date of creation of the resource (managed by the system)
            'created_at' => $this->resource->created_at,
            // The date of last modification of the resource (managed by the system)
            'updated_at' => $this->resource->updated_at,
        ];
    }
}
