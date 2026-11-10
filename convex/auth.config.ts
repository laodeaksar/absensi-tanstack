import { JWT_AUDIENCE } from "./jwt";

export default {
  providers: [
    {
      type: "customJwt",
      applicationID: JWT_AUDIENCE,
      issuer: `${process.env.CONVEX_SITE_URL}`,
      jwks: `${process.env.CONVEX_SITE_URL}/.well-known/jwks.json`,
      algorithm: "RS256",
    },
  ],
};
