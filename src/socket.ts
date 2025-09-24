import * as jwt from "jsonwebtoken";
let io: any;

export function initialize(server: any) {
  io = require("socket.io")(server, {
    cors: {
      origin: "*",
    },
  });

  io.use(function (socket: any, next: any) {
    if (socket.handshake.auth && socket.handshake.auth.token) {
      jwt.verify(
        socket.handshake.auth.token,
        process.env.TOKEN_SECRET as string,
        function (err: any, decoded: any) {
          if (err) return next(new Error("Authentication error"));
          socket.decoded = decoded;
          next();
        }
      );
    } else {
      next(new Error("Authentication error"));
    }
  }).on("connection", function (socket: any) {
    // Connection now authenticated to receive further events
    const body = socket.decoded;
    if (body.user && body.user.role === "headCounsellor") {
      socket.join(`headcounsellor`);
    } else {
      socket.join(`counsellor-${body.user._id}`);
    }
  });
}

export function getIO() {
  return io;
}
