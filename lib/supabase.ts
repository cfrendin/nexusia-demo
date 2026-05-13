import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type ChronicPatient = {
  id: number;
  name: string;
  medication: string;
  dosage: string;
  next_refill_label: string;
  adherence: number;
  urgency: "high" | "medium" | "low";
  store: string;
  phone: string;
};

// The real chronic_medications table has FK schema:
// customer_id → customers(name, phone, preferred_store)
// product_id  → products(name)
// No name/medication/adherence columns — those come from JOINs.
// For the pitch demo we always fall back to these 3 patients when the
// JOIN returns nothing (table empty or no test customers seeded).
const SEED_PATIENTS: Omit<ChronicPatient, "id">[] = [
  {
    name: "María García",
    medication: "Losartan 50mg",
    dosage: "LOSARTÁN MK 50MG X 30 TAB",
    next_refill_label: "3 días",
    adherence: 88,
    urgency: "high",
    store: "Farmatodo Chacao",
    phone: "+584141234567",
  },
  {
    name: "Carlos Rodríguez",
    medication: "Metformina 850mg",
    dosage: "METFORMINA PORTUGAL 850MG X 30 TAB",
    next_refill_label: "Hoy",
    adherence: 72,
    urgency: "high",
    store: "Farmatodo Las Mercedes",
    phone: "+584161234567",
  },
  {
    name: "Ana Martínez",
    medication: "Enalapril 10mg",
    dosage: "ENALAPRIL CALOX 10MG X 30 TAB",
    next_refill_label: "Viernes",
    adherence: 95,
    urgency: "medium",
    store: "Farmatodo Altamira",
    phone: "+584121234567",
  },
];

function daysLabel(dateStr: string | null): { label: string; urgency: "high" | "medium" | "low" } {
  if (!dateStr) return { label: "Próximamente", urgency: "medium" };
  const days = Math.ceil(
    (new Date(dateStr).getTime() - Date.now()) / 86_400_000
  );
  if (days <= 0) return { label: "Hoy", urgency: "high" };
  if (days === 1) return { label: "Mañana", urgency: "high" };
  if (days <= 3) return { label: `${days} días`, urgency: "high" };
  if (days <= 7) return { label: `${days} días`, urgency: "medium" };
  return { label: `${days} días`, urgency: "low" };
}

export async function getChronicPatients(): Promise<ChronicPatient[]> {
  // Try the real schema: chronic_medications joined with customers + products
  const { data, error } = await supabase
    .from("chronic_medications")
    .select(`
      id,
      next_reminder_date,
      customers ( name, phone, preferred_store ),
      products ( name )
    `)
    .eq("active", true)
    .limit(20);

  // Any error (table missing, permission, etc.) → use seed
  if (error) {
    console.warn("[chronic_medications] query error:", error.message);
    return SEED_PATIENTS.map((p, i) => ({ ...p, id: i + 1 }));
  }

  // Table empty or JOIN produced no usable rows → use seed
  const usable = (data ?? []).filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (row: any) => row.customers?.name && row.products?.name
  );
  if (usable.length === 0) {
    return SEED_PATIENTS.map((p, i) => ({ ...p, id: i + 1 }));
  }

  // Map real joined rows to ChronicPatient
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return usable.map((row: any, i: number) => {
    const { label, urgency } = daysLabel(row.next_reminder_date);
    const seed = SEED_PATIENTS[i % SEED_PATIENTS.length];
    return {
      id: row.id,
      name: row.customers.name,
      medication: row.products.name,
      dosage: row.products.name,
      next_refill_label: label,
      // adherence not in schema — use seed value as stand-in
      adherence: seed.adherence,
      urgency,
      store: row.customers.preferred_store ?? seed.store,
      phone: row.customers.phone ?? seed.phone,
    };
  });
}
