// The data package a site installs. PARITY_PACKAGES picks where it comes from:
//   latest (default)  the published version the sitemap resolved on npm (npm pack, unpacked once)
//   local             the exporters' own output, scripts/exporters/<exporter>/output/<slug>
//   local:<dir>       the same layout under another directory, or <dir>/<slug>
// Local mode is the pre-publish gate: it compares what an export would publish.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { PKG, REPO } from './paths.mjs';

export const SOURCE = process.env.PARITY_PACKAGES ?? 'latest';
export const isLocal = SOURCE === 'local' || SOURCE.startsWith('local:');
if (!isLocal && SOURCE !== 'latest') throw new Error(`PARITY_PACKAGES must be latest, local or local:<dir>, not "${SOURCE}"`);

let instanceList;
export function instances() {
  const dir = `${REPO}/scripts/exporters/instances`;
  instanceList ??= readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')));
  return instanceList;
}

const exporterOf = (inst) => (inst.kind === 'gallery' ? 'dxa-gallery' : inst.kind === 'exhibition' ? 'dxa-exhibition' : inst.exporter);

// The directory holding manifest.json for one package, or null when there is none.
export function localRoot(name) {
  const base = SOURCE === 'local' ? `${REPO}/scripts/exporters` : resolve(SOURCE.slice('local:'.length));
  const inst = instances().find((i) => i.package_name === name);
  const candidates = [
    inst && `${base}/${exporterOf(inst)}/output/${inst.slug}`,
    inst && `${base}/${inst.slug}`,
    `${base}/${name.replace('@museumwnf/', '')}`,
  ].filter(Boolean);
  return candidates.find((d) => existsSync(`${d}/manifest.json`)) ?? null;
}

function npmRoot(name, version) {
  const dir = `${PKG}/${name.replace('@museumwnf/', '')}@${version}`;
  if (!existsSync(`${dir}/package/manifest.json`)) {
    mkdirSync(dir, { recursive: true });
    // Reuse a tarball an earlier run already downloaded.
    const tgz = readdirSync(dir).find((f) => f.endsWith('.tgz')) ?? execFileSync('npm', ['pack', `${name}@${version}`, '--silent'], { cwd: dir, encoding: 'utf8' }).trim().split('\n').pop();
    execFileSync('tar', ['xzf', tgz], { cwd: dir });
  }
  return `${dir}/package`;
}

export function packageRoot(name, version) {
  if (!isLocal) return npmRoot(name, version);
  const root = localRoot(name);
  if (!root) throw new Error(`no local export of ${name} under ${SOURCE === 'local' ? 'scripts/exporters' : SOURCE.slice('local:'.length)}`);
  return root;
}

export function loadPackage(name, version) {
  const root = packageRoot(name, version);
  const read = (f) => (existsSync(`${root}/${f}`) ? JSON.parse(readFileSync(`${root}/${f}`, 'utf8')) : null);
  const translations = {};
  for (const f of readdirSync(`${root}/translations`).filter((f) => f.endsWith('.json'))) {
    const [entity, lang] = f.replace(/\.json$/, '').split('.');
    (translations[entity] ??= {})[lang] = read(`translations/${f}`);
  }
  return { root, read, translations, tr: (entity, lang, id) => translations[entity]?.[lang]?.[id] ?? null };
}
