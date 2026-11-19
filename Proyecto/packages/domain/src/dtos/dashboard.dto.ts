import { z } from "zod";

const vacio = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

// ?mes=YYYY-MM (opcional; por defecto el mes actual en America/Santiago)
export const dashboardQuerySchema = z.object({
  mes: z.preprocess(vacio, z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "mes debe tener formato YYYY-MM").optional())
});
export type DashboardQueryDto = z.infer<typeof dashboardQuerySchema>;
