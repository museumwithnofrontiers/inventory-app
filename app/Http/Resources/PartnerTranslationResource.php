<?php

namespace App\Http\Resources;

use App\Models\PartnerTranslation;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin PartnerTranslation */
class PartnerTranslationResource extends JsonResource
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
            // Foreign keys
            'partner_id' => $this->partner_id,
            'language_id' => $this->language_id,
            'context_id' => $this->context_id,
            // Core partner info
            'name' => $this->name,
            'description' => $this->description,
            // Address fields (embedded)
            'city_display' => $this->city_display,
            'address_line_1' => $this->address_line_1,
            'address_line_2' => $this->address_line_2,
            'postal_code' => $this->postal_code,
            'address_notes' => $this->address_notes,
            // Contact fields (semi-structured)
            'contact_name' => $this->contact_name,
            'contact_email_general' => $this->contact_email_general,
            'contact_email_press' => $this->contact_email_press,
            'contact_phone' => $this->contact_phone,
            'contact_fax' => $this->contact_fax,
            'contact_website' => $this->contact_website,
            'contact_notes' => $this->contact_notes,
            'contact_emails' => $this->contact_emails,
            'contact_phones' => $this->contact_phones,
            // Relationships
            'partner' => new PartnerResource($this->whenLoaded('partner')),
            'language' => new LanguageResource($this->whenLoaded('language')),
            'context' => new ContextResource($this->whenLoaded('context')),
            'partner_translation_images' => PartnerTranslationImageResource::collection($this->whenLoaded('partnerTranslationImages')),
            // Metadata
            'backward_compatibility' => $this->backward_compatibility,
            'extra' => $this->extra,
            // Timestamps
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
