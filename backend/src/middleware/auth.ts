import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User, type IUser } from "../models/User.js";

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      message: "Authentication required. Please log in.",
    });
    return;
  }

  const token = authHeader.slice(7).trim();

  let decoded: { id: string };
  try {
    decoded = jwt.verify(token, env.JWT_SECRET) as { id: string };
  } catch (error) {
    const expired = (error as Error)?.name === "TokenExpiredError";
    res.status(401).json({
      success: false,
      message: expired
        ? "Your session has expired. Please log in again."
        : "Invalid authentication token. Please log in again.",
    });
    return;
  }

  try {
    const user = await User.findById(decoded.id);
    if (!user) {
      res.status(401).json({
        success: false,
        message: "Account no longer exists. Please log in again.",
      });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    // A database failure is not an auth failure; let the error handler answer 500.
    next(error);
  }
}
