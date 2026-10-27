<?php

namespace App\Support\Csp;

use Spatie\Csp\Directive;
use Spatie\Csp\Keyword;
use Spatie\Csp\Policy;
use Spatie\Csp\Preset;
use Spatie\Csp\Presets\BunnyFonts;

/**
 * The Content Security Policy of every page the app renders (the Filament
 * panel and the web group).
 *
 * Filament 3 renders inline scripts and style attributes, and the standard
 * Alpine build evaluates its expressions with `new Function`, so scripts and
 * styles need 'unsafe-inline' and scripts 'unsafe-eval'. What the policy does
 * restrict: where anything else is loaded from or sent to, framing by other
 * sites, `<base>` rewriting and plugins.
 *
 * There is deliberately no form-action: Chrome applies it to the redirect
 * that follows a form submission, which would block the OAuth consent's
 * redirect to the client's callback.
 */
class InventoryPreset implements Preset
{
    public function configure(Policy $policy): void
    {
        $policy
            ->add(Directive::DEFAULT, Keyword::SELF)
            ->add(Directive::BASE, Keyword::SELF)
            ->add(Directive::CONNECT, Keyword::SELF)
            ->add(Directive::FONT, [Keyword::SELF, 'data:'])
            ->add(Directive::FRAME_ANCESTORS, Keyword::SELF)
            // blob: for upload previews; ui-avatars.com is Filament's default avatar provider
            ->add(Directive::IMG, [Keyword::SELF, 'data:', 'blob:', 'https://ui-avatars.com'])
            ->add(Directive::OBJECT, Keyword::NONE)
            ->add(Directive::SCRIPT, [Keyword::SELF, Keyword::UNSAFE_INLINE, Keyword::UNSAFE_EVAL])
            ->add(Directive::STYLE, [Keyword::SELF, Keyword::UNSAFE_INLINE]);

        // The panel's Inter font
        (new BunnyFonts)->configure($policy);
    }
}
