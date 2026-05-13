import { NextResponse } from "next/server";
import { getChronicPatients } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const patients = await getChronicPatients();
    return NextResponse.json({ patients });
  } catch (err) {
    console.error("[/api/cronicos]", err);
    return NextResponse.json(
      { error: "Error al cargar pacientes" },
      { status: 500 }
    );
  }
}
