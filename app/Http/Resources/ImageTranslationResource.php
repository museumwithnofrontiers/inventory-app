<?php

namespace App\Http\Resources;

use App\Models\ImageTranslation;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin ImageTranslation */
class ImageTranslationResource extends JsonResource
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
            // The image's kind (e.g. item_image, collection_image) and id
            'image_type' => $this->image_type,
            'image_id' => $this->image_id,
            'language_id' => $this->language_id,
            // A caption as legacy wrote it
            'caption' => $this->caption,
            // The parts of a caption legacy kept as separate fields, as written
            'name' => $this->name,
            'date' => $this->date,
            'museum' => $this->museum,
            'location' => $this->location,
            'backward_compatibility' => $this->backward_compatibility,
            'language' => new LanguageResource($this->whenLoaded('language')),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
