#!/usr/bin/env node
// Static guard for this repository's unquoted, explicit public-table SQL style.
// Does not replace execution against Postgres or verification of RLS semantics.
const fs = require('node:fs');
const path = require('node:path');
const crud = ['select', 'insert', 'update', 'delete'];
function auditMigration(source) {
  const sql = source.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').toLowerCase();
  const tables = [...sql.matchAll(/\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_][a-z0-9_]*)\s*\(/g)].map(m => m[1]);
  const errors = [];
  for (const table of tables) {
    const grants = { authenticated: new Set(), service_role: new Set() };
    for (const m of sql.matchAll(/\bgrant\s+([a-z,\s]+?)\s+on\s+(?:table\s+)?public\.([a-z_][a-z0-9_]*)\s+to\s+([a-z_,\s]+);/g)) {
      if (m[2] !== table) continue;
      for (const role of m[3].split(',').map(x => x.trim())) {
        for (const op of m[1].split(',').map(x => x.trim())) grants[role]?.add(op);
      }
    }
    for (const op of crud) if (!grants.service_role.has(op)) errors.push(`${table}: missing explicit ${op} grant to service_role in CREATE TABLE migration`);
    const enabled = new RegExp(`alter\\s+table\\s+(?:public\\.)?${table}\\s+enable\\s+row\\s+level\\s+security`).test(sql);
    if (!enabled) errors.push(`${table}: RLS must be enabled in CREATE TABLE migration`);
    for (const m of sql.matchAll(/\bcreate\s+policy\s+"[^"]+"\s+on\s+(?:public\.)?([a-z_][a-z0-9_]*)\s+for\s+(select|insert|update|delete|all)\b([^;]*);/g)) {
      if (m[1] !== table || m[3].includes("auth.role() = 'service_role'")) continue;
      const ops = m[2] === 'all' ? crud : [m[2]];
      for (const op of ops) if (!grants.authenticated.has(op)) errors.push(`${table}: ${op} policy has no authenticated grant in CREATE TABLE migration`);
    }
  }
  return { tables, errors };
}
if (require.main === module) {
  const directory = path.resolve(__dirname, '../../docs/operations/migrations');
  let count = 0, failed = false;
  for (const file of fs.readdirSync(directory).filter(f => f.endsWith('.sql')).sort()) {
    const result = auditMigration(fs.readFileSync(path.join(directory, file), 'utf8'));
    count += result.tables.length;
    for (const error of result.errors) { console.error(`${file}: ${error}`); failed = true; }
  }
  if (failed) process.exitCode = 1;
  else console.log(`PASS: ${count} CREATE TABLE definitions have explicit Data API grants and RLS. This is a static check, not a full schema replay.`);
}
module.exports = { auditMigration };
