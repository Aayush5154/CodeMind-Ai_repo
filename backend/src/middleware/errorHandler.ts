import { Request, Response, NextFunction } from "express";

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
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log full error details for debugging (API client errors often hide details in .data)
  const errAny = err as any;
  if (errAny.data || errAny.status) {
    console.error("Error:", err.message, {
      status: errAny.status,
      statusText: errAny.statusText,
      data: errAny.data,
    });
  } else {
    console.error("Error:", err.message);
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
    return;
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    res.status(400).json({
      success: false,
      message: err.message,
    });
    return;
  }

  // Mongoose duplicate key error
  if (err.name === "MongoServerError" && (err as any).code === 11000) {
    res.status(409).json({
      success: false,
      message: "Resource already exists",
    });
    return;
  }

  // Default to 500
  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
}
