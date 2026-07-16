import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PasswordHasherPort } from '../../application/auth/ports/password-hasher.port';

/** Matches the cost factor used by `prisma/seed.ts` for the seeded admin user. */
const BCRYPT_SALT_ROUNDS = 12;

@Injectable()
export class BcryptPasswordHasher implements PasswordHasherPort {
  hash(plainText: string): Promise<string> {
    return bcrypt.hash(plainText, BCRYPT_SALT_ROUNDS);
  }

  compare(plainText: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plainText, hash);
  }
}
