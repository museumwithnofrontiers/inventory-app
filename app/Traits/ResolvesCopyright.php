<?php

namespace App\Traits;

use App\Models\Project;

/**
 * Three-tier copyright resolution: the image's own `copyright`, else the
 * owning Project's `copyright` (resolved live via the relationship, never
 * copied onto the image row), else the global fallback.
 *
 * Models that never reach a Project (CollectionImage, ContributorImage,
 * TimelineEventImage) simply don't override copyrightProject() and fall
 * through to the global fallback.
 *
 * @property string|null $copyright
 */
trait ResolvesCopyright
{
    public const string GLOBAL_FALLBACK = '© Museum With No Frontiers';

    public function resolveCopyright(): string
    {
        /** @var string|null $ownCopyright */
        $ownCopyright = $this->copyright;

        if ($ownCopyright !== null) {
            return $ownCopyright;
        }

        $project = $this->copyrightProject();
        if ($project !== null && $project->copyright !== null) {
            return $project->copyright;
        }

        return self::GLOBAL_FALLBACK;
    }

    /**
     * The Project this image's copyright should fall back to, if any.
     */
    protected function copyrightProject(): ?Project
    {
        return null;
    }
}
