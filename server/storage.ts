import { db } from "./db";
import {
  users, products, coupons, orders, orderItems, wishlist,
  type User, type InsertUser, type Product, type InsertProduct,
  type Coupon, type InsertCoupon, type Order, type InsertOrder,
  type OrderItem, type InsertOrderItem, type WishlistItem, type InsertWishlist
} from "@shared/schema";
import { eq, desc, and, or, ilike, sql } from "drizzle-orm";

export interface IStorage {
  // User
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Products
  getProducts(search?: string, category?: string, minPrice?: number, maxPrice?: number): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<boolean>;

  // Coupons
  getCoupons(): Promise<Coupon[]>;
  getCoupon(id: number): Promise<Coupon | undefined>;
  getCouponByCode(code: string): Promise<Coupon | undefined>;
  createCoupon(coupon: InsertCoupon): Promise<Coupon>;
  updateCoupon(id: number, coupon: Partial<InsertCoupon>): Promise<Coupon | undefined>;
  deleteCoupon(id: number): Promise<boolean>;
  incrementCouponUsage(id: number): Promise<void>;

  // Orders
  getOrders(userId?: number): Promise<(Order & { items: (OrderItem & { product: Product })[] })[]>;
  getOrder(id: number): Promise<(Order & { items: (OrderItem & { product: Product })[] }) | undefined>;
  createOrder(order: InsertOrder, items: InsertOrderItem[]): Promise<Order>;
  updateOrderStatus(id: number, status: string): Promise<Order | undefined>;

  // Wishlist
  getWishlist(userId: number): Promise<(WishlistItem & { product: Product })[]>;
  toggleWishlistItem(userId: number, productId: number): Promise<boolean>; // returns true if added, false if removed
  
  // Analytics
  getAnalytics(): Promise<{ totalSales: number, totalOrders: number, totalUsers: number, lowStockProducts: Product[] }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getProducts(search?: string, category?: string, minPrice?: number, maxPrice?: number): Promise<Product[]> {
    const conditions = [];
    if (search) {
      conditions.push(or(ilike(products.name, `%${search}%`), ilike(products.description, `%${search}%`)));
    }
    if (category) {
      conditions.push(eq(products.category, category));
    }
    if (minPrice !== undefined) {
      conditions.push(sql`${products.price} >= ${minPrice}`);
    }
    if (maxPrice !== undefined) {
      conditions.push(sql`${products.price} <= ${maxPrice}`);
    }

    const query = db.select().from(products).orderBy(desc(products.createdAt));
    if (conditions.length > 0) {
      return await query.where(and(...conditions));
    }
    return await query;
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [newProduct] = await db.insert(products).values(product).returning();
    return newProduct;
  }

  async updateProduct(id: number, updates: Partial<InsertProduct>): Promise<Product | undefined> {
    const [updated] = await db.update(products).set(updates).where(eq(products.id, id)).returning();
    return updated;
  }

  async deleteProduct(id: number): Promise<boolean> {
    const [deleted] = await db.delete(products).where(eq(products.id, id)).returning();
    return !!deleted;
  }

  async getCoupons(): Promise<Coupon[]> {
    return await db.select().from(coupons).orderBy(desc(coupons.createdAt));
  }

  async getCoupon(id: number): Promise<Coupon | undefined> {
    const [coupon] = await db.select().from(coupons).where(eq(coupons.id, id));
    return coupon;
  }

  async getCouponByCode(code: string): Promise<Coupon | undefined> {
    const [coupon] = await db.select().from(coupons).where(eq(coupons.code, code));
    return coupon;
  }

  async createCoupon(coupon: InsertCoupon): Promise<Coupon> {
    const [newCoupon] = await db.insert(coupons).values(coupon).returning();
    return newCoupon;
  }

  async updateCoupon(id: number, updates: Partial<InsertCoupon>): Promise<Coupon | undefined> {
    const [updated] = await db.update(coupons).set(updates).where(eq(coupons.id, id)).returning();
    return updated;
  }

