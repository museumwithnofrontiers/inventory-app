<?php

namespace App\Http\Controllers\Filament;

use App\Http\Controllers\Controller;
use App\Http\Responses\Image\DownloadImageResponse;
use App\Http\Responses\Image\InlineImageResponse;
use App\Models\TimelineEvent;
use App\Models\TimelineEventImage;

class TimelineEventImageController extends Controller
{
    public function view(TimelineEvent $timelineEvent, TimelineEventImage $timelineEventImage): InlineImageResponse
    {
        $this->authorize('view', $timelineEventImage);

        if ($timelineEventImage->timeline_event_id !== $timelineEvent->id) {
            abort(404);
        }

        return new InlineImageResponse($timelineEventImage);
    }

    public function download(TimelineEvent $timelineEvent, TimelineEventImage $timelineEventImage): DownloadImageResponse
    {
        $this->authorize('view', $timelineEventImage);

        if ($timelineEventImage->timeline_event_id !== $timelineEvent->id) {
            abort(404);
        }

        return new DownloadImageResponse($timelineEventImage);
    }
}
