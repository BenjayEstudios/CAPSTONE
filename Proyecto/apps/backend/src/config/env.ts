import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().min(1),
  CORS_ORIGIN: z.string().default("http://localhost:4200"),
  JWT_SECRET: z.string().min(1),
  // Almacenamiento de archivos. Hoy solo "local"; "spaces" (DigitalOcean
  // Spaces) es el punto de extension para produccion (ver lib/storage.ts).
  STORAGE_DRIVER: z.enum(["local"]).default("local"),
  UPLOADS_DIR: z.string().min(1).default("./uploads"),
  UPLOADS_MAX_MB: z.coerce.number().positive().default(5),
  // Base absoluta con la que se arman las URL publicas de los archivos.
  PUBLIC_BASE_URL: z.string().url().default("http://localhost:8000")
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(source);
}
