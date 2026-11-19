<?php

namespace App\Http\Resources;

use App\Models\ContributorImage;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin ContributorImage */
class ContributorImageResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'contributor_id' => $this->contributor_id,
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
            'contributor' => new ContributorResource($this->whenLoaded('contributor')),
            // Timestamps
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
