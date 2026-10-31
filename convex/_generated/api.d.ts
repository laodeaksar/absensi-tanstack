/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as assignment from "../assignment.js";
import type * as attendance from "../attendance.js";
import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as debug from "../debug.js";
import type * as importData from "../importData.js";
import type * as lib from "../lib.js";
import type * as maintenance from "../maintenance.js";
import type * as master from "../master.js";
import type * as seed from "../seed.js";
import type * as settings from "../settings.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  assignment: typeof assignment;
  attendance: typeof attendance;
  auth: typeof auth;
  crons: typeof crons;
  debug: typeof debug;
  importData: typeof importData;
  lib: typeof lib;
  maintenance: typeof maintenance;
  master: typeof master;
  seed: typeof seed;
  settings: typeof settings;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
