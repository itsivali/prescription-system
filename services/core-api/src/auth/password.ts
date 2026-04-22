import * as argon2 from 'argon2';

// Argon2id parameters — OWASP-recommended defaults.
const OPTS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19_456,    // 19 MiB
  timeCost: 2,
  parallelism: 1,
};

export const hashPassword   = (plain: string) => argon2.hash(plain, OPTS);
export const verifyPassword = (hash: string, plain: string) => argon2.verify(hash, plain);
