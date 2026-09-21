<?php

namespace Tests\Unit\Support\Importer;

use App\Support\Importer\DeterministicUuid;
use Tests\TestCase;

/**
 * Pins the PHP DeterministicUuid helper against known-good output from the
 * Node importer's own deterministicUuid() (scripts/importer/src/utils/deterministic-uuid.ts),
 * computed by running that exact function, with its real namespace, inside
 * the importer's own node_modules (uuid@14, dist-node/index.js) via the
 * `tools` Docker service:
 *
 *   const { v5: uuidv5 } = require('.../scripts/importer/node_modules/uuid/dist-node/index.js');
 *   uuidv5('collection:' + backwardCompatibility.toLowerCase(), IMPORTER_UUID_NAMESPACE)
 *
 * If this test ever fails, the two implementations have drifted — fix
 * DeterministicUuid, never these expected values (see the CRITICAL warning
 * in scripts/importer/src/utils/deterministic-uuid.ts).
 */
class DeterministicUuidTest extends TestCase
{
    public function test_reproduces_the_importers_uuid_for_a_thg_gallery(): void
    {
        // carpets, legacy gallery_id 9 — scripts/exporters/instances/carpets.json
        $this->assertSame(
            '743fd119-f663-54ae-b92a-933fc1fdbfd8',
            DeterministicUuid::forCollection('mwnf3_thematic_gallery:thg_gallery:9')
        );
    }

    public function test_reproduces_the_importers_uuid_for_an_mwnf3_project_root(): void
    {
        $this->assertSame(
            '0227731c-df1e-5f3e-8a97-45ca3e10bf2a',
            DeterministicUuid::forCollection('mwnf3:projects:ISL')
        );
    }

    public function test_reproduces_the_importers_uuid_for_a_sharing_history_exhibition(): void
    {
        $this->assertSame(
            '17d4d9ff-a2aa-56ff-af1c-4f5dc3ea3176',
            DeterministicUuid::forCollection('mwnf3_sharing_history:sh_exhibitions:1')
        );
    }

    public function test_namespace_matches_the_importers_frozen_constant(): void
    {
        $this->assertSame('bc112041-0784-4475-80b2-0c96425ac5ea', DeterministicUuid::NAMESPACE);
    }
}
