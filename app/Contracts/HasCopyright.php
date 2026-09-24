<?php

namespace App\Contracts;

interface HasCopyright
{
    /**
     * Resolve the copyright text to display for this image: its own value,
     * else the owning Project's value, else the global fallback.
     */
    public function resolveCopyright(): string;
}
