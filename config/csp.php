<?php

use App\Support\Csp\InventoryPreset;
use Spatie\Csp\Nonce\RandomString;

// CSP_REPORT_ONLY=true sends the same policy as Content-Security-Policy-Report-Only:
// browsers then report violations in the console instead of blocking.
$reportOnly = (bool) env('CSP_REPORT_ONLY', false);

return [

    /*
     * Presets will determine which CSP headers will be set. A valid CSP preset is
     * any class that implements `Spatie\Csp\Preset`
     */
    'presets' => $reportOnly ? [] : [InventoryPreset::class],

    /**
     * Register additional global CSP directives here.
     */
    'directives' => [],

    /*
     * These presets which will be put in a report-only policy. This is great for testing out
     * a new policy or changes to existing CSP policy without breaking anything.
     */
    'report_only_presets' => $reportOnly ? [InventoryPreset::class] : [],

    /**
     * Register additional global report-only CSP directives here.
     */
    'report_only_directives' => [],

    /*
     * All violations against a policy will be reported to this url.
     */
    'report_uri' => env('CSP_REPORT_URI', ''),

    /*
     * Optional separate report url for the report-only policy. When empty,
     * the report-only policy falls back to `report_uri` above.
     */
    'report_only_uri' => env('CSP_REPORT_ONLY_URI', ''),

    /*
     * The name of the reporting endpoint that violations should be sent to.
     * The endpoint itself must be defined in `reporting_endpoints` below.
     */
    'report_to' => env('CSP_REPORT_TO', ''),

    /*
     * Optional separate reporting endpoint name for the report-only policy.
     * When empty, the report-only policy falls back to `report_to` above.
     */
    'report_only_to' => env('CSP_REPORT_ONLY_TO', ''),

    /*
     * Reporting endpoints that will be sent in the `Reporting-Endpoints` HTTP
     * header. The keys are the endpoint names that can be referenced from
     * `report_to` above.
     */
    'reporting_endpoints' => [],

    /*
     * Headers will only be added if this setting is set to true.
     */
    'enabled' => (bool) env('CSP_ENABLED', true),

    /**
     * Headers will be added when Vite is hot reloading.
     */
    'enabled_while_hot_reloading' => (bool) env('CSP_ENABLED_WHILE_HOT_RELOADING', false),

    /*
     * The class responsible for generating the nonces used in inline tags and headers.
     */
    'nonce_generator' => RandomString::class,

    /*
     * Off: a nonce in script-src or style-src makes browsers ignore
     * 'unsafe-inline', which Filament's inline scripts and styles need.
     */
    'nonce_enabled' => false,
];
