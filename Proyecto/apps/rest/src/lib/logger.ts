import os from "node:os";
import { inspect } from "node:util";

type LogLevel = "debug" | "info" | "warn" | "error" | "fatal" | "all";

type LogMeta = Record<string, unknown>;

const appIdentifiers = {
  region: process.env.REGION ?? "",
  clusterType: "",
  hostname: os.hostname(),
  app: process.env.APP_NAME ?? "rest",
  version: process.env.APP_VERSION ?? "0.0.0",
  environment: process.env.ENVIRONMENT ?? process.env.NODE_ENV,
  developer: os.userInfo().username
};

function getCallerFileName(): string {
  const stack = new Error().stack?.split("\n") ?? [];
  const callerLine = stack[4] ?? "";
  const match = callerLine.match(/\(([^)]+)\)/) ?? callerLine.match(/at (.*)/);
  return match?.[1]?.trim().replace(/^file:\/\//, "") ?? "unknown";
}

function log(level: LogLevel, message: string, meta: LogMeta = {}): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level: `[${level.toUpperCase()}]`,
    message,
    fileName: getCallerFileName(),
    ...appIdentifiers,
    ...meta
  };
  console.log(inspect(entry, { colors: true, depth: null, sorted: true }));
  console.log();
}

export const logger = {
  debug: (message: string, meta?: LogMeta) => log("debug", message, meta),
  info: (message: string, meta?: LogMeta) => log("info", message, meta),
  warn: (message: string, meta?: LogMeta) => log("warn", message, meta),
  error: (message: string, meta?: LogMeta) => log("error", message, meta),
  fatal: (message: string, meta?: LogMeta) => log("fatal", message, meta),
  all: (message: string, meta?: LogMeta) => log("all", message, meta)
};
