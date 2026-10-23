import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().min(1),
  // Lista separada por coma (ver CORS_ORIGINS en .env). Un solo origen string
  // no alcanza: hay varios frontends en dev (admin-site en :4300, ecommerce
  // en :4200, etc.) y @fastify/cors acepta un arreglo de origenes.
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:4200")
    .transform((value) => value.split(",").map((origin) => origin.trim()).filter(Boolean)),
  JWT_SECRET: z.string().min(1)
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(source);
}
