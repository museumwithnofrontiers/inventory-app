<?php

namespace App\Http\Resources;

use App\Models\Link;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Link */
class LinkResource extends JsonResource
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
            // The owner's kind: item, collection, partner or publication_edition
            'linkable_type' => $this->linkable_type,
            // The owner's id
            'linkable_id' => $this->linkable_id,
            // The language of the link, if it has one
            'language_id' => $this->language_id,
            // What it points at: video, audio, document, website, shop, catalogue, further_reading, virtual_visit
            'type' => $this->type,
            'title' => $this->title,
            'url' => $this->url,
            'description' => $this->description,
            'authors' => $this->authors,
            // The legacy category id (the site names it), the resource type, the linked
            // entity's location and country code, and a further-reading text, as written
            'category' => $this->category,
            'resource_type' => $this->resource_type,
            'location' => $this->location,
            'country_code' => $this->country_code,
            'further_reading' => $this->further_reading,
            'display_order' => $this->display_order,
            // Residual legacy values (holding area)
            'extra' => $this->extra,
            'backward_compatibility' => $this->backward_compatibility,
            'language' => new LanguageResource($this->whenLoaded('language')),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
