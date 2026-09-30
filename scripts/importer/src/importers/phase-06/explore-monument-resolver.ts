import type { EntityType } from '../../core/types.js';
import type { ILegacyDatabase } from '../../core/base-importer.js';
import type { ITracker } from '../../core/tracker.js';

type ReferenceSource = 'vm' | 'travels' | 'sharing-history';
type ResolutionMode = 'native' | 'referenced' | 'missing-target' | 'resolvedCandidates';

interface ExploreMonumentRow {
  monumentId: number;
  REF_tr_monuments_project_id: string | null;
  REF_tr_monuments_country: string | null;
  REF_tr_monuments_itinerary_id: string | null;
  REF_tr_monuments_location_id: string | null;
  REF_tr_monuments_number: string | null;
  REF_tr_monuments_lang: string | null;
  REF_tr_monuments_trail_id: number | null;
  REF_monuments_project_id: string | null;
  REF_monuments_country: string | null;
  REF_monuments_institution_id: string | null;
  REF_monuments_number: number | null;
  REF_monuments_lang: string | null;
  /** Whether legacy has the record each direct reference names (MySQL: 1 or 0). */
  REF_tr_monuments_exists: number;
  REF_monuments_exists: number;
}

interface ExploreVmReferenceRow {
  monumentId: number;
  REF_monuments_project_id: string;
  REF_monuments_country: string;
  REF_monuments_institution_id: string;
  REF_monuments_number: number;
}

interface ExploreTravelsReferenceRow {
  monumentId: number;
  REF_tr_monuments_project_id: string;
  REF_tr_monuments_country: string;
  REF_tr_monuments_itinerary_id: string;
  REF_tr_monuments_location_id: string;
  REF_tr_monuments_number: string;
  REF_tr_monuments_trail_id: number;
}

interface ExploreSharingHistoryReferenceRow {
  monumentId: number;
  project_id: string;
  country: string;
  number: number;
}

interface StoredResolutionCandidate {
  source: ReferenceSource;
  itemBackwardCompatibility: string;
}

interface StoredResolutionEntry {
  monumentId: number;
  nativeBackwardCompatibility: string;
  candidates: StoredResolutionCandidate[];
}

export interface ExploreMonumentResolution {
  monumentId: number;
  mode: ResolutionMode;
  nativeBackwardCompatibility: string;
  itemBackwardCompatibility: string | null;
  itemId: string | null;
  source: ReferenceSource | 'native' | 'mixed';
  message: string | null;
  resolvedCandidates?: Array<{
    source: ReferenceSource;
    itemBackwardCompatibility: string;
    itemId: string;
  }>;
}

interface ExploreMonumentResolverOptions {
  legacyDb: ILegacyDatabase;
  tracker: ITracker;
  getEntityUuid: (backwardCompatibility: string, entityType: EntityType) => Promise<string | null>;
}

const TRACKER_METADATA_KEY = 'explore_monument_resolution_map:v1';

function hasText(value: string | null | undefined): value is string {
  return value !== null && value !== undefined && value.trim() !== '';
}

function buildVmBackwardCompatibility(
  projectId: string,
  country: string,
  institutionId: string,
  number: number
): string {
  return `mwnf3:monuments:${projectId}:${country}:${institutionId}:${number}`;
}

function buildTravelsBackwardCompatibility(
  projectId: string,
  country: string,
  trailId: number,
  itineraryId: string,
  locationId: string,
  number: string
): string {
  return `mwnf3_travels:monument:${projectId}:${country}:${trailId}:${itineraryId}:${locationId}:${number}`;
}

function buildSharingHistoryBackwardCompatibility(
  projectId: string,
  country: string,
  number: number
): string {
  return `mwnf3_sharing_history:sh_monuments:${projectId.toLowerCase()}:${country.toLowerCase()}:${number}`;
}

export class ExploreMonumentResolver {
  private readonly legacyDb: ILegacyDatabase;
  private readonly tracker: ITracker;
  private readonly getEntityUuid: ExploreMonumentResolverOptions['getEntityUuid'];
  private resolutionMapPromise: Promise<Map<number, StoredResolutionEntry>> | null = null;

  constructor(options: ExploreMonumentResolverOptions) {
    this.legacyDb = options.legacyDb;
    this.tracker = options.tracker;
    this.getEntityUuid = options.getEntityUuid;
  }

