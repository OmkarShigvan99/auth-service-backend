#!/bin/sh
set -euo pipefail

echo "🚀 Starting application bootstrap..."

echo "📦 Running database migrations..."
npx prisma migrate deploy

echo "🌱 Checking if database needs seeding..."

PLAN_COUNT=$(
  node -e "
    const { prisma } = require('./dist/src/configs/prisma.config');
    prisma.plan.count()
      .then(c => console.log(c))
      .catch(() => console.log(0));
  " | tr -cd '0-9'
)

echo "DEBUG raw PLAN_COUNT: [$PLAN_COUNT]"
echo "DEBUG hex dump:"
printf '%s' "$PLAN_COUNT" | od -An -tx1

if [ $PLAN_COUNT -eq 0 ]; then
  echo "🌱 No plans found — running production seed..."
  npm run seed:prod
else
  echo "✅ Seed skipped — $PLAN_COUNT plans already exist"
fi

echo "🟢 Starting application..."
exec node dist/src/index.js
