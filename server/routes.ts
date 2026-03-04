import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth } from "./auth";

function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

function requireAdmin(req: any, res: any, next: any) {
  if (!req.isAuthenticated() || req.user.role !== 'admin') {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
}

import passport from "passport";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const { hashPassword } = setupAuth(app);

  // AUTH ROUTES
  app.post(api.auth.register.path, async (req, res, next) => {
    try {
      const input = api.auth.register.input.parse(req.body);
      const existing = await storage.getUserByUsername(input.username);
      if (existing) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      const hashedPassword = await hashPassword(input.password);
      // Auto-assign first user as admin
      const { totalUsers } = await storage.getAnalytics();
      const isFirst = totalUsers === 0;
      
      const user = await storage.createUser({
        ...input,
        password: hashedPassword,
        role: isFirst ? 'admin' : 'user'
      });
      
      req.login(user, (err) => {
        if (err) return next(err);
        const { password, ...userWithoutPassword } = user;
        res.status(201).json(userWithoutPassword);
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      next(err);
    }
  });

  app.post(api.auth.login.path, (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: info?.message || "Invalid credentials" });
      req.login(user, (err: any) => {
        if (err) return next(err);
        const { password, ...userWithoutPassword } = user;
        res.status(200).json(userWithoutPassword);
      });
    })(req, res, next);
  });

  app.post(api.auth.logout.path, (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.status(200).json({ message: "Logged out" });
    });
  });

  app.get(api.auth.me.path, (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { password, ...userWithoutPassword } = req.user as any;
    res.status(200).json(userWithoutPassword);
  });

  // PRODUCTS
  app.get(api.products.list.path, async (req, res) => {
    try {
      const { search, category, minPrice, maxPrice } = req.query;
      const products = await storage.getProducts(
        search as string,
        category as string,
        minPrice ? Number(minPrice) : undefined,
        maxPrice ? Number(maxPrice) : undefined
      );
      res.json(products);
    } catch (e) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.products.get.path, async (req, res) => {
    const product = await storage.getProduct(Number(req.params.id));
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  });

  app.post(api.products.create.path, requireAdmin, async (req, res) => {
    try {
      const input = api.products.create.input.parse(req.body);
      const product = await storage.createProduct(input);
      res.status(201).json(product);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Error" });
    }
  });

  app.put(api.products.update.path, requireAdmin, async (req, res) => {
    try {
      const input = api.products.update.input.parse(req.body);
      const product = await storage.updateProduct(Number(req.params.id), input);
      if (!product) return res.status(404).json({ message: "Not found" });
      res.json(product);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Error" });
    }
  });

  app.delete(api.products.delete.path, requireAdmin, async (req, res) => {
    const success = await storage.deleteProduct(Number(req.params.id));
    if (!success) return res.status(404).json({ message: "Not found" });
    res.status(204).end();
  });

  // COUPONS
  app.get(api.coupons.list.path, requireAdmin, async (req, res) => {
    const coupons = await storage.getCoupons();
    res.json(coupons);
  });

  app.post(api.coupons.create.path, requireAdmin, async (req, res) => {
    try {
      const input = api.coupons.create.input.parse(req.body);
      const coupon = await storage.createCoupon(input);
      res.status(201).json(coupon);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Error" });
    }
  });

  app.put(api.coupons.update.path, requireAdmin, async (req, res) => {
    try {
      const input = api.coupons.update.input.parse(req.body);
      const coupon = await storage.updateCoupon(Number(req.params.id), input);
      if (!coupon) return res.status(404).json({ message: "Not found" });
      res.json(coupon);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Error" });
    }
  });

  app.delete(api.coupons.delete.path, requireAdmin, async (req, res) => {
    const success = await storage.deleteCoupon(Number(req.params.id));
    if (!success) return res.status(404).json({ message: "Not found" });
    res.status(204).end();
  });

  app.post(api.coupons.validate.path, async (req, res) => {
    try {
      const { code } = api.coupons.validate.input.parse(req.body);
      const coupon = await storage.getCouponByCode(code);
      
      if (!coupon || !coupon.isActive) {
        return res.json({ valid: false, message: "Coupon is invalid or inactive" });
      }
      
      if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
        return res.json({ valid: false, message: "Coupon has expired" });
      }
      
      if (coupon.usageLimit > 0 && coupon.usageCount >= coupon.usageLimit) {
        return res.json({ valid: false, message: "Coupon usage limit reached" });
      }
      
      res.json({ valid: true, coupon });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Error" });
    }
  });

  // ORDERS
  app.get(api.orders.list.path, requireAuth, async (req, res) => {
    const orders = await storage.getOrders((req.user as any).id);
    res.json(orders);
  });

  app.get(api.orders.listAll.path, requireAdmin, async (req, res) => {
    const orders = await storage.getOrders();
    res.json(orders);
  });

  app.post(api.orders.create.path, requireAuth, async (req, res) => {
    try {
      const { items, couponCode } = api.orders.create.input.parse(req.body);
      
      // Calculate total
      let totalAmount = 0;
      const orderItems = [];
      
      for (const item of items) {
        const product = await storage.getProduct(item.productId);
        if (!product) return res.status(400).json({ message: `Product ${item.productId} not found` });
        if (product.stock < item.quantity) return res.status(400).json({ message: `Not enough stock for ${product.name}` });
        
        const itemTotal = product.price * item.quantity;
        totalAmount += itemTotal;
        
        orderItems.push({
          productId: product.id,
          quantity: item.quantity,
          priceAtTime: product.price
        });
      }
      
      // Apply coupon
      if (couponCode) {
        const coupon = await storage.getCouponByCode(couponCode);
        if (coupon && coupon.isActive && 
           (!coupon.expiresAt || new Date(coupon.expiresAt) > new Date()) &&
           (coupon.usageLimit === 0 || coupon.usageCount < coupon.usageLimit)) {
             
          if (coupon.discountType === 'percent') {
            totalAmount = Math.floor(totalAmount * (1 - coupon.discountValue / 100));
          } else {
            totalAmount = Math.max(0, totalAmount - coupon.discountValue);
          }
          await storage.incrementCouponUsage(coupon.id);
        }
      }
      
      const order = await storage.createOrder({
        userId: (req.user as any).id,
        totalAmount,
        couponCode,
        status: 'pending'
      }, orderItems);
      
      res.status(201).json(order);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Error" });
    }
  });

  app.patch(api.orders.updateStatus.path, requireAdmin, async (req, res) => {
    try {
      const { status } = api.orders.updateStatus.input.parse(req.body);
      const order = await storage.updateOrderStatus(Number(req.params.id), status);
      if (!order) return res.status(404).json({ message: "Not found" });
      res.json(order);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Error" });
    }
  });

  // WISHLIST
  app.get(api.wishlist.list.path, requireAuth, async (req, res) => {
    const items = await storage.getWishlist((req.user as any).id);
    res.json(items);
  });

  app.post(api.wishlist.toggle.path, requireAuth, async (req, res) => {
    try {
      const { productId } = api.wishlist.toggle.input.parse(req.body);
      const added = await storage.toggleWishlistItem((req.user as any).id, productId);
      res.json({ added });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Error" });
    }
  });

  // ANALYTICS
  app.get(api.analytics.get.path, requireAdmin, async (req, res) => {
    const data = await storage.getAnalytics();
    res.json(data);
  });

  return httpServer;
}
