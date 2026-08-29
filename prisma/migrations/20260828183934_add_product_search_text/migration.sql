-- AlterTable
ALTER TABLE "products" ADD COLUMN "searchText" TEXT;

-- CreateIndex
CREATE INDEX "products_searchText_idx" ON "products"("searchText");
