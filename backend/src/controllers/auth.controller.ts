import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { AppError } from "../middleware/errorHandler.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_FIELD_LENGTH = 254;

function generateToken(userId: string): string {
  return jwt.sign({ id: userId }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as any,
  });
}

function validateCredentials(email: unknown, password: unknown): {
  email: string;
  password: string;
} {
  if (typeof email !== "string" || typeof password !== "string") {
    throw new AppError("Email and password are required", 400);
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) {
    throw new AppError("Email and password are required", 400);
  }
  if (normalizedEmail.length > MAX_FIELD_LENGTH || password.length > 200) {
    throw new AppError("Email or password is too long", 400);
  }
  return { email: normalizedEmail, password };
}

export async function register(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name } = req.body ?? {};
    const { email, password } = validateCredentials(
      req.body?.email,
      req.body?.password
    );

    if (typeof name !== "string" || !name.trim()) {
      throw new AppError("Name is required", 400);
    }
    if (name.trim().length > 100) {
      throw new AppError("Name is too long (max 100 characters)", 400);
    }
    if (!EMAIL_PATTERN.test(email)) {
      throw new AppError("Please provide a valid email address", 400);
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new AppError(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
        400
      );
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new AppError("An account with this email already exists", 409);
    }

    const user = await User.create({ name: name.trim(), email, password });
    const token = generateToken(user._id.toString());

    res.status(201).json({
      success: true,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt,
        },
        token,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function login(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, password } = validateCredentials(
      req.body?.email,
      req.body?.password
    );

    const user = await User.findOne({ email }).select("+password");
    // The same message for both branches avoids revealing which emails exist.
    if (!user || !(await user.comparePassword(password))) {
      throw new AppError("Invalid email or password", 401);
    }

    const token = generateToken(user._id.toString());

    res.json({
      success: true,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt,
        },
        token,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getMe(
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> {
  res.json({
    success: true,
    data: {
      _id: req.user!._id,
      name: req.user!.name,
      email: req.user!.email,
      createdAt: req.user!.createdAt,
    },
  });
}
