// Carga ./.env (CLAVE=valor por línea, # comentarios) sin pisar variables ya definidas. El archivo está en .gitignore.
import {existsSync, readFileSync} from 'node:fs';
if (existsSync('.env')) {
  for (const l of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(l);
    if (m && !l.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}
