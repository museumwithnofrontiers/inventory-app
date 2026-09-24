<?php

namespace App\Contracts;

/**
 * An attached image whose public rendition - at /pub and through the API -
 * carries its resolved copyright burned in.
 *
 * Every *Image registry model implements it. PartnerLogo doesn't (decision
 * of 2026-09-24): a logo is served as the original bytes.
 */
interface BurnsCopyright extends HasCopyright {}
