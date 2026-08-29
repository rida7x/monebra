-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL DEFAULT 'simple',
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sku" TEXT,
    "shortDescription" TEXT,
    "description" TEXT,
    "categoryId" TEXT,
    "inspirationBrandId" TEXT,
    "inspirationName" TEXT,
    "gender" TEXT NOT NULL DEFAULT 'unisex',
    "fragranceFamily" TEXT,
    "longevity" INTEGER NOT NULL DEFAULT 3,
    "sillage" INTEGER NOT NULL DEFAULT 3,
    "season" TEXT,
    "occasion" TEXT,
    "timeOfDay" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isNew" BOOLEAN NOT NULL DEFAULT false,
    "isBestSeller" BOOLEAN NOT NULL DEFAULT false,
    "isLimited" BOOLEAN NOT NULL DEFAULT false,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "keywords" TEXT,
    "ogImage" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "salesCount" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "searchText" TEXT,
    "minPrice" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "products_inspirationBrandId_fkey" FOREIGN KEY ("inspirationBrandId") REFERENCES "inspiration_brands" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_products" ("categoryId", "createdAt", "description", "fragranceFamily", "gender", "id", "inspirationBrandId", "inspirationName", "isActive", "isBestSeller", "isFeatured", "isLimited", "isNew", "keywords", "longevity", "metaDescription", "metaTitle", "name", "occasion", "ogImage", "salesCount", "searchText", "season", "shortDescription", "sillage", "sku", "slug", "sortOrder", "timeOfDay", "type", "updatedAt", "viewCount") SELECT "categoryId", "createdAt", "description", "fragranceFamily", "gender", "id", "inspirationBrandId", "inspirationName", "isActive", "isBestSeller", "isFeatured", "isLimited", "isNew", "keywords", "longevity", "metaDescription", "metaTitle", "name", "occasion", "ogImage", "salesCount", "searchText", "season", "shortDescription", "sillage", "sku", "slug", "sortOrder", "timeOfDay", "type", "updatedAt", "viewCount" FROM "products";
DROP TABLE "products";
ALTER TABLE "new_products" RENAME TO "products";
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");
CREATE INDEX "products_isActive_sortOrder_idx" ON "products"("isActive", "sortOrder");
CREATE INDEX "products_categoryId_isActive_idx" ON "products"("categoryId", "isActive");
CREATE INDEX "products_gender_isActive_idx" ON "products"("gender", "isActive");
CREATE INDEX "products_type_isActive_idx" ON "products"("type", "isActive");
CREATE INDEX "products_isBestSeller_isActive_idx" ON "products"("isBestSeller", "isActive");
CREATE INDEX "products_isNew_isActive_idx" ON "products"("isNew", "isActive");
CREATE INDEX "products_searchText_idx" ON "products"("searchText");
CREATE INDEX "products_minPrice_idx" ON "products"("minPrice");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
