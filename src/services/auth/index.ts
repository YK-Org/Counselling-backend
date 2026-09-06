import jwt from "jsonwebtoken";

class AuthService {
  // How long a signed-in session lasts before the browser has to present a
  // fresh token. Was 24 hours, which is a long window for a bearer token
  // sitting in localStorage on a shared office machine. Eight hours covers a
  // working day, and /auth/refresh extends it while someone is actually using
  // the app, so the shorter life is not felt.
  //
  // Note this is not the only control: tokenIssuedAt is checked on every
  // request, so a session can still be revoked immediately regardless of the
  // token's own expiry.
  static readonly DEFAULT_TTL = process.env.TOKEN_TTL || "28800s";

  generateAccessToken = (
    user: Record<string, any>,
    tokenType = "app",
    expires = AuthService.DEFAULT_TTL,
    extraClaims: Record<string, any> = {}
  ) => {
    const secret = process.env.TOKEN_SECRET ? process.env.TOKEN_SECRET : "";
    const data = {
      user: user,
      tokenType,
      ...extraClaims,
    };
    try {
      const tok = jwt.sign(data, secret, { expiresIn: expires });
      const decodedToken = jwt.decode(tok);

      let issuedAt;
      if (decodedToken) {
        issuedAt = (decodedToken as jwt.JwtPayload).iat;
      }
      return { token: tok, issuedAt };
    } catch (error) {
      console.log("tg", error);
    }
    return { token: "", issuedAt: 0 };
  };
}

export default new AuthService();
