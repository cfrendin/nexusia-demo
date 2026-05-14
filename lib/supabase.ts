import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type ChronicStatus = "vencido" | "hoy" | "urgente" | "proximo" | "ok";

export type ChronicPatient = {
  id: number;
  name: string;
  phone: string;
  medication: string;
  fullProductName: string;
  dosage_instructions: string | null;
  next_refill_date: string | null;
  daysUntilRefill: number;
  status: ChronicStatus;
  next_refill_label: string;
};

function shortMedName(fullName: string): string {
  const doseMatch = fullName.match(/(\d+[\s.,]*(?:mg|Mg|MG|mcg|g|G)\b)/);
  const firstWord = fullName.split(/\s+/)[0];
  if (!doseMatch) return firstWord;
  const dose = doseMatch[1].replace(/\s+/g, "").replace(",", ".").toLowerCase();
  return `${firstWord} ${dose}`;
}

function computeDays(dateStr: string | null): number {
  if (!dateStr) return 999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const refill = new Date(dateStr + "T00:00:00");
  return Math.round((refill.getTime() - today.getTime()) / 86_400_000);
}

function getStatus(days: number): ChronicStatus {
  if (days < 0) return "vencido";
  if (days === 0) return "hoy";
  if (days <= 2) return "urgente";
  if (days <= 7) return "proximo";
  return "ok";
}

function refillLabel(days: number, dateStr: string | null): string {
  if (days < 0) return days === -1 ? "Ayer" : `Hace ${Math.abs(days)} días`;
  if (days === 0) return "Hoy";
  if (days === 1) return "Mañana";
  if (days <= 7) return `En ${days} días`;
  if (!dateStr) return "Próximamente";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("es-VE", { day: "numeric", month: "long" });
}

export async function getChronicPatients(): Promise<ChronicPatient[]> {
  const { data, error } = await supabase
    .from("chronic_medications")
    .select(`
      id,
      dosage_instructions,
      refill_interval_days,
      last_refill_date,
      next_refill_date,
      active,
      customers ( id, name, phone, cedula ),
      products ( id, name )
    `)
    .eq("active", true)
    .order("next_refill_date", { ascending: true });

  if (error) {
    console.error("[chronic_medications] query error:", error.message);
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((row: any) => row.customers?.name && row.products?.name)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((row: any) => {
      const days = computeDays(row.next_refill_date);
      return {
        id: row.id,
        name: row.customers.name,
        phone: row.customers.phone ?? "",
        medication: shortMedName(row.products.name),
        fullProductName: row.products.name,
        dosage_instructions: row.dosage_instructions ?? null,
        next_refill_date: row.next_refill_date ?? null,
        daysUntilRefill: days,
        status: getStatus(days),
        next_refill_label: refillLabel(days, row.next_refill_date),
      };
    });
}
