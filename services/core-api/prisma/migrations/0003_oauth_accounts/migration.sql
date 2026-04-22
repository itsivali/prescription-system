-- 0003_oauth_accounts
-- Adds OAuth provider account linking and makes passwordHash nullable
-- for users who authenticate exclusively via external IdPs.

-- Allow OAuth-only users (no local password).
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- OAuth provider accounts linked to a single user profile.
CREATE TABLE "Account" (
    "id"                TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "userId"            TEXT NOT NULL,
    "provider"          TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "accessToken"       TEXT,
    "refreshToken"      TEXT,
    "tokenExpiresAt"    TIMESTAMP(3),
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- Each external identity maps to exactly one Account row.
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key"
    ON "Account"("provider", "providerAccountId");

CREATE INDEX "Account_userId_idx" ON "Account"("userId");

ALTER TABLE "Account"
    ADD CONSTRAINT "Account_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
