import { cn } from "@/lib/utils";

export default function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    unpaid: "bg-red-100 text-red-700 border-red-200",
    partial: "bg-amber-100 text-amber-700 border-amber-200",
    paid: "bg-green-100 text-green-700 border-green-200",
    cancelled: "bg-gray-100 text-gray-600 border-gray-200",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        map[status] || map.unpaid
      )}
    >
      {status}
    </span>
  );
}