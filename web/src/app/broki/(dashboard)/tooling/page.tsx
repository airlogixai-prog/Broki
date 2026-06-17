"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Toolbox,
  ArrowsClockwise,
  ArrowUpRight,
  ArrowDownLeft,
  MagnifyingGlass,
  CheckCircle,
  Clock,
  Info,
} from "@phosphor-icons/react";
import { brokiApi } from "@/lib/api/broki";
import { useApp } from "@/context/AppContext";

interface ToolItem {
  bac: string;
  description: string;
  tipo: string;
  ubicacion: string;
  estado: string;
  partNumber: string;
  serialNumber: string;
  rango: string;
  notas: string;
}

interface ToolMovement {
  id: number;
  bac: string;
  description: string;
  checkoutPerson: string;
  checkoutDate: string;
  aircraft: string;
  checkoutNotes: string;
  checkinPerson: string | null;
  checkinDate: string | null;
  checkinNotes: string | null;
  status: "checked_out" | "returned";
}

interface CheckoutForm {
  bac: string;
  tma: string;
  aircraft: string;
  notes: string;
}

interface CheckinForm {
  tma: string;
  notes: string;
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ToolingPage() {
  const { personal, aircraft } = useApp();

  const [catalog, setCatalog] = useState<ToolItem[]>([]);
  const [movements, setMovements] = useState<ToolMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"active" | "catalog" | "history">("active");
  const [search, setSearch] = useState("");
  const [showCheckout, setShowCheckout] = useState(false);
  const [showCheckin, setShowCheckin] = useState<ToolMovement | null>(null);
  const [saving, setSaving] = useState(false);

  const [checkoutForm, setCheckoutForm] = useState<CheckoutForm>({
    bac: "",
    tma: "",
    aircraft: "",
    notes: "",
  });
  const [checkinForm, setCheckinForm] = useState<CheckinForm>({ tma: "", notes: "" });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await brokiApi.fetchTooling();

      const rawCatalog = Array.isArray(data.catalog) ? data.catalog : [];
      const rawMovements = Array.isArray(data.movements) ? data.movements : [];

      setCatalog(
        rawCatalog.map((item: any) => ({
          bac: item.identificador ?? item.bac ?? "",
          description: item.descripcion ?? "Sin descripción",
          tipo: item.tipo_tool ?? "",
          ubicacion: item.ubicacion_habitual ?? "",
          estado: item.estado ?? "",
          partNumber: item.part_number ?? "",
          serialNumber: item.serial_number ?? "",
          rango: item.rango ?? "",
          notas: item.notas ?? "",
        }))
      );

      setMovements(
        rawMovements.map((r: any) => ({
          id: r.id ?? Date.now(),
          bac: r.bac_bact ?? "",
          description: r.descripcion ?? "",
          checkoutPerson: r.tma_out ?? "",
          checkoutDate: r.date_out ?? "",
          aircraft: r.avion ?? "",
          checkoutNotes: r.remarks ?? "",
          checkinPerson: r.tma_in ?? null,
          checkinDate: r.date_in ?? null,
          checkinNotes: r.remarks ?? null,
          status: r.date_in ? "returned" : "checked_out",
        }))
      );
    } catch (e) {
      console.error("[ToolingPage] fetch error", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const activeMovements = movements.filter((m) => m.status === "checked_out");
  const history = movements.filter((m) => m.status === "returned");

  const filteredCatalog = catalog.filter(
    (t) =>
      t.bac.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase())
  );

  const filteredActive = activeMovements.filter(
    (m) =>
      m.bac.toLowerCase().includes(search.toLowerCase()) ||
      m.description.toLowerCase().includes(search.toLowerCase())
  );

  const handleCheckout = async () => {
    if (!checkoutForm.bac || !checkoutForm.tma) return;
    setSaving(true);
    const now = new Date().toISOString();
    const payload = {
      action: "checkout",
      bac_bact: checkoutForm.bac,
      descripcion: catalog.find((t) => t.bac === checkoutForm.bac)?.description ?? "",
      tma_out: checkoutForm.tma,
      date_out: now,
      avion: checkoutForm.aircraft,
      remarks: checkoutForm.notes,
    };

    try {
      await brokiApi.toolingAction(payload);
      await fetchData();
    } catch (e) {
      console.error("[ToolingPage] checkout error", e);
    }
    setShowCheckout(false);
    setCheckoutForm({ bac: "", tma: "", aircraft: "", notes: "" });
    setSaving(false);
  };

  const handleCheckin = async () => {
    if (!showCheckin || !checkinForm.tma) return;
    setSaving(true);
    const now = new Date().toISOString();
    const payload = {
      action: "checkin",
      id: showCheckin.id,
      bac_bact: showCheckin.bac,
      tma_in: checkinForm.tma,
      date_in: now,
      remarks: checkinForm.notes,
    };

    try {
      await brokiApi.toolingAction(payload);
      await fetchData();
    } catch (e) {
      console.error("[ToolingPage] checkin error", e);
    }
    setShowCheckin(null);
    setCheckinForm({ tma: "", notes: "" });
    setSaving(false);
  };

  const fieldCls =
    "w-full text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500";
  const labelCls = "text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1";

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <Toolbox size={28} className="text-brand-500" /> Gestión de Tooling
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
          >
            <ArrowsClockwise size={18} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => setShowCheckout(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-bold rounded-lg hover:bg-brand-700 shadow-sm transition-colors"
          >
            <ArrowUpRight size={16} /> Sacar Herramienta
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm text-center">
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{catalog.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Catálogo</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-100 dark:border-red-900 shadow-sm text-center">
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{activeMovements.length}</p>
          <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">Sacadas</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-100 dark:border-emerald-900 shadow-sm text-center">
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{history.length}</p>
          <p className="text-xs text-emerald-500 dark:text-emerald-400 mt-0.5">Devueltas</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <MagnifyingGlass
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por código BAC o descripción..."
          className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 placeholder-slate-400"
        />
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1">
        {([
          { id: "active",  label: `Sacadas (${activeMovements.length})`, Icon: Clock },
          { id: "catalog", label: `Catálogo (${catalog.length})`, Icon: Info },
          { id: "history", label: `Historial (${history.length})`, Icon: CheckCircle },
        ] as const).map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-colors ${
              tab === id
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            <Icon size={12} /> {label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center h-32">
          <ArrowsClockwise size={28} className="text-brand-500 animate-spin" />
        </div>
      )}

      {/* Active movements */}
      {!loading && tab === "active" && (
        <div className="space-y-3">
          {filteredActive.length === 0 && (
            <div className="text-center py-16 text-slate-400 italic text-sm">
              Sin herramientas sacadas.
            </div>
          )}
          {filteredActive.map((m) => (
            <div
              key={m.id}
              className="bg-white dark:bg-slate-800 rounded-xl border border-red-100 dark:border-red-900/50 shadow-sm p-4 flex items-start justify-between gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20 px-2 py-0.5 rounded">
                    {m.bac}
                  </span>
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                </div>
                <p className="text-sm font-bold text-slate-800 dark:text-white truncate">
                  {m.description}
                </p>
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>👤 {m.checkoutPerson}</span>
                  <span>✈️ {m.aircraft || "—"}</span>
                  <span>📅 {formatDate(m.checkoutDate)}</span>
                </div>
                {m.checkoutNotes && (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 italic truncate">
                    {m.checkoutNotes}
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  setShowCheckin(m);
                  setCheckinForm({ tma: "", notes: "" });
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors shrink-0"
              >
                <ArrowDownLeft size={14} /> Devolver
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Catalog */}
      {!loading && tab === "catalog" && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          {filteredCatalog.length === 0 && (
            <p className="text-center py-12 text-slate-400 italic text-sm">Sin resultados.</p>
          )}
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {filteredCatalog.map((t, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-bold text-brand-600 dark:text-brand-400">
                      {t.bac}
                    </span>
                    {t.tipo && (
                      <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase">
                        {t.tipo}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300 truncate">
                    {t.description}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-slate-400">{t.ubicacion || "—"}</p>
                  {t.partNumber && (
                    <p className="text-[10px] text-slate-400 font-mono">{t.partNumber}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      {!loading && tab === "history" && (
        <div className="space-y-2">
          {history.length === 0 && (
            <p className="text-center py-12 text-slate-400 italic text-sm">Sin historial.</p>
          )}
          {history.map((m) => (
            <div
              key={m.id}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm px-4 py-3 flex items-center gap-4"
            >
              <CheckCircle size={18} className="text-emerald-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-bold text-brand-600 dark:text-brand-400">
                    {m.bac}
                  </span>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 truncate">{m.description}</p>
              </div>
              <div className="text-right shrink-0 text-xs text-slate-400">
                <p>{formatDate(m.checkoutDate)} → {formatDate(m.checkinDate)}</p>
                <p>{m.checkinPerson ?? m.checkoutPerson}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Checkout modal */}
      {showCheckout && (
        <dialog
          open
          className="backdrop:bg-slate-900/50 backdrop:backdrop-blur-sm p-0 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md bg-white dark:bg-slate-900 text-slate-900 dark:text-white m-auto"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <h2 className="font-bold flex items-center gap-2">
              <ArrowUpRight size={18} className="text-brand-500" /> Sacar Herramienta
            </h2>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className={labelCls}>Código BAC/BACT</label>
              {catalog.length > 0 ? (
                <select
                  value={checkoutForm.bac}
                  onChange={(e) => setCheckoutForm((s) => ({ ...s, bac: e.target.value }))}
                  className={fieldCls}
                >
                  <option value="">Seleccionar herramienta...</option>
                  {catalog.map((t) => (
                    <option key={t.bac} value={t.bac}>
                      {t.bac} — {t.description}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={checkoutForm.bac}
                  onChange={(e) => setCheckoutForm((s) => ({ ...s, bac: e.target.value }))}
                  className={fieldCls}
                  placeholder="BAC-XXXX"
                />
              )}
            </div>
            <div>
              <label className={labelCls}>TMA Responsable</label>
              {personal.length > 0 ? (
                <select
                  value={checkoutForm.tma}
                  onChange={(e) => setCheckoutForm((s) => ({ ...s, tma: e.target.value }))}
                  className={fieldCls}
                >
                  <option value="">Seleccionar técnico...</option>
                  {personal.map((p) => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={checkoutForm.tma}
                  onChange={(e) => setCheckoutForm((s) => ({ ...s, tma: e.target.value }))}
                  className={fieldCls}
                  placeholder="Nombre técnico"
                />
              )}
            </div>
            <div>
              <label className={labelCls}>Avión</label>
              {aircraft.length > 0 ? (
                <select
                  value={checkoutForm.aircraft}
                  onChange={(e) => setCheckoutForm((s) => ({ ...s, aircraft: e.target.value }))}
                  className={fieldCls}
                >
                  <option value="">Seleccionar avión...</option>
                  {aircraft.map((a) => (
                    <option key={a.reg} value={a.reg}>{a.reg} · {a.airline}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={checkoutForm.aircraft}
                  onChange={(e) => setCheckoutForm((s) => ({ ...s, aircraft: e.target.value }))}
                  className={fieldCls}
                  placeholder="EC-XXX"
                />
              )}
            </div>
            <div>
              <label className={labelCls}>Notas</label>
              <textarea
                value={checkoutForm.notes}
                onChange={(e) => setCheckoutForm((s) => ({ ...s, notes: e.target.value }))}
                rows={2}
                className={fieldCls}
                placeholder="Observaciones..."
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end px-5 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
            <button
              onClick={() => setShowCheckout(false)}
              className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleCheckout}
              disabled={saving || !checkoutForm.bac || !checkoutForm.tma}
              className="px-4 py-2 bg-brand-600 text-white text-sm font-bold rounded-lg hover:bg-brand-700 disabled:opacity-50 shadow-sm flex items-center gap-2 transition-colors"
            >
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ArrowUpRight size={16} />}
              Confirmar Sacada
            </button>
          </div>
        </dialog>
      )}

      {/* Checkin modal */}
      {showCheckin && (
        <dialog
          open
          className="backdrop:bg-slate-900/50 backdrop:backdrop-blur-sm p-0 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white m-auto"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <h2 className="font-bold flex items-center gap-2">
              <ArrowDownLeft size={18} className="text-emerald-500" /> Devolver Herramienta
            </h2>
          </div>
          <div className="p-5 space-y-4">
            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg text-xs text-slate-600 dark:text-slate-400">
              <span className="font-bold text-slate-800 dark:text-white">{showCheckin.bac}</span>
              {" — "}{showCheckin.description}
            </div>
            <div>
              <label className={labelCls}>TMA que devuelve</label>
              {personal.length > 0 ? (
                <select
                  value={checkinForm.tma}
                  onChange={(e) => setCheckinForm((s) => ({ ...s, tma: e.target.value }))}
                  className={fieldCls}
                >
                  <option value="">Seleccionar técnico...</option>
                  {personal.map((p) => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={checkinForm.tma}
                  onChange={(e) => setCheckinForm((s) => ({ ...s, tma: e.target.value }))}
                  className={fieldCls}
                  placeholder="Nombre técnico"
                />
              )}
            </div>
            <div>
              <label className={labelCls}>Observaciones</label>
              <textarea
                value={checkinForm.notes}
                onChange={(e) => setCheckinForm((s) => ({ ...s, notes: e.target.value }))}
                rows={2}
                className={fieldCls}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end px-5 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
            <button
              onClick={() => setShowCheckin(null)}
              className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleCheckin}
              disabled={saving || !checkinForm.tma}
              className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50 shadow-sm flex items-center gap-2 transition-colors"
            >
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ArrowDownLeft size={16} />}
              Confirmar Devolución
            </button>
          </div>
        </dialog>
      )}
    </div>
  );
}