  async deleteCoupon(id: number): Promise<boolean> {
    const [deleted] = await db.delete(coupons).where(eq(coupons.id, id)).returning();
    return !!deleted;
  }

  async incrementCouponUsage(id: number): Promise<void> {
    await db.update(coupons)
      .set({ usageCount: sql`${coupons.usageCount} + 1` })
      .where(eq(coupons.id, id));
  }

  async getOrders(userId?: number): Promise<(Order & { items: (OrderItem & { product: Product })[] })[]> {
    const query = db.select().from(orders).orderBy(desc(orders.createdAt));
    let ordersList;
    if (userId !== undefined) {
      ordersList = await query.where(eq(orders.userId, userId));
    } else {
      ordersList = await query;
    }

    const result = [];
    for (const order of ordersList) {
      const items = await db.select({
        orderItem: orderItems,
        product: products,
      })
      .from(orderItems)
      .innerJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orderItems.orderId, order.id));

      result.push({
        ...order,
        items: items.map(i => ({ ...i.orderItem, product: i.product })),
      });
    }

    return result;
  }

  async getOrder(id: number): Promise<(Order & { items: (OrderItem & { product: Product })[] }) | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    if (!order) return undefined;

    const items = await db.select({
      orderItem: orderItems,
      product: products,
    })
    .from(orderItems)
    .innerJoin(products, eq(orderItems.productId, products.id))
    .where(eq(orderItems.orderId, order.id));

    return {
      ...order,
      items: items.map(i => ({ ...i.orderItem, product: i.product })),
    };
  }

  async createOrder(orderData: InsertOrder, itemsData: InsertOrderItem[]): Promise<Order> {
    return await db.transaction(async (tx) => {
      const [newOrder] = await tx.insert(orders).values(orderData).returning();
      
      for (const item of itemsData) {
        await tx.insert(orderItems).values({
          ...item,
          orderId: newOrder.id,
        });
        
        // update stock
        await tx.update(products)
          .set({ stock: sql`${products.stock} - ${item.quantity}` })
          .where(eq(products.id, item.productId));
      }

      return newOrder;
    });
  }

  async updateOrderStatus(id: number, status: string): Promise<Order | undefined> {
    const [updated] = await db.update(orders).set({ status }).where(eq(orders.id, id)).returning();
    return updated;
  }

  async getWishlist(userId: number): Promise<(WishlistItem & { product: Product })[]> {
    const items = await db.select({
      wishlistItem: wishlist,
      product: products,
    })
    .from(wishlist)
    .innerJoin(products, eq(wishlist.productId, products.id))
    .where(eq(wishlist.userId, userId));

    return items.map(i => ({ ...i.wishlistItem, product: i.product }));
  }

  async toggleWishlistItem(userId: number, productId: number): Promise<boolean> {
    const existing = await db.select().from(wishlist)
      .where(and(eq(wishlist.userId, userId), eq(wishlist.productId, productId)));
      
    if (existing.length > 0) {
      await db.delete(wishlist).where(eq(wishlist.id, existing[0].id));
      return false; // Removed
    } else {
      await db.insert(wishlist).values({ userId, productId });
      return true; // Added
    }
  }

  async getAnalytics(): Promise<{ totalSales: number, totalOrders: number, totalUsers: number, lowStockProducts: Product[] }> {
    const [{ sum }] = await db.select({ sum: sql<number>`sum(${orders.totalAmount})` }).from(orders).where(eq(orders.status, 'completed'));
    const [{ count: orderCount }] = await db.select({ count: sql<number>`count(*)` }).from(orders);
    const [{ count: userCount }] = await db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.role, 'user'));
    
    const lowStockProducts = await db.select().from(products).where(sql`${products.stock} < 10`).orderBy(products.stock).limit(10);
    
    return {
      totalSales: Number(sum || 0),
      totalOrders: Number(orderCount || 0),
      totalUsers: Number(userCount || 0),
      lowStockProducts,
    };
  }
}

export const storage = new DatabaseStorage();
