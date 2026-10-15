# Auth operations runbook

## Invite user

1. Crear user en Supabase Auth (invite email).  
2. `insert into broki_user_access (user_id, personnel_id, role, is_active) values (...)`.  
3. Opcional: `update broki_personnel set auth_user_id=..., review_status='approved'`.

## Revoke

```sql
update broki_user_access set is_active=false, updated_at=now() where user_id='…';
```

## Password recovery

Usar flujo Auth recovery URL (Site URL + redirect allowlist). No reset manual por chat.

## QA E2E user

1. Auth user + `broki_user_access.role='operator'`.  
2. Export `E2E_EMAIL` / `E2E_PASSWORD` en CI/local (nunca en repo).  
3. `npm run test:e2e:release`.
