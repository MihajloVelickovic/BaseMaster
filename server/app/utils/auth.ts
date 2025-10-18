import bcrypt from "bcrypt"
import crypto from 'crypto';

const SALT_ROUNDS = 12;


export async function hashPassword(plainPassword: string): Promise<string> {
  return await bcrypt.hash(plainPassword, SALT_ROUNDS);
}

export async function verifyPassword(
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> {
  return await bcrypt.compare(plainPassword, hashedPassword);
}

export function hashJTI(jti: string): string {
  return crypto.createHash('sha256').update(jti).digest('hex');
}