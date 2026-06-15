import { getStatusClass } from "@/lib/mappers/equipment";

interface Props {
  status: string;
}

export function StatusPill({ status }: Props) {
  return (
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border shadow-sm block w-full text-center ${getStatusClass(status)}`}
    >
      {status}
    </span>
  );
}
