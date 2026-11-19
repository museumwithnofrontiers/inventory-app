<?php

namespace App\Http\Resources;

use App\Models\TimelineEventImage;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin TimelineEventImage */
class TimelineEventImageResource extends JsonResource
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
            'timeline_event_id' => $this->timeline_event_id,
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
            'timeline_event' => new TimelineEventResource($this->whenLoaded('timelineEvent')),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
