<?php

namespace App\Http\Resources;

use App\Models\VisitInformation;
use Illuminate\Http\Request;

/** @extends BaseJsonResource<VisitInformation> */
class VisitInformationResource extends BaseJsonResource
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
            // The owner: exactly one of the item (a monument), the collection (a travel location) or the partner
            'item_id' => $this->resource->item_id,
            'collection_id' => $this->resource->collection_id,
            'partner_id' => $this->resource->partner_id,
            // The language of these texts (LanguageResource id)
            'language_id' => $this->resource->language_id,
            // The context of these texts (ContextResource id)
            'context_id' => $this->resource->context_id,
            // How to reach the place, as written
            'how_to_reach' => $this->resource->how_to_reach,
            // Opening hours, as written
            'opening_hours' => $this->resource->opening_hours,
            // Contact, as written
            'contact' => $this->resource->contact,
            // Address, as written
            'address' => $this->resource->address,
            // The institution to contact, as written
            'institution' => $this->resource->institution,
            // Practical information (hours, fees, access…), as written
            'practical_information' => $this->resource->practical_information,
            'phone' => $this->resource->phone,
            'fax' => $this->resource->fax,
            'email' => $this->resource->email,
            'website' => $this->resource->website,
            // The Id(s) of matching resource in the legacy system (if any).
            'backward_compatibility' => $this->resource->backward_compatibility,
            // Residual legacy values (holding area)
            'extra' => $this->resource->extra,
            // The date of creation of the resource (managed by the system)
            'created_at' => $this->resource->created_at,
            // The date of last modification of the resource (managed by the system)
            'updated_at' => $this->resource->updated_at,

            'item' => new ItemResource($this->whenLoaded('item')),
            'collection' => new CollectionResource($this->whenLoaded('collection')),
            'partner' => new PartnerResource($this->whenLoaded('partner')),
            'language' => new LanguageResource($this->whenLoaded('language')),
            'context' => new ContextResource($this->whenLoaded('context')),
        ];
    }
}
