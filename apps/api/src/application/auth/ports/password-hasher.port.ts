/**
 * Abstracts password hashing so use cases never import `bcrypt` directly.
 * `BcryptPasswordHasher` (infrastructure layer) is the concrete adapter.
 */
export abstract class PasswordHasherPort {
  abstract hash(plainText: string): Promise<string>;
  abstract compare(plainText: string, hash: string): Promise<boolean>;
}
