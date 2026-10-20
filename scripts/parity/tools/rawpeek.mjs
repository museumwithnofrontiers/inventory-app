// node tools/rawpeek.mjs <url> <needle> [before] [after] — a slice of a cached page around a needle
import { get } from './lib/http.mjs';
const [url, needle, before = 80, after = 600] = process.argv.slice(2);
const b = (await get(url)).body;
let i = b.indexOf(needle);
if (i < 0) console.log('needle not found');
else console.log(JSON.stringify(b.slice(Math.max(0, i - Number(before)), i + Number(after)).replace(/<span class="su_tooltip_1-content">[\s\S]*?<\/span><\/span><\/span><\/span>/g, '[bio]')));
