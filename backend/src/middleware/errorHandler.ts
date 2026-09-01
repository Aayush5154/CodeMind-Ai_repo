import { Request, Response, NextFunction } from "express";
import { env } from "../config/env.js";

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      console.error(`[${req.method} ${req.originalUrl}] ${err.message}`);
    }
    res.status(err.statusCode).json({ success: false, message: err.message });
    return;
  }

  if (err.name === "ValidationError") {
    res.status(400).json({ success: false, message: err.message });
    return;
  }

  if (err.name === "CastError") {
    res.status(400).json({ success: false, message: "Invalid identifier" });
    return;
  }

  if (
    (err.name === "MongoServerError" || err.name === "MongoError") &&
    (err as any).code === 11000
  ) {
    res.status(409).json({ success: false, message: "Resource already exists" });
    return;
  }

  if (err.name === "SyntaxError" && "body" in err) {
    res.status(400).json({ success: false, message: "Malformed JSON body" });
    return;
  }

  console.error(`[${req.method} ${req.originalUrl}] Unhandled error:`, err);

  res.status(500).json({
    success: false,
    message: "Internal server error",
    // Stack traces and driver messages can leak schema and infrastructure detail.
    ...(env.isProduction ? {} : { detail: err.message, stack: err.stack }),
  });
}
