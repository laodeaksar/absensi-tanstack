/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as access from "../access.js";
import type * as assignment from "../assignment.js";
import type * as attendance from "../attendance.js";
import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as debug from "../debug.js";
import type * as errors from "../errors.js";
import type * as grades from "../grades.js";
import type * as http from "../http.js";
import type * as jwt from "../jwt.js";
import type * as lib from "../lib.js";
import type * as limits from "../limits.js";
import type * as maintenance from "../maintenance.js";
import type * as master from "../master.js";
import type * as promotion from "../promotion.js";
import type * as reports from "../reports.js";
import type * as rules from "../rules.js";
import type * as security from "../security.js";
import type * as seed from "../seed.js";
import type * as settings from "../settings.js";
import type * as subjects from "../subjects.js";
import type * as submission from "../submission.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  access: typeof access;
  assignment: typeof assignment;
  attendance: typeof attendance;
  auth: typeof auth;
  crons: typeof crons;
  debug: typeof debug;
  errors: typeof errors;
  grades: typeof grades;
  http: typeof http;
  jwt: typeof jwt;
  lib: typeof lib;
  limits: typeof limits;
  maintenance: typeof maintenance;
  master: typeof master;
  promotion: typeof promotion;
  reports: typeof reports;
  rules: typeof rules;
  security: typeof security;
  seed: typeof seed;
  settings: typeof settings;
  subjects: typeof subjects;
  submission: typeof submission;
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