  async resolve(monumentId: number): Promise<ExploreMonumentResolution> {
    const resolutionMap = await this.getResolutionMap();
    const entry = resolutionMap.get(monumentId);
    const nativeBackwardCompatibility = `mwnf3_explore:monument:${monumentId}`;

    if (!entry || entry.candidates.length === 0) {
      const itemId = await this.getEntityUuid(nativeBackwardCompatibility, 'item');

      if (itemId) {
        this.tracker.set(nativeBackwardCompatibility, itemId, 'item');
      }

      return {
        monumentId,
        mode: 'native',
        nativeBackwardCompatibility,
        itemBackwardCompatibility: nativeBackwardCompatibility,
        itemId,
        source: 'native',
        message: null,
      };
    }

    const resolvedWithIds: Array<StoredResolutionCandidate & { itemId: string | null }> = [];
    for (const candidate of entry.candidates) {
      const itemId = await this.getEntityUuid(candidate.itemBackwardCompatibility, 'item');
      resolvedWithIds.push({
        ...candidate,
        itemId,
      });
    }

    const successfulCandidates = resolvedWithIds.filter((candidate) => candidate.itemId !== null);
    if (successfulCandidates.length === 1 && resolvedWithIds.length === 1) {
      const resolvedCandidate = successfulCandidates[0]!;
      this.tracker.set(nativeBackwardCompatibility, resolvedCandidate.itemId!, 'item');

      return {
        monumentId,
        mode: 'referenced',
        nativeBackwardCompatibility,
        itemBackwardCompatibility: resolvedCandidate.itemBackwardCompatibility,
        itemId: resolvedCandidate.itemId,
        source: resolvedCandidate.source,
        message: null,
      };
    }

    if (successfulCandidates.length === 0) {
      const missingTargets = resolvedWithIds.map((candidate) => candidate.itemBackwardCompatibility);
      return {
        monumentId,
        mode: 'missing-target',
        nativeBackwardCompatibility,
        itemBackwardCompatibility: null,
        itemId: null,
        source: resolvedWithIds.length === 1 ? resolvedWithIds[0]!.source : 'mixed',
        message: `Explore monument ${nativeBackwardCompatibility} references missing target item(s): ${missingTargets.join(', ')}`,
      };
    }

    const resolvedCandidatesList = successfulCandidates.map((c) => ({
      source: c.source,
      itemBackwardCompatibility: c.itemBackwardCompatibility,
      itemId: c.itemId!,
    }));
    const ambiguousTargets = resolvedCandidatesList.map((c) => c.itemBackwardCompatibility);
    return {
      monumentId,
      mode: 'resolvedCandidates',
      nativeBackwardCompatibility,
      itemBackwardCompatibility: null,
      itemId: null,
      source: 'mixed',
      message: `Explore monument ${nativeBackwardCompatibility} resolves to multiple source items: ${ambiguousTargets.join(', ')}`,
      resolvedCandidates: resolvedCandidatesList,
    };
  }

  async resolveForSource(
    monumentId: number,
    source: ReferenceSource
  ): Promise<ExploreMonumentResolution> {
    const resolutionMap = await this.getResolutionMap();
    const entry = resolutionMap.get(monumentId);
    const nativeBackwardCompatibility = `mwnf3_explore:monument:${monumentId}`;

    if (!entry || entry.candidates.length === 0) {
      const itemId = await this.getEntityUuid(nativeBackwardCompatibility, 'item');
      if (itemId) {
        this.tracker.set(nativeBackwardCompatibility, itemId, 'item');
      }
      return {
        monumentId,
        mode: 'native',
        nativeBackwardCompatibility,
        itemBackwardCompatibility: nativeBackwardCompatibility,
        itemId,
        source: 'native',
        message: null,
      };
    }

    const candidate = entry.candidates.find((c) => c.source === source);
    if (!candidate) {
      return {
        monumentId,
        mode: 'missing-target',
        nativeBackwardCompatibility,
        itemBackwardCompatibility: null,
        itemId: null,
        source,
        message: `Explore monument ${nativeBackwardCompatibility} has no ${source} candidate`,
      };
    }

    const itemId = await this.getEntityUuid(candidate.itemBackwardCompatibility, 'item');
    if (!itemId) {
      return {
        monumentId,
        mode: 'missing-target',
        nativeBackwardCompatibility,
        itemBackwardCompatibility: candidate.itemBackwardCompatibility,
        itemId: null,
        source,
        message: `Explore monument ${nativeBackwardCompatibility} ${source} candidate not found: ${candidate.itemBackwardCompatibility}`,
      };
    }

    this.tracker.set(nativeBackwardCompatibility, itemId, 'item');
    return {
      monumentId,
      mode: 'referenced',
      nativeBackwardCompatibility,
      itemBackwardCompatibility: candidate.itemBackwardCompatibility,
      itemId,
      source,
      message: null,
    };
  }

