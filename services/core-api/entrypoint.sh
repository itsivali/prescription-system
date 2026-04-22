#!/bin/sh
set -e

# Append sslmode if not already present
case "$DATABASE_URL" in
  *sslmode=*|*ssl=*) ;;
  *"?"*) export DATABASE_URL="${DATABASE_URL}&sslmode=require" ;;
  *) export DATABASE_URL="${DATABASE_URL}?sslmode=require" ;;
esac

# Run migrations then start (use bundled prisma, not npx which downloads latest)
./node_modules/.bin/prisma migrate deploy
exec node dist/index.js
