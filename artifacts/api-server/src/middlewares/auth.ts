import type { Request, Response, NextFunction } from "express";

/**
 * Middleware: verifica che la richiesta contenga l'header x-admin-key
 * con il valore corretto. Restituisce 403 se mancante o errato.
 */
export function requireAdminKey(req: Request, res: Response, next: NextFunction): void {
  const adminKey = process.env.ADMIN_KEY;

  if (!adminKey) {
    req.log.error("ADMIN_KEY not configured in environment");
    res.status(500).json({ error: "Server misconfiguration" });
    return;
  }

  const provided = req.headers["x-admin-key"];

  if (!provided || provided !== adminKey) {
    req.log.warn({ ip: req.ip }, "Unauthorized attempt to access admin endpoint");
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  next();
}
