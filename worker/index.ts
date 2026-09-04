/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { createRemoteJWKSet, jwtVerify } from "jose";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  APP_ENV?: string;
  PRIVATE_MODE?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

type AccessIdentity = {
  sub: string;
  email: string;
  name?: string;
};

function privateModeEnabled(env: Env): boolean {
  return env.PRIVATE_MODE === "true";
}

async function accessIdentity(request: Request, env: Env): Promise<AccessIdentity | null> {
  if (!privateModeEnabled(env)) return null;

  const teamDomain = env.ACCESS_TEAM_DOMAIN?.replace(/\/$/, "");
  const audience = env.ACCESS_AUD?.trim();
  const token = request.headers.get("cf-access-jwt-assertion");
  if (!teamDomain || !audience || !token) return null;

  try {
    const jwks = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
    const { payload } = await jwtVerify(token, jwks, {
      issuer: teamDomain,
      audience,
    });
    const sub = typeof payload.sub === "string" ? payload.sub.trim() : "";
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    const name = typeof payload.name === "string" ? payload.name.trim() : undefined;
    return sub && email ? { sub, email, name } : null;
  } catch (error) {
    console.warn("Cloudflare Access token validation failed", error);
    return null;
  }
}

function requestWithIdentity(request: Request, identity: AccessIdentity | null): Request {
  const headers = new Headers(request.headers);
  headers.delete("x-corkwill-user-id");
  headers.delete("x-corkwill-user-email");
  headers.delete("x-corkwill-user-name");
  if (identity) {
    headers.set("x-corkwill-user-id", `access:${identity.sub}`);
    headers.set("x-corkwill-user-email", identity.email);
    if (identity.name) headers.set("x-corkwill-user-name", identity.name);
  }
  return new Request(request, { headers });
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const identity = await accessIdentity(request, env);
    if (privateModeEnabled(env) && !identity) {
      const configured = Boolean(env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD);
      return new Response(configured ? "Cloudflare Access authentication required." : "Private access is not configured yet.", {
        status: configured ? 403 : 503,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      });
    }

    const authenticatedRequest = requestWithIdentity(request, identity);
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(authenticatedRequest, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, authenticatedRequest.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(authenticatedRequest, env, ctx);
  },
};

export default worker;
