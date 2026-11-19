<?php

namespace App\Http\Resources;

use App\Models\Partner;
use Illuminate\Http\Request;

/** @extends BaseJsonResource<Partner> */
class PartnerResource extends BaseJsonResource
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
            // A name for this resource, for internal use only.
            'internal_name' => $this->resource->internal_name,
            // The Id(s) of matching resource in the legacy system (if any).
            'backward_compatibility' => $this->resource->backward_compatibility,
            // The type of the partner, either 'museum', 'institution' or 'individual'.
            'type' => $this->resource->type,
            // The country this partner is associated with, nullable (CountryResource)
            'country' => new CountryResource($this->whenLoaded('country')),
            // GPS Location
            'latitude' => $this->resource->latitude,
            'longitude' => $this->resource->longitude,
            'map_zoom' => $this->resource->map_zoom,
            // Relationships
            'project' => new ProjectResource($this->whenLoaded('project')),
            'monument_item' => new ItemResource($this->whenLoaded('monumentItem')),
            'translations' => PartnerTranslationResource::collection($this->whenLoaded('translations')),
            'images' => PartnerImageResource::collection($this->whenLoaded('partnerImages')),
            'collections' => CollectionResource::collection($this->whenLoaded('collections')),
            'links' => LinkResource::collection($this->whenLoaded('links')),
            // Visibility
            'visible' => $this->resource->visible,
            // The date of creation of the resource (managed by the system)
            'created_at' => $this->resource->created_at,
            // The date of last modification of the resource (managed by the system)
            'updated_at' => $this->resource->updated_at,
        ];
    }
}
