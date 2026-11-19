<?php

namespace App\Http\Resources;

use App\Models\PartnerContact;
use Illuminate\Http\Request;

/** @extends BaseJsonResource<PartnerContact> */
class PartnerContactResource extends BaseJsonResource
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
            // The partner this contact belongs to (PartnerResource id)
            'partner_id' => $this->resource->partner_id,
            // Legacy's order: contact person 1, 2…
            'display_order' => $this->resource->display_order,
            // The contact's name, title, e-mail, phone and fax, as written
            'name' => $this->resource->name,
            'title' => $this->resource->title,
            'email' => $this->resource->email,
            'phone' => $this->resource->phone,
            'fax' => $this->resource->fax,
            // The Id(s) of matching resource in the legacy system (if any).
            'backward_compatibility' => $this->resource->backward_compatibility,
            // The date of creation of the resource (managed by the system)
            'created_at' => $this->resource->created_at,
            // The date of last modification of the resource (managed by the system)
            'updated_at' => $this->resource->updated_at,

            'partner' => new PartnerResource($this->whenLoaded('partner')),
        ];
    }
}
