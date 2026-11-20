import type { FastifyRequest, RouteOptions } from "fastify";
import {
  actualizarOferta,
  crearOferta,
  eliminarOferta,
  listarMisOfertas,
  listarProductosDisponibles,
  obtenerMiOferta,
  type DepsOfertas, historialMiOferta } from "@cotizapp/application";
import { DrizzleModeracionRepository, DrizzleOfertaRepository, DrizzleUsuarioRepository } from "@cotizapp/infrastructure";
import { requireAuth, requirePermiso } from "../../plugins/auth.js";

// Ofertas del proveedor (KAN-146). Siempre sobre las de la organizacion de
// la sesion: no hay forma de ver ni tocar ofertas de otro proveedor (404).
const guardias = [requireAuth, requirePermiso("publicar_precio_stock")];

const deps = (request: FastifyRequest): DepsOfertas => {
  const db = request.server.db;
  return {
    ofertaRepository: new DrizzleOfertaRepository(db),
    usuarioRepository: new DrizzleUsuarioRepository(db),
    moderacionRepository: new DrizzleModeracionRepository(db)
  };
};
const uid = (request: FastifyRequest) => Number(request.auth?.sub);

// ?estado&q&pagina&tamano
const listRoute: RouteOptions = {
  method: "GET",
  url: "/ofertas",
  preHandler: guardias,
  handler: async (request) => listarMisOfertas(deps(request))(uid(request), request.query)
};

// Productos publicados sin oferta de este proveedor. ?q&categoriaId&pagina&tamano
const disponiblesRoute: RouteOptions = {
  method: "GET",
  url: "/ofertas/productos-disponibles",
  preHandler: guardias,
  handler: async (request) => listarProductosDisponibles(deps(request))(uid(request), request.query)
};

const getRoute: RouteOptions = {
  method: "GET",
  url: "/ofertas/:id",
  preHandler: guardias,
  handler: async (request) => obtenerMiOferta(deps(request))(uid(request), request.params)
};

// 201 { oferta, revisionPrecio }. revisionPrecio != null si el precio supera
// el tope sobre la referencia (se abrio un caso precio_fuera_rango).
const createRoute: RouteOptions = {
  method: "POST",
  url: "/ofertas",
  preHandler: guardias,
  handler: async (request, reply) => reply.status(201).send(await crearOferta(deps(request))(uid(request), request.body))
};

// Ultimos cambios de precio y stock (oferta_precio_historial) de una oferta mia (KAN-103).
const historialRoute: RouteOptions = {
  method: "GET",
  url: "/ofertas/:id/historial",
  preHandler: guardias,
  handler: async (request) => historialMiOferta(deps(request))(uid(request), request.params)
};

const updateRoute: RouteOptions = {
  method: "PATCH",
  url: "/ofertas/:id",
  preHandler: guardias,
  handler: async (request) => actualizarOferta(deps(request))(uid(request), request.params, request.body)
};

// Solo borradores sin ventas (409 OFERTA_NO_ELIMINABLE): lo publicado se pausa.
const deleteRoute: RouteOptions = {
  method: "DELETE",
  url: "/ofertas/:id",
  preHandler: guardias,
  handler: async (request, reply) => {
    await eliminarOferta(deps(request))(uid(request), request.params);
    return reply.status(204).send();
  }
};

export const ofertaRoutes: RouteOptions[] = [listRoute, disponiblesRoute, getRoute, createRoute, updateRoute, deleteRoute, historialRoute];
