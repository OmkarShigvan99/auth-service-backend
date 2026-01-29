-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('MOVIE', 'SERIES', 'DOCUMENTARY', 'SHOW', 'SPORTS', 'KIDS');

-- CreateEnum
CREATE TYPE "VideoQuality" AS ENUM ('SD', 'HD', 'FHD', 'UHD');

-- CreateTable
CREATE TABLE "Content" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "poster" TEXT,
    "thumbnail" TEXT,
    "duration" INTEGER,
    "releaseDate" TIMESTAMP(3) NOT NULL,
    "rating" TEXT,
    "contentType" "ContentType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Genre" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Genre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentGenre" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "genreId" TEXT NOT NULL,

    CONSTRAINT "ContentGenre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentAccess" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "planId" INTEGER NOT NULL,
    "videoQuality" "VideoQuality" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "watchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "progress" INTEGER,
    "completed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "WatchHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Content_contentType_idx" ON "Content"("contentType");

-- CreateIndex
CREATE INDEX "Content_releaseDate_idx" ON "Content"("releaseDate");

-- CreateIndex
CREATE UNIQUE INDEX "Genre_name_key" ON "Genre"("name");

-- CreateIndex
CREATE INDEX "ContentGenre_genreId_idx" ON "ContentGenre"("genreId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentGenre_contentId_genreId_key" ON "ContentGenre"("contentId", "genreId");

-- CreateIndex
CREATE INDEX "ContentAccess_planId_idx" ON "ContentAccess"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentAccess_contentId_planId_key" ON "ContentAccess"("contentId", "planId");

-- CreateIndex
CREATE INDEX "WatchHistory_userId_idx" ON "WatchHistory"("userId");

-- CreateIndex
CREATE INDEX "WatchHistory_contentId_idx" ON "WatchHistory"("contentId");

-- CreateIndex
CREATE UNIQUE INDEX "WatchHistory_userId_contentId_key" ON "WatchHistory"("userId", "contentId");

-- AddForeignKey
ALTER TABLE "ContentGenre" ADD CONSTRAINT "ContentGenre_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentGenre" ADD CONSTRAINT "ContentGenre_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "Genre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentAccess" ADD CONSTRAINT "ContentAccess_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentAccess" ADD CONSTRAINT "ContentAccess_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchHistory" ADD CONSTRAINT "WatchHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchHistory" ADD CONSTRAINT "WatchHistory_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;
