# 9.4 — Planner link root cause

- groups canonical: 46 (V7 raw 30; orphan 16)
- tasks without group_id: 20
- classification: {"SOURCE_GROUP_NULL":20}
- V7 task→group link_ok: 9 / fail: 48

## Tasks sin group_id

| task_ext | id_grupo_trabajo | class |
|---|---|---|
| 37 | ∅ | SOURCE_GROUP_NULL |
| 51 | ∅ | SOURCE_GROUP_NULL |
| 43 | ∅ | SOURCE_GROUP_NULL |
| 53 | ∅ | SOURCE_GROUP_NULL |
| 54 | ∅ | SOURCE_GROUP_NULL |
| 49 | ∅ | SOURCE_GROUP_NULL |
| 46 | ∅ | SOURCE_GROUP_NULL |
| 47 | ∅ | SOURCE_GROUP_NULL |
| 48 | ∅ | SOURCE_GROUP_NULL |
| 50 | ∅ | SOURCE_GROUP_NULL |
| 44 | ∅ | SOURCE_GROUP_NULL |
| 31 | ∅ | SOURCE_GROUP_NULL |
| 35 | ∅ | SOURCE_GROUP_NULL |
| 32 | ∅ | SOURCE_GROUP_NULL |
| 36 | ∅ | SOURCE_GROUP_NULL |
| 38 | ∅ | SOURCE_GROUP_NULL |
| 45 | ∅ | SOURCE_GROUP_NULL |
| 55 | ∅ | SOURCE_GROUP_NULL |
| 52 | ∅ | SOURCE_GROUP_NULL |
| 56 | ∅ | SOURCE_GROUP_NULL |

## Root cause

1. Extra canonical groups/tasks from prior normalize runs (not deleted).
2. Tasks whose legacy id_grupo_trabajo is null → SOURCE_GROUP_NULL.
3. Tasks whose group exists but group_id not set → NORMALIZER_LINK_FAILURE (dedup path / normalize order).
4. Dedup collisions (14) collapse multiple legacy tasks into fewer canonical; some links lost.
