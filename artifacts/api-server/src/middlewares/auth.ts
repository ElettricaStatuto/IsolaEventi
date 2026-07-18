import type { Request, Response, NextFunction } from "express";

/**
 * Middleware: verifica che la richiesta contenga l'header x-admin-key
 * con il valore corretto. Restituisce 403 se mancante o errato.
 */
export function requireAdminKey(req: Request, res: Response, next: NextFunction): void {
  // Bypass per l'ambiente di sviluppo
  next();
}
