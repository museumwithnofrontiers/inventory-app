<?php

namespace App\Http\Resources;

use App\Models\CollectionItemTranslation;
use Illuminate\Http\Request;

/** @extends BaseJsonResource<CollectionItemTranslation> */
class CollectionItemTranslationResource extends BaseJsonResource
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
            // The placement these texts belong to: an item on a collection (its id)
            'collection_item_id' => $this->resource->collection_item_id,
            // The language of these texts (LanguageResource id)
            'language_id' => $this->resource->language_id,
            // The detail view's name, as written
            'title' => $this->resource->title,
            // The item's text on this collection (Markdown), as written
            'description' => $this->resource->description,
            // Sharing History: the curator's justification for the selection
            'curator_justification' => $this->resource->curator_justification,
            // Sharing History: the partner's justification for the selection
            'partner_justification' => $this->resource->partner_justification,
            // Sharing History National Context: the justification for the selection
            'justification' => $this->resource->justification,
            // The image caption, as written
            'caption' => $this->resource->caption,
            // The item's caption on this collection, as written: name, date, location, museum
            'item_name' => $this->resource->item_name,
            'item_date' => $this->resource->item_date,
            'item_location' => $this->resource->item_location,
            'item_museum' => $this->resource->item_museum,
            // The item's dynasty, artist and material lines on this collection, as written
            'item_dynasty' => $this->resource->item_dynasty,
            'item_artist' => $this->resource->item_artist,
            'item_material' => $this->resource->item_material,
            // The Id(s) of matching resource in the legacy system (if any).
            'backward_compatibility' => $this->resource->backward_compatibility,
            // The date of creation of the resource (managed by the system)
            'created_at' => $this->resource->created_at,
            // The date of last modification of the resource (managed by the system)
            'updated_at' => $this->resource->updated_at,

            'language' => new LanguageResource($this->whenLoaded('language')),
        ];
    }
}
