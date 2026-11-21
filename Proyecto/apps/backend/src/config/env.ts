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
  // Detras de Nginx/balanceador: "true" hace que request.ip sea la IP real del cliente
  // (X-Forwarded-For) y no la del proxy; sin eso el rate limit cuenta a todos como uno solo.
  // Solo activarlo si el backend NO es alcanzable directo desde internet (el header se puede falsificar).
  FASTIFY_TRUST_PROXY: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
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
  ADMIN_SITE_URL: z.string().url().default("http://localhost:4300"),
  // URL del ecommerce: base de los enlaces de recuperacion de clave de compradores y proveedores.
  ECOMMERCE_URL: z.string().url().default("http://localhost:4200"),
  // Pasarela de pago (KAN-95): Webpay Plus. En "integracion" (default) usa
  // las credenciales publicas de prueba de Transbank si no se indican otras;
  // en "produccion" el codigo de comercio y la API key son obligatorios.
  // La URL de retorno es PUBLIC_BASE_URL + /pagos/webpay/retorno.
  WEBPAY_ENTORNO: z.enum(["integracion", "produccion"]).default("integracion"),
  // KAN-164: "simulada" aprueba todo pago sin Transbank, para las pruebas
  // end-to-end (Newman en el CI) y demos. Prohibida en produccion.
  // "paypal": sandbox de PayPal mientras no haya cuenta empresa de Webpay.
  PASARELA: z.enum(["webpay", "paypal", "simulada"]).default("webpay"),
  PAYPAL_ENTORNO: z.enum(["sandbox", "produccion"]).default("sandbox"),
  PAYPAL_CLIENT_ID: z.string().min(1).optional(),
  PAYPAL_CLIENT_SECRET: z.string().min(1).optional(),
  // PayPal no acepta CLP: se cobra en USD con esta tasa (pesos por dolar).
  PAYPAL_CLP_POR_USD: z.coerce.number().positive().default(950),
  NODE_ENV: z.string().optional(),
  WEBPAY_CODIGO_COMERCIO: z.string().min(1).optional(),
  WEBPAY_API_KEY: z.string().min(1).optional()
}).superRefine((v, ctx) => {
  if (v.WEBPAY_ENTORNO === "produccion") {
    for (const k of ["WEBPAY_CODIGO_COMERCIO", "WEBPAY_API_KEY"] as const) {
      if (!v[k]) ctx.addIssue({ code: "custom", path: [k], message: k + " es obligatorio con WEBPAY_ENTORNO=produccion" });
    }
  }
  if (v.PASARELA === "paypal") {
    for (const k of ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET"] as const) {
      if (!v[k]) ctx.addIssue({ code: "custom", path: [k], message: k + " es obligatorio con PASARELA=paypal" });
    }
  }
  if (v.PASARELA === "simulada" && (v.WEBPAY_ENTORNO === "produccion" || v.NODE_ENV === "production")) {
    ctx.addIssue({ code: "custom", path: ["PASARELA"], message: "PASARELA=simulada no se permite en produccion" });
  }
  if (v.MAIL_DRIVER === "smtp") {
    for (const k of ["SMTP_HOST", "SMTP_FROM"] as const) {
      if (!v[k]) ctx.addIssue({ code: "custom", path: [k], message: k + " es obligatorio con MAIL_DRIVER=smtp" });
    }
  }
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // Una variable vacia (ej. "SMTP_HOST=" en .env.example) cuenta como no
  // definida: si no, los .optional() con min(1) rechazan el string vacio y
  // el server no arranca con el .env de ejemplo.
  const definidas = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== ""));
  return envSchema.parse(definidas);
}
