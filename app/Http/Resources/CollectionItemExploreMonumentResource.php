<?php

namespace App\Http\Resources;

use App\Models\CollectionItemExploreMonument;
use App\Models\Partner;
use Illuminate\Http\Request;

/** @extends BaseJsonResource<CollectionItemExploreMonument> */
class CollectionItemExploreMonumentResource extends BaseJsonResource
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
            // The placement that stands for this Explore monument: an item on a collection (its id)
            'collection_item_id' => $this->resource->collection_item_id,
            // Its place in the placement's list of Explore monuments
            'position' => $this->resource->position,
            // The Explore monument's legacy key (mwnf3_explore:monument:<id>)
            'backward_compatibility' => $this->resource->backward_compatibility,
            // Its coordinates, as written
            'latitude' => $this->resource->latitude,
            'longitude' => $this->resource->longitude,
            'map_zoom' => $this->resource->map_zoom,
            // On an itinerary: the Explore location it is visited in (CollectionResource id)
            'location_collection_id' => $this->resource->location_collection_id,
            // On an itinerary: legacy's references to the texts it showed for the monument, as written
            'description_types' => $this->resource->description_types,
            'travels_description_ref' => $this->resource->travels_description_ref,
            'explore_description_ref' => $this->resource->explore_description_ref,
            'virtual_museum_description_ref' => $this->resource->virtual_museum_description_ref,
            // The museums Explore shows it as, in order (PartnerResource ids)
            'partner_ids' => $this->whenLoaded(
                'partners',
                fn (): array => $this->resource->partners->map(fn (Partner $partner): string => $partner->id)->values()->all()
            ),
            // The date of creation of the resource (managed by the system)
            'created_at' => $this->resource->created_at,
            // The date of last modification of the resource (managed by the system)
            'updated_at' => $this->resource->updated_at,

            'location_collection' => new CollectionResource($this->whenLoaded('locationCollection')),
        ];
    }
}
