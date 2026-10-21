const { test } = require('node:test');
const assert = require('node:assert/strict');
const { auditMigration } = require('./check-db-grants.cjs');
const base = `create table public.items (id uuid primary key); alter table public.items enable row level security;
create policy "Own items" on public.items for select using (true);`;
const server = 'grant select, insert, update, delete on table public.items to service_role;';
test('default grants and RLS policies alone do not satisfy explicit access', () => {
  const result = auditMigration(base);
  assert.equal(result.errors.length, 5);
});
test('missing authenticated grant is detected despite server access', () => {
  assert.match(auditMigration(base + server).errors.join(), /select policy/);
});
test('explicit access passes without anonymous grants', () => {
  assert.deepEqual(auditMigration(base + server + 'grant select on public.items to authenticated;').errors, []);
});
test('commented grants and grants on another table cannot hide missing access', () => {
  assert.equal(auditMigration(base + '\n-- ' + server + '\ngrant select on public.other to authenticated;').errors.length, 5);
});
test('server-only table does not require user access', () => {
  assert.deepEqual(auditMigration(base.replace('for select using (true)', "for all using (auth.role() = 'service_role')") + server).errors, []);
});
test('grants without RLS fail', () => {
  assert.match(auditMigration(base.replace('alter table public.items enable row level security;', '') + server + 'grant select on public.items to authenticated;').errors.join(), /RLS/);
});
