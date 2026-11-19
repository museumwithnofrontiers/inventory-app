<?php

namespace App\Http\Resources;

use App\Models\CollectionTranslation;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * CollectionTranslation Resource
 *
 * Transforms CollectionTranslation model data for API responses.
 * Includes relationships and computed attributes for API consumption.
 *
 * @mixin CollectionTranslation
 */
class CollectionTranslationResource extends JsonResource
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
            // The collection this translation belongs to (CollectionResource id)
            'collection_id' => $this->collection_id,
            // The language of this translation (LanguageResource id)
            'language_id' => $this->language_id,
            // The context of this translation (ContextResource id)
            'context_id' => $this->context_id,
            // The title of the collection translation
            'title' => $this->title,
            // The subtitle, as written (optional)
            'subtitle' => $this->subtitle,
            // The description of the collection translation
            'description' => $this->description,
            // The introduction, as written (optional, Markdown)
            'introduction' => $this->introduction,
            // The quote/introduction of the collection translation (optional)
            'quote' => $this->quote,
            // A trail's duration, as written, e.g. "One day" (optional)
            'duration' => $this->duration,
            // The URL for the collection translation
            'url' => $this->url,
            // The Id(s) of matching resource in the legacy system (if any).
            'backward_compatibility' => $this->backward_compatibility,
            // Extra data for translation (object, may be null)
            'extra' => $this->extra,
            // The date of creation of the resource (managed by the system)
            'created_at' => $this->created_at,
            // The date of last modification of the resource (managed by the system)
            'updated_at' => $this->updated_at,

            // The collection relationship (CollectionResource)
            'collection' => new CollectionResource($this->whenLoaded('collection')),
            // The language relationship (LanguageResource)
            'language' => new LanguageResource($this->whenLoaded('language')),
            // The context relationship (ContextResource)
            'context' => new ContextResource($this->whenLoaded('context')),
        ];
    }
}
