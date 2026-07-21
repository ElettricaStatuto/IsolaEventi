import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Serve event images statically
const imagesDir = path.resolve(process.cwd(), "..", "..", "data", "event-images");
app.use("/api/event-images", express.static(imagesDir));

// Serve event pdfs statically
const pdfsDir = path.resolve(process.cwd(), "..", "..", "data", "event-pdfs");
app.use("/api/event-pdfs", express.static(pdfsDir));

app.use("/api", router);

export default app;
