import type { FastifyReply, FastifyRequest } from "fastify";

// Limitador de tasa en memoria (ventana fija) por IP. La IP solo vive en este Map
// (nunca se escribe en la DB ni en logs) y se descarta al vencer la ventana.
// Una sola instancia del backend: con varias replicas el limite es por replica
// (para un limite global habria que moverlo a un almacen compartido, ej. Redis).
export function crearLimitadorTasa(opts: { max: number; ventanaMs: number }) {
  const contadores = new Map<string, { n: number; reinicia: number }>();
  const MAX_CLAVES = 50_000; // tope de memoria ante un barrido de IPs

  return async function limitarTasa(request: FastifyRequest, reply: FastifyReply) {
    const ahora = Date.now();
    if (contadores.size >= MAX_CLAVES) {
      for (const [k, v] of contadores) if (v.reinicia <= ahora) contadores.delete(k);
      if (contadores.size >= MAX_CLAVES) contadores.clear();
    }
    const clave = request.ip;
    let c = contadores.get(clave);
    if (!c || c.reinicia <= ahora) {
      c = { n: 0, reinicia: ahora + opts.ventanaMs };
      contadores.set(clave, c);
    }
    c.n += 1;
    const restantes = Math.max(0, opts.max - c.n);
    reply.header("X-RateLimit-Limit", opts.max).header("X-RateLimit-Remaining", restantes);
    if (c.n > opts.max) {
      const seg = Math.max(1, Math.ceil((c.reinicia - ahora) / 1000));
      return reply
        .header("Retry-After", seg)
        .status(429)
        .send({ error: { code: "RATE_LIMIT", message: "Demasiadas solicitudes, intenta mas tarde" } });
    }
  };
}
