# 9.2 — Asset duplicate root cause (×2)

## Root cause

Canonical assets ≈ 2× V7 raw due to EXTERNAL_ID SCHEME CHANGE + normalize without migration filter. Pre-V3 imports used text external_id (identificador/BRK, e.g. G4-6, BRK-005) with last_migration_id NULL. V7 uses numeric legacy id (e.g. 7). Same logical asset → two broki_assets rows (same identifier, different external_id). broki_normalize_assets() upserts ALL rows for source_table in (inventario,furgonetas,gse) without filtering last_migration_id, so both survive and both get updated_at on each normalize. public__* mirrors are RAW_ONLY and are NOT the ×2 driver.

### Conteos

| Tabla | Raw V7 | Raw other mig | Canonical | Ratio |
|---|---:|---:|---:|---:|
| furgonetas | 17 | 17 | 34 | 2.00 |
| gse | 77 | 77 | 154 | 2.00 |
| inventario | 94 | 94 | 188 | 2.00 |

### public__ raw (not normalized into pro.* assets)

{"public__furgonetas":16,"public__gse":53}

### Duplicate logical groups: 188

Classification counts: {"OLD_RUN_ZOMBIE":188,"KEEP_CURRENT":188}

### Proof samples (obsolete raw → canonical still present)

```json
{
  "furgonetas": [
    {
      "raw_external_id": "G4-6",
      "raw_mid": null,
      "has_canonical": true,
      "canonical_id": "db0a850f-009d-4967-983c-4c52d57e49de",
      "identifier": "G4-6"
    },
    {
      "raw_external_id": "G3-6",
      "raw_mid": null,
      "has_canonical": true,
      "canonical_id": "4a0afc2c-b260-4c1b-803b-c7ca780a13fd",
      "identifier": "G3-6"
    },
    {
      "raw_external_id": "G5-6",
      "raw_mid": null,
      "has_canonical": true,
      "canonical_id": "62e676ed-2b25-41dd-8970-e4f81db08a1b",
      "identifier": "G5-6"
    },
    {
      "raw_external_id": "G2-6",
      "raw_mid": null,
      "has_canonical": true,
      "canonical_id": "1ff45eea-99e8-4e08-ae3b-93e3fd64f643",
      "identifier": "G2-6"
    },
    {
      "raw_external_id": "G7-3",
      "raw_mid": null,
      "has_canonical": true,
      "canonical_id": "45841946-66ec-48a3-bd19-47df82d047a0",
      "identifier": "G7-3"
    }
  ],
  "gse": [
    {
      "raw_external_id": "BRK-005",
      "raw_mid": null,
      "has_canonical": true,
      "canonical_id": "0ca1b913-0da0-42d6-b780-8f90a1911811",
      "identifier": "8"
    },
    {
      "raw_external_id": "BRK-126",
      "raw_mid": null,
      "has_canonical": true,
      "canonical_id": "2b5c9190-5461-478c-abea-61b227ac4b3e",
      "identifier": "34"
    },
    {
      "raw_external_id": "BRK-101",
      "raw_mid": null,
      "has_canonical": true,
      "canonical_id": "0fae7825-663c-4e78-82c8-ae4ce9d94946",
      "identifier": "24"
    },
    {
      "raw_external_id": "BRK-202",
      "raw_mid": null,
      "has_canonical": true,
      "canonical_id": "4c3f32af-8eb3-4848-9edc-fb1da945bfb3",
      "identifier": "28"
    },
    {
      "raw_external_id": "BRK-180",
      "raw_mid": null,
      "has_canonical": true,
      "canonical_id": "9c4c5f0e-d0da-43f9-ba7c-7a195d598e7f",
      "identifier": "2"
    }
  ],
  "inventario": [
    {
      "raw_external_id": "BRK-005",
      "raw_mid": null,
      "has_canonical": true,
      "canonical_id": "897d5e8e-c114-4773-8b9f-d55e98280fd0",
      "identifier": "BRK-005"
    },
    {
      "raw_external_id": "BRK-124",
      "raw_mid": null,
      "has_canonical": true,
      "canonical_id": "05ffdc29-6988-442d-b5e8-0d6ca089d107",
      "identifier": "BRK-124"
    },
    {
      "raw_external_id": "BRK-126",
      "raw_mid": null,
      "has_canonical": true,
      "canonical_id": "7640b5e5-33fb-454e-912a-1b38b1d9bd38",
      "identifier": "BRK-126"
    },
    {
      "raw_external_id": "BRK-180",
      "raw_mid": null,
      "has_canonical": true,
      "canonical_id": "21a85023-6366-4beb-b1bc-e0f3c2c729f5",
      "identifier": "BRK-180"
    },
    {
      "raw_external_id": "BRK-202",
      "raw_mid": null,
      "has_canonical": true,
      "canonical_id": "9b1796e7-1a07-4db9-bec1-75d3187cb477",
      "identifier": "BRK-202"
    }
  ]
}
```
