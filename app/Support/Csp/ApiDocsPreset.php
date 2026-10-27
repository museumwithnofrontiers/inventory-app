<?php

namespace App\Support\Csp;

use Spatie\Csp\Directive;
use Spatie\Csp\Policy;

/**
 * The Content Security Policy of the API documentation page (Scramble).
 *
 * The same as every other page, plus the CDN that Scramble's documentation
 * view loads Stoplight Elements from. It is applied to that route only, so
 * the CDN never becomes an allowed source anywhere else.
 */
class ApiDocsPreset extends InventoryPreset
{
    public function configure(Policy $policy): void
    {
        parent::configure($policy);

        $policy->add([Directive::SCRIPT, Directive::STYLE, Directive::FONT], 'https://unpkg.com');
    }
}