  private async getResolutionMap(): Promise<Map<number, StoredResolutionEntry>> {
    if (this.resolutionMapPromise) {
      return this.resolutionMapPromise;
    }

    this.resolutionMapPromise = (async () => {
      const existing = this.tracker.getMetadata(TRACKER_METADATA_KEY);
      if (existing) {
        return this.deserializeResolutionMap(existing);
      }

      const resolutionMap = await this.buildResolutionMap();
      this.tracker.setMetadata(
        TRACKER_METADATA_KEY,
        JSON.stringify(Array.from(resolutionMap.entries()))
      );

      return resolutionMap;
    })();

    return this.resolutionMapPromise;
  }

  private deserializeResolutionMap(serialized: string): Map<number, StoredResolutionEntry> {
    const entries = JSON.parse(serialized) as Array<[number, StoredResolutionEntry]>;
    return new Map(entries);
  }

  /**
   * A reference counts only when legacy has the record it names. Legacy's API
   * reads a referenced record's content through an inner join and the
   * monument's name from its own rows, so a reference to a record legacy
   * doesn't have simply drops out, and the monument is served as Explore's
   * own. A reference to a record legacy has but the import lacks stays a
   * candidate, and is reported as a missing target.
   */
  private async buildResolutionMap(): Promise<Map<number, StoredResolutionEntry>> {
    const monuments = await this.legacyDb.query<ExploreMonumentRow>(
      `SELECT m.monumentId,
              m.REF_tr_monuments_project_id,
              m.REF_tr_monuments_country,
              m.REF_tr_monuments_itinerary_id,
              m.REF_tr_monuments_location_id,
              m.REF_tr_monuments_number,
              m.REF_tr_monuments_lang,
              m.REF_tr_monuments_trail_id,
              m.REF_monuments_project_id,
              m.REF_monuments_country,
              m.REF_monuments_institution_id,
              m.REF_monuments_number,
              m.REF_monuments_lang,
              EXISTS (SELECT 1 FROM mwnf3_travels.tr_monuments t
                      WHERE t.project_id = m.REF_tr_monuments_project_id
                        AND t.country = m.REF_tr_monuments_country
                        AND t.trail_id = m.REF_tr_monuments_trail_id
                        AND t.itinerary_id = m.REF_tr_monuments_itinerary_id
                        AND t.location_id = m.REF_tr_monuments_location_id
                        AND t.number = m.REF_tr_monuments_number) AS REF_tr_monuments_exists,
              EXISTS (SELECT 1 FROM mwnf3.monuments v
                      WHERE v.project_id = m.REF_monuments_project_id
                        AND v.country = m.REF_monuments_country
                        AND v.institution_id = m.REF_monuments_institution_id
                        AND v.number = m.REF_monuments_number) AS REF_monuments_exists
       FROM mwnf3_explore.exploremonument m`
    );

    const vmReferences = await this.legacyDb.query<ExploreVmReferenceRow>(
      `SELECT r.monumentId,
              r.REF_monuments_project_id,
              r.REF_monuments_country,
              r.REF_monuments_institution_id,
              r.REF_monuments_number
       FROM mwnf3_explore.exploremonument_vm r
       WHERE EXISTS (SELECT 1 FROM mwnf3.monuments v
                     WHERE v.project_id = r.REF_monuments_project_id
                       AND v.country = r.REF_monuments_country
                       AND v.institution_id = r.REF_monuments_institution_id
                       AND v.number = r.REF_monuments_number)`
    );

    const travelsReferences = await this.legacyDb.query<ExploreTravelsReferenceRow>(
      `SELECT r.monumentId,
              r.REF_tr_monuments_project_id,
              r.REF_tr_monuments_country,
              r.REF_tr_monuments_itinerary_id,
              r.REF_tr_monuments_location_id,
              r.REF_tr_monuments_number,
              r.REF_tr_monuments_trail_id
       FROM mwnf3_explore.exploremonument_tr r
       WHERE EXISTS (SELECT 1 FROM mwnf3_travels.tr_monuments t
                     WHERE t.project_id = r.REF_tr_monuments_project_id
                       AND t.country = r.REF_tr_monuments_country
                       AND t.trail_id = r.REF_tr_monuments_trail_id
                       AND t.itinerary_id = r.REF_tr_monuments_itinerary_id
                       AND t.location_id = r.REF_tr_monuments_location_id
                       AND t.number = r.REF_tr_monuments_number)`
    );

    const sharingHistoryReferences = await this.legacyDb.query<ExploreSharingHistoryReferenceRow>(
      `SELECT r.monumentId, r.project_id, r.country, r.number
       FROM mwnf3_explore.exploremonument_sh r
       WHERE EXISTS (SELECT 1 FROM mwnf3_sharing_history.sh_monuments s
                     WHERE s.project_id = r.project_id
                       AND s.country = r.country
                       AND s.number = r.number)`
    );

    const resolutionMap = new Map<number, StoredResolutionEntry>();
    for (const monument of monuments) {
      resolutionMap.set(monument.monumentId, {
        monumentId: monument.monumentId,
        nativeBackwardCompatibility: `mwnf3_explore:monument:${monument.monumentId}`,
        candidates: [],
      });

      this.pushDirectReferences(monument, resolutionMap.get(monument.monumentId)!);
    }

    for (const reference of vmReferences) {
      this.pushCandidate(resolutionMap, reference.monumentId, {
        source: 'vm',
        itemBackwardCompatibility: buildVmBackwardCompatibility(
          reference.REF_monuments_project_id,
          reference.REF_monuments_country,
          reference.REF_monuments_institution_id,
          reference.REF_monuments_number
        ),
      });
    }

    for (const reference of travelsReferences) {
      this.pushCandidate(resolutionMap, reference.monumentId, {
        source: 'travels',
        itemBackwardCompatibility: buildTravelsBackwardCompatibility(
          reference.REF_tr_monuments_project_id,
          reference.REF_tr_monuments_country,
          reference.REF_tr_monuments_trail_id,
          reference.REF_tr_monuments_itinerary_id,
          reference.REF_tr_monuments_location_id,
          reference.REF_tr_monuments_number
        ),
      });
    }

    for (const reference of sharingHistoryReferences) {
      this.pushCandidate(resolutionMap, reference.monumentId, {
        source: 'sharing-history',
        itemBackwardCompatibility: buildSharingHistoryBackwardCompatibility(
          reference.project_id,
          reference.country,
          reference.number
        ),
      });
    }

    return resolutionMap;
  }

