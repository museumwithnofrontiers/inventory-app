<?php

namespace App\Http\Resources;

use App\Models\PartnerImage;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin PartnerImage */
class PartnerImageResource extends JsonResource
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
            // Foreign key
            'partner_id' => $this->partner_id,
            // Image information
            'path' => $this->path,
            'original_name' => $this->original_name,
            'mime_type' => $this->mime_type,
            'size' => $this->size,
            'alt_text' => $this->alt_text,
            // The picture's photographer, if any
            'photographer' => $this->photographer,
            // The picture's own credit where it is not the text burned on it
            'credit' => $this->credit,
            'display_order' => $this->display_order,
            // Relationships
            'partner' => new PartnerResource($this->whenLoaded('partner')),
            // Timestamps
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
