"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Cylinder,
  ArrowsClockwise,
  PencilSimple,
  FloppyDisk,
  Wrench,
} from "@phosphor-icons/react";
import { brokiApi } from "@/lib/api/broki";
import { NitroStockCard } from "@/components/stock/NitroStockCard";
import { useApp } from "@/context/AppContext";
import { getStatusClass } from "@/lib/mappers/equipment";

const KEY_T4S = "t4s";
const KEY_T123 = "t1,2,3";

// The stock rows arrive with several historical spellings of the same column,
// including the "cantida_" typo that the legacy sheet shipped with.
type StockRow = Record<string, unknown>;

const asCount = (value: unknown): number => {
  const n = parseInt(String(value ?? ""), 10);
  return Number.isNaN(n) ? 0 : n;
};

function parseEntry(row: StockRow | undefined): { full: number; empty: number } {
  if (!row) return { full: 0, empty: 0 };
  return {
    full: asCount(
      row.botellas_llenas ?? row.cantida_de_botellas_llenas ?? row.cantidad_de_botellas_llenas,
    ),
    empty: asCount(row.botellas_vacias ?? row.cantidad_de_botellas_vacias),
  };
}

const locationOf = (row: StockRow): string => String(row.ubicacion ?? "").toLowerCase();

export default function StockPage() {
  const { gse } = useApp();
  const [t4s, setT4s] = useState({ full: 0, empty: 0 });
  const [t123, setT123] = useState({ full: 0, empty: 0 });
  const [loading, setLoading] = useState(true);
  const [editingStock, setEditingStock] = useState(false);
  const [editingGse, setEditingGse] = useState(false);
  const [saving, setSaving] = useState(false);

  // Only the bottles the user has actually touched are held here; everything
  // else reads straight from the context, so there is no state to keep in sync
  // when a Realtime update changes the pressures underneath.
  const [pressureEdits, setPressureEdits] = useState<Record<string, number[]>>({});

  const nitroGse = gse.filter((item) => {
    const fam = (item.family ?? "").toUpperCase();
    const model = (item.model ?? "").toUpperCase();
    return fam.includes("NITRO") || model.includes("NITRO") || model.includes("N2");
  });

  const pressuresOf = useCallback(
    (item: { id: string; pressures?: number[] }): number[] =>
      pressureEdits[item.id] ??
      (item.pressures?.length ? item.pressures : [0, 0, 0, 0]),
    [pressureEdits],
  );

  const fetchStock = useCallback(async (alive: () => boolean = () => true) => {
    try {
      const data = await brokiApi.fetchStock();
      if (!alive()) return;
      if (Array.isArray(data)) {
        const rows = data as StockRow[];
        setT4s(parseEntry(rows.find((r) => locationOf(r) === KEY_T4S)));
        setT123(
          parseEntry(rows.find((r) => locationOf(r).includes(KEY_T123.split(",")[0]))),
        );
      }
    } catch (e) {
      console.error("[StockPage] fetch error", e);
    }
    if (alive()) setLoading(false);
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      await fetchStock(() => alive);
    })();
    return () => {
      alive = false;
    };
  }, [fetchStock]);

  const handleSaveStock = async () => {
    setSaving(true);
    try {
      await brokiApi.updateStock({
        action: "update_nitro_stock",
        type: "stock",
        location: "t4S",
        llenas: t4s.full,
        vacias: t4s.empty,
      });
      await brokiApi.updateStock({
        action: "update_nitro_stock",
        type: "stock",
        location: "t1,2,3",
        llenas: t123.full,
        vacias: t123.empty,
      });
      setEditingStock(false);
    } catch (e) {
      console.error("[StockPage] save stock error", e);
    }
    setSaving(false);
  };

  const handleSaveGse = async () => {
    setSaving(true);
    try {
      for (const item of nitroGse) {
        const p = pressuresOf(item);
        await brokiApi.updateEquipment({
          action: "update_equipment",
          item_id: item.id,
          type: item.type,
          updates: {
            nitrogeno_1: p[0],
            nitrogeno_2: p[1],
            nitrogeno_3: p[2],
            nitrogeno_4: p[3],
          },
          timestamp: new Date().toISOString(),
        });
      }
      setPressureEdits({});
      setEditingGse(false);
    } catch (e) {
      console.error("[StockPage] save gse error", e);
    }
    setSaving(false);
  };

  const setPressure = (itemId: string, idx: number, val: number) => {
    const current = pressuresOf({ id: itemId, pressures: nitroGse.find((i) => i.id === itemId)?.pressures });
    const arr = [...current];
    arr[idx] = val;
    setPressureEdits((prev) => ({ ...prev, [itemId]: arr }));
  };

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <Cylinder size={28} className="text-brand-500" /> Stock de Nitrógeno
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void fetchStock()}
            disabled={loading}
            className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
          >
            <ArrowsClockwise size={18} className={loading ? "animate-spin" : ""} />
          </button>
          {!editingStock ? (
            <button
              onClick={() => setEditingStock(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors shadow-sm"
            >
              <PencilSimple size={16} /> Editar Stock
            </button>
          ) : (
            <button
              onClick={handleSaveStock}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60 shadow-sm transition-colors ring-2 ring-emerald-500 ring-offset-2"
            >
              {saving ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <FloppyDisk size={16} />
              )}
              Confirmar
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-32">
          <ArrowsClockwise size={28} className="text-brand-500 animate-spin" />
        </div>
      )}

      {/* Terminal cards */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <NitroStockCard
            name="Terminal T4S"
            full={t4s.full}
            empty={t4s.empty}
            color="brand"
            editing={editingStock}
            onFullChange={(v) => setT4s((s) => ({ ...s, full: v }))}
            onEmptyChange={(v) => setT4s((s) => ({ ...s, empty: v }))}
          />
          <NitroStockCard
            name="Terminales T1, T2, T3"
            full={t123.full}
            empty={t123.empty}
            color="blue"
            editing={editingStock}
            onFullChange={(v) => setT123((s) => ({ ...s, full: v }))}
            onEmptyChange={(v) => setT123((s) => ({ ...s, empty: v }))}
          />
        </div>
      )}

      {/* Nitro GSE section */}
      {nitroGse.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Wrench size={20} className="text-slate-400" /> Equipos de Nitrógeno (GSE)
            </h3>
            {!editingGse ? (
              <button
                onClick={() => setEditingGse(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors shadow-sm"
              >
                <PencilSimple size={14} /> Editar GSE
              </button>
            ) : (
              <button
                onClick={handleSaveGse}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60 shadow-sm transition-colors"
              >
                <FloppyDisk size={14} /> Confirmar
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {nitroGse.map((item) => {
              const pressures = pressuresOf(item);
              return (
                <div
                  key={item.id}
                  className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700 shadow-sm"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="text-xs font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20 px-2 py-0.5 rounded">
                        {item.id}
                      </span>
                      <p className="text-sm font-bold text-slate-800 dark:text-white mt-1">
                        {item.plate || item.model}
                      </p>
                    </div>
                    <span
                      className={`w-3 h-3 rounded-full shadow-sm ${getStatusClass(item.status)}`}
                    />
                  </div>

                  <div className="grid grid-cols-4 gap-2 bg-slate-50 dark:bg-slate-700/50 p-2 rounded-lg border border-slate-100 dark:border-slate-600/50">
                    {[0, 1, 2, 3].map((i) => {
                      const val = pressures[i] ?? 0;
                      const hue = Math.min(Math.max(val, 0) / 3000, 1) * 120;
                      return (
                        <div key={i} className="flex flex-col gap-1 items-center">
                          <span className="text-[9px] uppercase font-bold text-slate-400">
                            #{i + 1}
                          </span>
                          {editingGse ? (
                            <input
                              type="number"
                              min={0}
                              value={val}
                              onChange={(e) =>
                                setPressure(item.id, i, Number(e.target.value))
                              }
                              className="w-full text-center text-xs font-bold border-b-2 border-slate-300 dark:border-slate-600 bg-transparent py-1 focus:border-brand-500 outline-none transition-colors text-slate-900 dark:text-white"
                            />
                          ) : (
                            <div
                              className="text-center font-black text-sm"
                              style={{ color: `hsl(${hue}, 85%, 45%)` }}
                            >
                              {val}
                              <span className="text-[9px] text-slate-400 font-bold block">
                                PSI
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