  private pushDirectReferences(
    monument: ExploreMonumentRow,
    entry: StoredResolutionEntry
  ): void {
    if (
      hasText(monument.REF_monuments_project_id) &&
      hasText(monument.REF_monuments_country) &&
      hasText(monument.REF_monuments_institution_id) &&
      monument.REF_monuments_number !== null &&
      Number(monument.REF_monuments_exists) === 1
    ) {
      entry.candidates.push({
        source: 'vm',
        itemBackwardCompatibility: buildVmBackwardCompatibility(
          monument.REF_monuments_project_id,
          monument.REF_monuments_country,
          monument.REF_monuments_institution_id,
          monument.REF_monuments_number
        ),
      });
    }

    if (
      hasText(monument.REF_tr_monuments_project_id) &&
      hasText(monument.REF_tr_monuments_country) &&
      hasText(monument.REF_tr_monuments_itinerary_id) &&
      hasText(monument.REF_tr_monuments_location_id) &&
      hasText(monument.REF_tr_monuments_number) &&
      monument.REF_tr_monuments_trail_id !== null &&
      Number(monument.REF_tr_monuments_exists) === 1
    ) {
      entry.candidates.push({
        source: 'travels',
        itemBackwardCompatibility: buildTravelsBackwardCompatibility(
          monument.REF_tr_monuments_project_id,
          monument.REF_tr_monuments_country,
          monument.REF_tr_monuments_trail_id,
          monument.REF_tr_monuments_itinerary_id,
          monument.REF_tr_monuments_location_id,
          monument.REF_tr_monuments_number
        ),
      });
    }
  }

  private pushCandidate(
    resolutionMap: Map<number, StoredResolutionEntry>,
    monumentId: number,
    candidate: StoredResolutionCandidate
  ): void {
    const entry = resolutionMap.get(monumentId) ?? {
      monumentId,
      nativeBackwardCompatibility: `mwnf3_explore:monument:${monumentId}`,
      candidates: [],
    };

    if (
      !entry.candidates.some(
        (existingCandidate) => existingCandidate.itemBackwardCompatibility === candidate.itemBackwardCompatibility
      )
    ) {
      entry.candidates.push(candidate);
    }

    resolutionMap.set(monumentId, entry);
  }
}