"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CalendarBlank,
  Users,
  UploadSimple,
  ArrowsClockwise,
  Warning,
} from "@phosphor-icons/react";
import { brokiApi, type RosterPerson, type RosterWeek } from "@/lib/api/broki";

type ShiftType = "iberojet" | "w2f" | "off" | "leave" | "none";

interface ShiftStyle {
  bg: string;
  text: string;
  type: ShiftType;
}

/**
 * The airline comes from the imported PDF. The legacy dashboard guessed it from a
 * hardcoded set of table row indices, which mislabels everyone as soon as the
 * roster order changes, so an unknown airline now renders as a neutral shift
 * instead of being silently assigned to Iberojet.
 */
function getShiftStyle(shift: string, airline: RosterPerson["airline"]): ShiftStyle {
  const s = shift.trim().toUpperCase();
  if (!s)
    return { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-400", type: "none" };
  if (["L", "B", "BL", "LD"].includes(s))
    return { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", type: "off" };
  if (["V", "FS", "FSL", "FBL", "P", "IT", "SL"].includes(s))
    return { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400", type: "leave" };
  if (s.includes("FL"))
    return { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-400", type: "off" };
  if (airline === "w2f")
    return { bg: "bg-blue-600 dark:bg-blue-700", text: "text-white", type: "w2f" };
  if (airline === "iberojet")
    return { bg: "bg-cyan-400 dark:bg-cyan-600", text: "text-slate-900 dark:text-white", type: "iberojet" };
  return { bg: "bg-slate-200 dark:bg-slate-700", text: "text-slate-700 dark:text-slate-200", type: "none" };
}

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

type Mode = "weekly" | "daily";
type AirlineFilter = "all" | "iberojet" | "w2f";

export default function RosterPage() {
  const [mode, setMode] = useState<Mode>("weekly");
  const [airlineFilter, setAirlineFilter] = useState<AirlineFilter>("all");
  const [roster, setRoster] = useState<RosterWeek | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (alive: () => boolean = () => true) => {
    setLoading(true);
    setError(null);
    try {
      const fetched = await brokiApi.fetchRoster();
      if (alive()) setRoster(fetched);
    } catch (err) {
      if (alive()) {
        setError(err instanceof Error ? err.message : "No se pudo cargar el horario");
      }
    } finally {
      if (alive()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      await load(() => alive);
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    setNotice(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await brokiApi.rosterUpload(formData);
      setNotice(
        result.duplicate
          ? (result.message ?? "Este PDF ya se habia importado.")
          : `Horario importado: ${result.people ?? 0} personas, ${result.imported ?? 0} turnos.`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir el horario");
    } finally {
      setUploading(false);
    }
  };

  const people = roster?.people ?? [];
  const today = new Date();
  const todayIdx = (today.getDay() + 6) % 7; // Mon=0

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <CalendarBlank size={28} className="text-brand-500" /> Horario
          </h1>
          {roster?.week && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Semana del{" "}
              {new Date(`${roster.week}T00:00:00`).toLocaleDateString("es-ES", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
              {roster.isFallback && " · ultimo horario importado"}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Mode toggle */}
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 gap-1">
            {(["weekly", "daily"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
                  mode === m
                    ? "bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {m === "weekly" ? "Semana" : "Hoy"}
              </button>
            ))}
          </div>

          {/* Airline filter - only in daily */}
          {mode === "daily" && (
            <div className="flex gap-1.5">
              {(["all", "iberojet", "w2f"] as AirlineFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setAirlineFilter(f)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                    airlineFilter === f
                      ? f === "iberojet"
                        ? "bg-cyan-500 text-white shadow-md"
                        : f === "w2f"
                        ? "bg-blue-900 text-white shadow-md"
                        : "bg-slate-800 text-white shadow-md"
                      : f === "iberojet"
                      ? "bg-white dark:bg-slate-800 text-cyan-600 border border-cyan-200 dark:border-cyan-800"
                      : f === "w2f"
                      ? "bg-white dark:bg-slate-800 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                  }`}
                >
                  {f === "all" ? "Todos" : f === "iberojet" ? "Iberojet" : "W2Fly"}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3"
        >
          <Warning size={18} className="text-red-500 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-red-700 dark:text-red-300">{error}</p>
            <button
              onClick={() => void load()}
              className="mt-1 text-xs font-bold text-red-600 dark:text-red-400 underline hover:no-underline"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      {notice && (
        <p
          role="status"
          className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300"
        >
          {notice}
        </p>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {[
          { label: "Iberojet", cls: "bg-cyan-400 text-slate-900" },
          { label: "W2Fly", cls: "bg-blue-600 text-white" },
          { label: "Libranza / Baja", cls: "bg-amber-100 text-amber-700" },
          { label: "Vacaciones / Free", cls: "bg-red-100 text-red-700" },
        ].map((l) => (
          <span
            key={l.label}
            className={`px-2 py-0.5 rounded font-bold ${l.cls}`}
          >
            {l.label}
          </span>
        ))}
      </div>

      {loading && (
        <div
          className="h-64 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 animate-pulse"
          aria-busy="true"
        />
      )}

      {!loading && !error && people.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
            <CalendarBlank size={36} className="text-slate-400 dark:text-slate-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Sin horario importado</h3>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm max-w-sm">
            Sube el PDF del horario para ver los turnos de la semana.
          </p>
        </div>
      )}

      {/* Weekly view */}
      {!loading && people.length > 0 && mode === "weekly" && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700">
                <th className="p-3 text-left text-[10px] font-bold text-slate-500 uppercase w-16 border-r border-slate-100 dark:border-slate-700">
                  Cert
                </th>
                <th className="p-3 text-left text-[10px] font-bold text-slate-500 uppercase border-r border-slate-100 dark:border-slate-700">
                  Nombre
                </th>
                {DAYS.map((d, i) => (
                  <th
                    key={d}
                    className={`p-3 text-center text-[10px] font-bold uppercase border-r last:border-0 border-slate-100 dark:border-slate-700 ${
                      i === todayIdx
                        ? "text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20"
                        : "text-slate-500"
                    }`}
                  >
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {people.map((p) => {
                return (
                  <tr
                    key={`${p.name}-${p.id}`}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="p-3 border-r border-slate-100 dark:border-slate-700 text-xs font-medium text-slate-500">
                      {p.cert}
                    </td>
                    <td className="p-3 border-r border-slate-100 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white truncate max-w-[140px]">
                      {p.name}{" "}
                      {p.id && <span className="text-slate-400 font-normal">({p.id})</span>}
                    </td>
                    {p.week.map((shift, i) => {
                      const style = getShiftStyle(shift, p.airline);
                      return (
                        <td
                          key={i}
                          className={`p-1 border-r last:border-0 border-slate-100 dark:border-slate-700 text-center ${
                            i === todayIdx ? "bg-brand-50/50 dark:bg-brand-900/10" : ""
                          }`}
                        >
                          <div
                            className={`text-[10px] font-bold p-1 rounded ${style.bg} ${style.text} truncate`}
                          >
                            {shift || "—"}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Daily view */}
      {!loading && people.length > 0 && mode === "daily" && (
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Turno de hoy ·{" "}
            <span className="font-medium text-slate-700 dark:text-slate-300 capitalize">
              {today.toLocaleDateString("es-ES", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </span>
          </p>
          {(() => {
            let items = people
              .map((p) => {
                const shift = p.week[todayIdx] ?? "";
                return { ...p, shift, style: getShiftStyle(shift, p.airline) };
              })
              .filter(
                (p) =>
                  p.style.type !== "off" &&
                  p.style.type !== "leave" &&
                  p.shift.trim() !== "",
              );

            if (airlineFilter !== "all") {
              items = items.filter((p) => p.style.type === airlineFilter);
            }

            if (items.length === 0) {
              return (
                <div className="col-span-full py-12 text-center text-slate-400 italic text-sm">
                  No hay personal asignado para este filtro hoy.
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((p) => (
                  <div
                    key={`${p.name}-${p.id}`}
                    className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between hover:border-brand-300 dark:hover:border-brand-600 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-[10px] font-bold px-1.5 py-0.5 rounded">
                          {p.cert}
                        </span>
                        {p.id && <span className="text-[10px] text-slate-400">ID: {p.id}</span>}
                      </div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                        {p.name}
                      </h4>
                    </div>
                    <div className="text-right">
                      <div
                        className={`mb-1 ${p.style.bg} ${p.style.text} text-[10px] font-bold px-2 py-1 rounded-lg inline-block shadow-sm`}
                      >
                        {p.shift}
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">
                        {p.style.type === "w2f"
                          ? "W2Fly"
                          : p.style.type === "iberojet"
                          ? "Iberojet"
                          : "Turno"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <Users size={20} className="text-slate-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Datos del horario
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Sube el PDF del horario para actualizar los turnos. Subir el mismo
              archivo dos veces no duplica la semana.
            </p>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleUpload(file);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-60 transition-colors"
        >
          {uploading ? (
            <ArrowsClockwise size={16} className="animate-spin" />
          ) : (
            <UploadSimple size={16} />
          )}
          {uploading ? "Subiendo..." : "Subir PDF"}
        </button>
      </div>
    </div>
  );
}
