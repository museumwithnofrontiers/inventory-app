<?php

namespace App\Support\Images;

/**
 * Where ImageBurner draws on an image of a given size: the bar spans the
 * full width from barTop to the bottom edge, and the lines are drawn from
 * (padding, barTop + padding), one below the other.
 */
final readonly class BurnLayout
{
    /**
     * @param  list<string>  $lines
     */
    public function __construct(
        public int $fontSize,
        public int $padding,
        public int $barTop,
        public int $barHeight,
        public array $lines,
    ) {}
}
