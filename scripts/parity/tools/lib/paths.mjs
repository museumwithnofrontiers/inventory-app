// Every directory the tools read or write. Each one is an environment variable, so the same code
// runs in the compose service (which mounts them under /parity and /legacy) and anywhere else.
//
//   PARITY_WORK   the git-ignored working area; everything below defaults inside it
//   PARITY_CACHE  every legacy and registry HTTP answer, keyed by the URL's sha1
//   PARITY_OUT    the reports of the current run
//   PARITY_PKG    data packages unpacked from npm (<name>@<version>/package)
//   LEGACY_DB     the legacy mysqldump files (.legacy-database: ddl/ and data/)
//   LEGACY_CODE   the legacy source checkouts (.legacy-code: dxa-client's per-site .env files)
//   PARITY_REPO   this repository (scripts/exporters: instances and local exports)
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const env = process.env;
export const TOOLS = dirname(dirname(fileURLToPath(import.meta.url)));
export const REPO = resolve(env.PARITY_REPO ?? resolve(TOOLS, '../../..'));
export const WORK = resolve(env.PARITY_WORK ?? `${REPO}/tmp/parity`);
export const CACHE = resolve(env.PARITY_CACHE ?? `${WORK}/cache`);
export const OUT = resolve(env.PARITY_OUT ?? `${WORK}/out`);
export const PKG = resolve(env.PARITY_PKG ?? `${WORK}/pkg`);
export const SHOTS = `${WORK}/shots`;
export const ASSETS = `${WORK}/assets`;
export const STATIC = `${WORK}/static`;
export const SITE = `${WORK}/site`;
export const LEGACY_DB = resolve(env.LEGACY_DB ?? `${REPO}/.legacy-database`);
export const LEGACY_CODE = resolve(env.LEGACY_CODE ?? `${REPO}/.legacy-code`);
// Hand-written review notes the style, assets and static pages show next to the numbers.
export const NOTES = `${TOOLS}/../notes`;
