-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'orders_manager',
    "permissionsOverride" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "admin_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adminId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_sessions_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admin_users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "login_attempts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "identifier" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "ip" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "inspiration_brands" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "aliases" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "products" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "products_inspirationBrandId_fkey" FOREIGN KEY ("inspirationBrandId") REFERENCES "inspiration_brands" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "product_images_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sizeMl" INTEGER,
    "sku" TEXT,
    "price" INTEGER NOT NULL,
    "comparePrice" INTEGER,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 5,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "product_variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "product_notes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "product_notes_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "product_tags" (
    "productId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    PRIMARY KEY ("productId", "tagId"),
    CONSTRAINT "product_tags_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "product_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "bundle_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bundleId" TEXT NOT NULL,
    "itemVariantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "bundle_items_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "bundle_items_itemVariantId_fkey" FOREIGN KEY ("itemVariantId") REFERENCES "product_variants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "deliveryFee" INTEGER NOT NULL DEFAULT 0,
    "deliveryDays" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "areas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deliveryFeeOverride" INTEGER,
    "deliveryDaysOverride" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "areas_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "ordersCount" INTEGER NOT NULL DEFAULT 0,
    "totalSpent" INTEGER NOT NULL DEFAULT 0,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "cityId" TEXT,
    "areaId" TEXT,
    "line" TEXT NOT NULL,
    "notes" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "addresses_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "addresses_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "addresses_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "areas" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderNumber" TEXT NOT NULL,
    "customerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "paymentMethod" TEXT NOT NULL DEFAULT 'cod',
    "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "cityId" TEXT,
    "areaId" TEXT,
    "cityName" TEXT NOT NULL,
    "areaName" TEXT,
    "addressLine" TEXT NOT NULL,
    "notes" TEXT,
    "subtotal" INTEGER NOT NULL,
    "discountTotal" INTEGER NOT NULL DEFAULT 0,
    "deliveryFee" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "couponId" TEXT,
    "couponCode" TEXT,
    "discountBreakdown" TEXT,
    "deviceType" TEXT,
    "source" TEXT,
    "referrer" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "stockApplied" BOOLEAN NOT NULL DEFAULT false,
    "stockRestored" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "confirmedAt" DATETIME,
    "deliveredAt" DATETIME,
    "cancelledAt" DATETIME,
    CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "orders_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "orders_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "areas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "orders_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "variantId" TEXT,
    "productName" TEXT NOT NULL,
    "variantLabel" TEXT NOT NULL,
    "imageUrl" TEXT,
    "productSlug" TEXT,
    "unitPrice" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "lineTotal" INTEGER NOT NULL,
    CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "order_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "order_status_history" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "adminId" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "order_status_history_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "order_status_history_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admin_users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "counters" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "variantId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "stockAfter" INTEGER NOT NULL,
    "orderId" TEXT,
    "adminId" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inventory_movements_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inventory_movements_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "inventory_movements_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admin_users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "minOrderTotal" INTEGER NOT NULL DEFAULT 0,
    "maxDiscount" INTEGER,
    "usageLimit" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "perCustomerLimit" INTEGER,
    "scope" TEXT NOT NULL DEFAULT 'all',
    "startsAt" DATETIME,
    "endsAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "coupon_targets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "couponId" TEXT NOT NULL,
    "productId" TEXT,
    "categoryId" TEXT,
    CONSTRAINT "coupon_targets_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "coupon_targets_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "coupon_targets_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "coupon_usages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "couponId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT,
    "amount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "coupon_usages_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "coupon_usages_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "coupon_usages_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "promotions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'products',
    "startsAt" DATETIME,
    "endsAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "promotion_targets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "promotionId" TEXT NOT NULL,
    "productId" TEXT,
    "categoryId" TEXT,
    CONSTRAINT "promotion_targets_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "promotion_targets_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "promotion_targets_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "orderId" TEXT,
    "customerName" TEXT NOT NULL,
    "phone" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "adminNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "reviews_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "reviews_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "hero_slides" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "mediaUrl" TEXT,
    "mediaType" TEXT NOT NULL DEFAULT 'image',
    "ctaText" TEXT,
    "ctaLink" TEXT,
    "ctaText2" TEXT,
    "ctaLink2" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "group" TEXT NOT NULL DEFAULT 'general',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "content_pages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "productId" TEXT,
    "sessionId" TEXT,
    "deviceType" TEXT,
    "path" TEXT,
    "referrer" TEXT,
    "meta" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "analytics_events_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "error_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "level" TEXT NOT NULL DEFAULT 'error',
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "context" TEXT,
    "path" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE INDEX "admin_users_role_idx" ON "admin_users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "admin_sessions_tokenHash_key" ON "admin_sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "admin_sessions_adminId_idx" ON "admin_sessions"("adminId");

