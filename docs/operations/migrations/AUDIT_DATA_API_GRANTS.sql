-- Read-only: run in the linked project's SQL Editor to inspect current exposure.
-- No rows or customer data are returned. Missing authenticated privileges may
-- be intentional: compare each operation with callers AND pg_policies.
select c.relname as relation_name,
       c.relkind as relation_kind,
       c.relrowsecurity as rls_enabled,
       r.role_name,
       has_table_privilege(r.role_name, c.oid, 'SELECT') as can_select,
       has_table_privilege(r.role_name, c.oid, 'INSERT') as can_insert,
       has_table_privilege(r.role_name, c.oid, 'UPDATE') as can_update,
       has_table_privilege(r.role_name, c.oid, 'DELETE') as can_delete
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
cross join (values ('anon'), ('authenticated'), ('service_role')) r(role_name)
where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
order by c.relname, r.role_name;

select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
