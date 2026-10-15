# Authentication & Authorization — BROKI

**Política:** INVITE-ONLY.  
`auth.users` ≠ autorización. Sin fila activa en `broki_user_access` → **403**.

## Modelo

| Role | Permissions |
|------|-------------|
| viewer | `dashboard:read` |
| operator | `dashboard:read`, `dashboard:write` |
| admin | + `admin:read`, `admin:write` |

Tabla: `broki_user_access` (`user_id`, `personnel_id`, `role`, `is_active`).

## Ciclo de vida

1. Público: `personnel-register` → `review_status=pending` (**sin** access).  
2. Admin revisa personal.  
3. Invite Auth (signup deshabilitado en config local `enable_signup=false` email provider).  
4. Insert `broki_user_access` + link `personnel.auth_user_id`.  
5. Revoke: `is_active=false` y/o ban Auth.

## Edge

`authenticateBrokiUser`: getUser → ban/disabled → access lookup → role perms → pending personnel pierde write.

`roster-upload` POST: `assertUserCanWrite` obligatorio.

Matriz: `config/broki/function-permissions.json`.

## Remoto (checklist humano)

Dashboard Auth → Site URL, Redirect URLs, signup OFF, SMTP, recovery URL, session.  
Evidence: `BLOCKED_EXTERNAL` hasta captura firmada.