-- CreateIndex
CREATE INDEX "admin_sessions_expiresAt_idx" ON "admin_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "login_attempts_identifier_createdAt_idx" ON "login_attempts"("identifier", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_isActive_sortOrder_idx" ON "categories"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "inspiration_brands_name_key" ON "inspiration_brands"("name");

-- CreateIndex
CREATE UNIQUE INDEX "inspiration_brands_slug_key" ON "inspiration_brands"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE INDEX "products_isActive_sortOrder_idx" ON "products"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "products_categoryId_isActive_idx" ON "products"("categoryId", "isActive");

-- CreateIndex
CREATE INDEX "products_gender_isActive_idx" ON "products"("gender", "isActive");

-- CreateIndex
CREATE INDEX "products_type_isActive_idx" ON "products"("type", "isActive");

-- CreateIndex
CREATE INDEX "products_isBestSeller_isActive_idx" ON "products"("isBestSeller", "isActive");

-- CreateIndex
CREATE INDEX "products_isNew_isActive_idx" ON "products"("isNew", "isActive");

-- CreateIndex
CREATE INDEX "product_images_productId_sortOrder_idx" ON "product_images"("productId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_sku_key" ON "product_variants"("sku");

-- CreateIndex
CREATE INDEX "product_variants_productId_sortOrder_idx" ON "product_variants"("productId", "sortOrder");

-- CreateIndex
CREATE INDEX "product_variants_stock_idx" ON "product_variants"("stock");

-- CreateIndex
CREATE INDEX "product_notes_productId_type_idx" ON "product_notes"("productId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

-- CreateIndex
CREATE INDEX "bundle_items_bundleId_idx" ON "bundle_items"("bundleId");

-- CreateIndex
CREATE UNIQUE INDEX "cities_name_key" ON "cities"("name");

-- CreateIndex
CREATE INDEX "cities_isActive_sortOrder_idx" ON "cities"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "areas_cityId_isActive_idx" ON "areas"("cityId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "areas_cityId_name_key" ON "areas"("cityId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");

-- CreateIndex
CREATE INDEX "addresses_customerId_idx" ON "addresses"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders"("orderNumber");

-- CreateIndex
CREATE INDEX "orders_status_createdAt_idx" ON "orders"("status", "createdAt");

-- CreateIndex
CREATE INDEX "orders_customerPhone_idx" ON "orders"("customerPhone");

-- CreateIndex
CREATE INDEX "orders_cityId_idx" ON "orders"("cityId");

-- CreateIndex
CREATE INDEX "orders_createdAt_idx" ON "orders"("createdAt");

-- CreateIndex
CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");

-- CreateIndex
CREATE INDEX "order_items_productId_idx" ON "order_items"("productId");

-- CreateIndex
CREATE INDEX "order_status_history_orderId_createdAt_idx" ON "order_status_history"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "inventory_movements_variantId_createdAt_idx" ON "inventory_movements"("variantId", "createdAt");

-- CreateIndex
CREATE INDEX "inventory_movements_reason_idx" ON "inventory_movements"("reason");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

-- CreateIndex
CREATE INDEX "coupons_isActive_idx" ON "coupons"("isActive");

-- CreateIndex
CREATE INDEX "coupon_targets_couponId_idx" ON "coupon_targets"("couponId");

-- CreateIndex
CREATE INDEX "coupon_usages_couponId_idx" ON "coupon_usages"("couponId");

-- CreateIndex
CREATE INDEX "coupon_usages_customerId_idx" ON "coupon_usages"("customerId");

-- CreateIndex
CREATE INDEX "promotions_isActive_startsAt_endsAt_idx" ON "promotions"("isActive", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "promotion_targets_promotionId_idx" ON "promotion_targets"("promotionId");

-- CreateIndex
CREATE INDEX "reviews_productId_status_idx" ON "reviews"("productId", "status");

-- CreateIndex
CREATE INDEX "reviews_status_createdAt_idx" ON "reviews"("status", "createdAt");

-- CreateIndex
CREATE INDEX "hero_slides_isActive_sortOrder_idx" ON "hero_slides"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "settings_group_idx" ON "settings"("group");

-- CreateIndex
CREATE UNIQUE INDEX "content_pages_slug_key" ON "content_pages"("slug");

-- CreateIndex
CREATE INDEX "notifications_isRead_createdAt_idx" ON "notifications"("isRead", "createdAt");

-- CreateIndex
CREATE INDEX "analytics_events_type_createdAt_idx" ON "analytics_events"("type", "createdAt");

-- CreateIndex
CREATE INDEX "analytics_events_productId_type_idx" ON "analytics_events"("productId", "type");

-- CreateIndex
CREATE INDEX "analytics_events_sessionId_idx" ON "analytics_events"("sessionId");

-- CreateIndex
CREATE INDEX "error_logs_level_createdAt_idx" ON "error_logs"("level", "createdAt");
