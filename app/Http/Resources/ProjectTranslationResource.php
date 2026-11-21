<?php

namespace App\Http\Resources;

use App\Models\ProjectTranslation;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin ProjectTranslation */
class ProjectTranslationResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            // The unique identifier (GUID)
            'id' => $this->id,
            // The project this name belongs to
            'project_id' => $this->project_id,
            // The language of the name (ISO 639-3)
            'language_id' => $this->language_id,
            // The project's name in that language, as written
            'name' => $this->name,
            // The project (ProjectResource), when included
            'project' => new ProjectResource($this->whenLoaded('project')),
            // The language (LanguageResource), when included
            'language' => new LanguageResource($this->whenLoaded('language')),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
