<?php

namespace App\Http\Resources;

use App\Models\Item;
use Illuminate\Http\Request;

/** @extends BaseJsonResource<Item> */
class ItemResource extends BaseJsonResource
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
            // The type of the item: 'object', 'monument', 'detail', or 'picture'.
            'type' => $this->resource->type,
            // Not ready for any site: no site's data holds a draft item, its details or its pictures
            'draft' => $this->resource->draft,
            // The parent item ID (for hierarchical relationships), nullable
            'parent_id' => $this->resource->parent_id,
            // Display order among siblings sharing the same parent, nullable
            'display_order' => $this->resource->display_order,
            // Owner's reference number for the item (external reference from owner)
            'owner_reference' => $this->resource->owner_reference,
            // MWNF reference number for the item (reference from MWNF system)
            'mwnf_reference' => $this->resource->mwnf_reference,
            // The start year for the item (for datation purposes)
            'start_date' => $this->resource->start_date,
            // The end year for the item (for datation purposes)
            'end_date' => $this->resource->end_date,
            // The parent item (for hierarchical relationships), nullable (ItemResource)
            'parent' => new ItemResource($this->whenLoaded('parent')),
            // The child items (for hierarchical relationships) (ItemResource[])
            'children' => ItemResource::collection($this->whenLoaded('children')),
            // The partner owning the item (PartnerResource)
            'partner' => new PartnerResource($this->whenLoaded('partner')),
            // The project this item belongs to, nullable (ProjectResource)
            'project' => new ProjectResource($this->whenLoaded('project')),
            // The country this item is associated with, nullable (CountryResource)
            'country' => new CountryResource($this->whenLoaded('country')),
            // The collection that contains this item (CollectionResource)
            'collection' => new CollectionResource($this->whenLoaded('collection')),
            // Artists associated with this item (ArtistResource[])
            'artists' => ArtistResource::collection($this->whenLoaded('artists')),
            // Tags associated with this item (TagResource[])
            'tags' => TagResource::collection($this->whenLoaded('tags')),
            // Dynasties associated with this item (DynastyResource[])
            'dynasties' => DynastyResource::collection($this->whenLoaded('dynasties')),
            // Translations for this item (internationalization and contextualization) (ItemTranslationResource[])
            'translations' => ItemTranslationResource::collection($this->whenLoaded('translations')),
            // Item images attached to this item with display ordering (ItemImageResource[])
            'itemImages' => ItemImageResource::collection($this->whenLoaded('itemImages')),
            // Links to things outside the inventory (videos, catalogue entries, ...)
            'links' => LinkResource::collection($this->whenLoaded('links')),
            // The date of creation of the resource (managed by the system)
            'created_at' => $this->resource->created_at,
            // The date of last modification of the resource (managed by the system)
            'updated_at' => $this->resource->updated_at,
        ];
    }
}
