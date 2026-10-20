// The browser passes keep one capture per job, by job id. A capture is reused only for the address
// it was taken from: a run with --new-url captures a local preview under the same job id as the
// published site, and neither may stand in for the other.
import { existsSync, readFileSync } from 'node:fs';

export function reusable(file, job) {
  if (!existsSync(file)) return false;
  try {
    return JSON.parse(readFileSync(file, 'utf8')).url === job.url;
  } catch {
    return false;
  }
}
