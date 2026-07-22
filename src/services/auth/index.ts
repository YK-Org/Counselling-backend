import jwt from "jsonwebtoken";

class AuthService {
  generateAccessToken = (
    user: Record<string, any>,
    tokenType = "app",
    expires = "86400s"
  ) => {
    const secret = process.env.TOKEN_SECRET ? process.env.TOKEN_SECRET : "";
    const data = {
      user: user,
      tokenType,
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
