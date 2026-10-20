// Reads rows from the legacy mysqldump files (.legacy-database), column names from the DDL.
// The dumps are reliable for sets and counts, not for an individual row's current text.
import { readFileSync } from 'node:fs';

import { LEGACY_DB } from './paths.mjs';

function columns(ddlFile, table) {
  const ddl = readFileSync(`${LEGACY_DB}/ddl/creation/${ddlFile}`, 'utf8');
  const start = ddl.indexOf('CREATE TABLE `' + table + '`');
  if (start < 0) throw new Error(`no table ${table} in ${ddlFile}`);
  const body = ddl.slice(start, ddl.indexOf('ENGINE=', start));
  return [...body.matchAll(/^\s+`([^`]+)`\s/gm)].map((m) => m[1]);
}

// Parses the VALUES (...),(...); part of INSERT statements. Some dumps name the columns
// (`INSERT INTO t (a, b) VALUES`): those rows come back as [columns, values].
function* tuples(sql, table) {
  const marker = 'INSERT INTO `' + table + '` ';
  let pos = 0;
  while ((pos = sql.indexOf(marker, pos)) >= 0) {
    let i = pos + marker.length;
    let named = null;
    if (sql[i] === '(') {
      const close = sql.indexOf(')', i);
      named = [...sql.slice(i, close).matchAll(/`([^`]+)`/g)].map((m) => m[1]);
      i = close + 1;
    }
    i = sql.indexOf('VALUES', i) + 'VALUES'.length;
    while (sql[i] === ' ' || sql[i] === '\n') i++;
    while (sql[i] === '(') {
      const row = [];
      i++;
      for (;;) {
        if (sql[i] === "'") {
          let s = '';
          i++;
          for (;;) {
            const c = sql[i];
            if (c === '\\') {
              const n = sql[i + 1];
              s += n === 'n' ? '\n' : n === 'r' ? '\r' : n === 't' ? '\t' : n === '0' ? '\0' : n;
              i += 2;
            } else if (c === "'" && sql[i + 1] === "'") {
              s += "'";
              i += 2;
            } else if (c === "'") {
              i++;
              break;
            } else {
              s += c;
              i++;
            }
          }
          row.push(s);
        } else {
          let j = i;
          while (sql[j] !== ',' && sql[j] !== ')') j++;
          const raw = sql.slice(i, j).trim();
          row.push(raw === 'NULL' ? null : raw.startsWith("_binary '") ? raw : Number.isNaN(Number(raw)) ? raw : Number(raw));
          i = j;
        }
        if (sql[i] === ',') { i++; continue; }
        if (sql[i] === ')') { i++; break; }
      }
      yield named ? [named, row] : row;
      if (sql[i] === ',') i++;
    }
    pos = i;
  }
}

export function readTable(db, table, { ddlFile = `${db}_${table}.sql`, dataFile = `${db}_${table}.sql` } = {}) {
  const cols = columns(ddlFile, table);
  const sql = readFileSync(`${LEGACY_DB}/data/${dataFile}`, 'utf8');
  const rows = [];
  for (const t of tuples(sql, table)) {
    const [names, values] = Array.isArray(t[0]) ? t : [cols, t];
    rows.push(Object.fromEntries(names.map((c, k) => [c, values[k]])));
  }
  return rows;
}
