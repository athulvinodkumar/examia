import { handleRequest } from "../../src/worker.js";

/**
 * Cloudflare Pages Functions wildcard route handler for /api/*
 */
export async function onRequest(context) {
  return handleRequest(context.request, context.env, context);
}
