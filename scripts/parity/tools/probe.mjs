// node tools/probe.mjs <url>... — shape and a sample of each (cached) JSON answer
import { getJson } from './lib/http.mjs';
const shape = (v, d = 0) => {
  if (Array.isArray(v)) return `Array(${v.length})` + (v.length && d < 3 ? ` of ${shape(v[0], d + 1)}` : '');
  if (v && typeof v === 'object') {
    const k = Object.keys(v);
    if (d >= 3) return `{${k.length} keys}`;
    return '{' + k.slice(0, 30).map((x) => `${x}: ${shape(v[x], d + 1)}`).join(', ') + (k.length > 30 ? ', …' : '') + '}';
  }
  return typeof v === 'string' ? `"${v.slice(0, 40)}"` : String(v);
};
for (const u of process.argv.slice(2)) {
  const r = await getJson(u);
  console.log(`--- ${u} [${r.status}]\n${shape(r.json)}`);
}
