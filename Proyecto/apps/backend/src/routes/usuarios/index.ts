import type { RouteOptions } from "fastify";
import { idParamSchema } from "@cotizapp/domain";
import {
  actualizarUsuario,
  crearUsuario,
  listarUsuarios,
  obtenerUsuario,
  opcionesUsuarios,
  reactivarUsuario,
  suspenderUsuario
} from "@cotizapp/application";
import { DrizzleUsuarioAdminRepository, DrizzleUsuarioRepository, generarClaveTemporal } from "@cotizapp/infrastructure";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { requireAuth, requirePermiso } from "../../plugins/auth.js";

// Lectura: crear_usuario en cualquier nivel. Escritura: crear_usuario en total.
const LECTURA = [requireAuth, requirePermiso("crear_usuario")];
const ESCRITURA = [requireAuth, requirePermiso({ codigo: "crear_usuario", minimo: "total" })];

const repos = (app: FastifyInstance) => ({
  usuarioAdminRepository: new DrizzleUsuarioAdminRepository(app.db),
  usuarioRepository: new DrizzleUsuarioRepository(app.db)
});
const actor = (r: FastifyRequest) => Number(r.auth?.sub);

const sinCache = (reply: { header: (k: string, v: string) => unknown }) => reply.header("Cache-Control", "no-store");

export const usuarioRoutes: RouteOptions[] = [
  {
    method: "GET",
    url: "/usuarios",
    preHandler: LECTURA,
    handler: async (request) => listarUsuarios(repos(request.server))(request.query)
  },
  {
    method: "GET",
    url: "/usuarios/opciones",
    preHandler: LECTURA,
    handler: async (request) => opcionesUsuarios(repos(request.server))()
  },
  {
    method: "GET",
    url: "/usuarios/:id",
    preHandler: LECTURA,
    handler: async (request) => obtenerUsuario(repos(request.server))(idParamSchema.parse(request.params).id)
  },
  {
    method: "POST",
    url: "/usuarios",
    preHandler: ESCRITURA,
    handler: async (request, reply) => {
      const app = request.server;
      const r = await crearUsuario({
        ...repos(app),
        servicioCorreo: app.servicioCorreo,
        generarClave: generarClaveTemporal,
        urlPanel: app.adminSiteUrl
      })(request.body, actor(request));
      sinCache(reply);
      return reply.status(201).send(r);
    }
  },
  {
    method: "PATCH",
    url: "/usuarios/:id",
    preHandler: ESCRITURA,
    handler: async (request) =>
      actualizarUsuario(repos(request.server))(idParamSchema.parse(request.params).id, request.body, actor(request))
  },
  {
    method: "POST",
    url: "/usuarios/:id/suspender",
    preHandler: ESCRITURA,
    handler: async (request) => suspenderUsuario(repos(request.server))(idParamSchema.parse(request.params).id, actor(request))
  },
  {
    method: "POST",
    url: "/usuarios/:id/reactivar",
    preHandler: ESCRITURA,
    handler: async (request) => reactivarUsuario(repos(request.server))(idParamSchema.parse(request.params).id, actor(request))
  }
];
