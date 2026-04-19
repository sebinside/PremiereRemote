import express from "express";
import { RegisterRoutes } from "./generated/routes";

export function createApp(): express.Application {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  RegisterRoutes(app);

  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      if (err instanceof Error) {
        console.error(err);
        res.status(500).json({ message: err.message });
      } else {
        res.status(500).json({ message: "An unexpected error occurred" });
      }
    }
  );

  return app;
}
