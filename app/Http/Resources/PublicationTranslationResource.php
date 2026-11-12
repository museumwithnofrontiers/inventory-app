<?php

namespace App\Http\Resources;

use App\Models\PublicationTranslation;
use Illuminate\Http\Request;

/** @extends BaseJsonResource<PublicationTranslation> */
class PublicationTranslationResource extends BaseJsonResource
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
            'id' => $this->resource->id,
            // The publication this text belongs to (PublicationResource id)
            'publication_id' => $this->resource->publication_id,
            // The language of this text (LanguageResource id)
            'language_id' => $this->resource->language_id,
            // The context of this text (ContextResource id)
            'context_id' => $this->resource->context_id,
            'title' => $this->resource->title,
            'subtitle' => $this->resource->subtitle,
            // About this publication (Markdown)
            'description' => $this->resource->description,
            // More about this publication (Markdown)
            'introduction' => $this->resource->introduction,
            // The author credit line, as printed
            'author_credit' => $this->resource->author_credit,
            // The photography credit line, as printed
            'photography_credit' => $this->resource->photography_credit,
            // The coordination credit line, as printed
            'coordination_credit' => $this->resource->coordination_credit,
            // The Id(s) of matching resource in the legacy system (if any).
            'backward_compatibility' => $this->resource->backward_compatibility,
            // Residual legacy values (holding area)
            'extra' => $this->resource->extra,
            // The date of creation of the resource (managed by the system)
            'created_at' => $this->resource->created_at,
            // The date of last modification of the resource (managed by the system)
            'updated_at' => $this->resource->updated_at,

            'publication' => new PublicationResource($this->whenLoaded('publication')),
            'language' => new LanguageResource($this->whenLoaded('language')),
            'context' => new ContextResource($this->whenLoaded('context')),
        ];
    }
}
