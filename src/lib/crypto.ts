import "server-only";
import { createHash, randomBytes } from "node:crypto";

export const sha256Hex = (value: string) => createHash("sha256").update(value).digest("hex");

/** Unguessable URL-safe token (256 bits). Only its hash is ever stored. */
export const randomToken = () => randomBytes(32).toString("base64url");
