import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().min(1),
  // Uno o varios origenes separados por coma (ej. "http://a,http://b").
  CORS_ORIGIN: z
    .string()
    .default("http://localhost:4200,http://localhost:4300")
    .transform((v) => v.split(",").map((o) => o.trim()).filter(Boolean)),
  JWT_SECRET: z.string().min(1),
  // Almacenamiento de archivos. Hoy solo "local"; "spaces" (DigitalOcean
  // Spaces) es el punto de extension para produccion (ver lib/storage.ts).
  STORAGE_DRIVER: z.enum(["local"]).default("local"),
  UPLOADS_DIR: z.string().min(1).default("./uploads"),
  UPLOADS_MAX_MB: z.coerce.number().positive().default(5),
  // Base absoluta con la que se arman las URL publicas de los archivos.
  PUBLIC_BASE_URL: z.string().url().default("http://localhost:8000"),
  // Ingesta publica POST /eventos: solicitudes maximas por IP en la ventana (leido en routes/eventos).
  EVENTOS_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
  EVENTOS_RATE_LIMIT_WINDOW_SEC: z.coerce.number().int().positive().default(60),
  // Correo transaccional. "consola" (default, dev) no envia nada; "smtp" usa nodemailer.
  MAIL_DRIVER: z.enum(["consola", "smtp"]).default("consola"),
  // Solo consola: directorio donde se escribe el cuerpo de cada correo (vacio = no escribir).
  MAIL_OUT_DIR: z.string().optional(),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASS: z.string().min(1).optional(),
  SMTP_FROM: z.string().min(1).optional(),
  // URL del panel administrativo que se incluye en las invitaciones.
  ADMIN_SITE_URL: z.string().url().default("http://localhost:4300")
}).superRefine((v, ctx) => {
  if (v.MAIL_DRIVER === "smtp") {
    for (const k of ["SMTP_HOST", "SMTP_FROM"] as const) {
      if (!v[k]) ctx.addIssue({ code: "custom", path: [k], message: k + " es obligatorio con MAIL_DRIVER=smtp" });
    }
  }
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(source);
}
