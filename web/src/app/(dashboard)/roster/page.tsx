"use client";

import { useState } from "react";
import { CalendarBlank, Users } from "@phosphor-icons/react";

interface RosterPerson {
  name: string;
  id: string;
  cert: string;
  week: string[];
}

type ShiftType = "iberojet" | "w2f" | "off" | "leave";

interface ShiftStyle {
  bg: string;
  text: string;
  type: ShiftType | "mixed";
}

const ROSTER_DATA: RosterPerson[] = [
  { name: "Joaquin Leocadio", id: "255", cert: "B1, B2", week: ["L", "L", "L", "FL", "L", "L", "L"] },
  { name: "Jose A Carrera", id: "216", cert: "B1, B2", week: ["B", "B", "B", "B", "B", "B", "B"] },
  { name: "Mario Lorenzo", id: "241", cert: "B1, B2", week: ["07:00-19:00", "07:00-19:00", "07:00-19:00", "07:00-18:00", "07:00-18:00", "07:00-18:00", "07:00-18:00"] },
  { name: "Sergio Galan", id: "231", cert: "B1", week: ["V", "V", "V", "08:00-18:00", "V", "V", "V"] },
  { name: "Enrique García", id: "265", cert: "B1", week: ["07:00-17:00", "07:00-17:00", "06:00-16:00", "08:00-16:00", "07:00-17:00", "L", "L"] },
  { name: "Roberto Merino", id: "337", cert: "B1", week: ["L", "09:00-17:00", "07:00-15:00", "V", "V", "FS", "FS"] },
  { name: "Fernando Cabero", id: "457", cert: "B1, B2", week: ["L", "L", "L", "L", "09:00-19:00", "09:00-19:00", "09:00-19:00"] },
  { name: "Alejandro Morales", id: "462", cert: "B1", week: ["10:00-18:00", "L", "L", "L", "L", "V", "V"] },
  { name: "Omar Alawi", id: "458", cert: "B1", week: ["10:00-18:00", "10:00-18:00", "10:00-18:00", "L", "L", "L", "L"] },
  { name: "Roberto Ferrandiz", id: "399", cert: "B1", week: ["09:00-17:00", "07:00-15:00", "10:00-18:00", "14:00-00:00", "L", "L", "L"] },
  { name: "Jose Luis Nafarrate", id: "445", cert: "B1", week: ["L", "L", "10:00-18:00", "10:00-20:00", "10:00-20:00", "10:00-20:00", "L"] },
  { name: "Pablo Regueros", id: "439", cert: "B1", week: ["12:00-20:00", "10:00-18:00", "L", "L", "L", "L", "10:00-20:00"] },
  { name: "Javier Perez", id: "343", cert: "B1", week: ["V", "FSL", "FBL", "FSL", "L", "L", "L"] },
  { name: "Miguel A Perello", id: "364", cert: "B1", week: ["10:00-18:00", "09:00-17:00", "09:00-17:00", "09:00-19:00", "09:00-19:00", "L", "L"] },
  { name: "Enrique Aguado", id: "A-424", cert: "CAT A", week: ["10:00-18:00", "09:00-17:00", "L", "L", "L", "L", "09:00-19:00"] },
];

const W2F_ROWS = new Set([4, 9, 10, 13]);

function getShiftStyle(shift: string, rowIndex: number): ShiftStyle {
  const s = shift.toUpperCase();
  if (["L", "B"].includes(s))
    return { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", type: "off" };
  if (["V", "FS", "FSL", "FBL"].includes(s))
    return { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400", type: "leave" };
  if (s.includes("FL"))
    return { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-400", type: "off" };
  if (W2F_ROWS.has(rowIndex))
    return { bg: "bg-blue-600 dark:bg-blue-700", text: "text-white", type: "w2f" };
  return { bg: "bg-cyan-400 dark:bg-cyan-600", text: "text-slate-900 dark:text-white", type: "iberojet" };
}

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

type Mode = "weekly" | "daily";
type AirlineFilter = "all" | "iberojet" | "w2f";

export default function RosterPage() {
  const [mode, setMode] = useState<Mode>("weekly");
  const [airlineFilter, setAirlineFilter] = useState<AirlineFilter>("all");

  const today = new Date();
  const todayIdx = (today.getDay() + 6) % 7; // Mon=0

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <CalendarBlank size={28} className="text-brand-500" /> Horario
        </h1>

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

      {/* Weekly view */}
      {mode === "weekly" && (
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
              {ROSTER_DATA.map((p, rowIdx) => {
                return (
                  <tr
                    key={p.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="p-3 border-r border-slate-100 dark:border-slate-700 text-xs font-medium text-slate-500">
                      {p.cert}
                    </td>
                    <td className="p-3 border-r border-slate-100 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white truncate max-w-[140px]">
                      {p.name}{" "}
                      <span className="text-slate-400 font-normal">({p.id})</span>
                    </td>
                    {p.week.map((shift, i) => {
                      const style = getShiftStyle(shift, rowIdx);
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
                            {shift}
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
      {mode === "daily" && (
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
            let items = ROSTER_DATA.map((p, idx) => {
              const shift = p.week[todayIdx] ?? "L";
              const style = getShiftStyle(shift, idx);
              return { ...p, shift, style };
            }).filter((p) => p.style.type !== "off" && p.style.type !== "leave");

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
                    key={p.id}
                    className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between hover:border-brand-300 dark:hover:border-brand-600 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-[10px] font-bold px-1.5 py-0.5 rounded">
                          {p.cert}
                        </span>
                        <span className="text-[10px] text-slate-400">ID: {p.id}</span>
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

      {/* Upload hint */}
      <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-start gap-3">
        <Users size={20} className="text-slate-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Datos del horario
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            El horario mostrado es la carga más reciente. Para actualizar, sube el PDF
            del horario mediante el botón de importación cuando esté disponible.
          </p>
        </div>
      </div>
    </div>
  );
}
