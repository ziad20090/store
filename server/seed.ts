import { db } from "./db";
import { users, products, coupons } from "@shared/schema";
import { setupAuth } from "./auth";
import express from "express";

const app = express();
const { hashPassword } = setupAuth(app);

async function seed() {
  console.log("Seeding database...");
  
  // Seed admin user
  const existingUsers = await db.select().from(users);
  if (existingUsers.length === 0) {
    const hashed = await hashPassword("admin123");
    await db.insert(users).values({
      username: "admin",
      password: hashed,
      role: "admin",
    });
    console.log("Created admin user (admin / admin123)");
  }

  // Seed products
  const existingProducts = await db.select().from(products);
  if (existingProducts.length === 0) {
    const sampleProducts = [
      {
        name: "ساعة ذكية فاخرة",
        description: "ساعة ذكية مع شاشة أموليد ومراقبة نبضات القلب والنشاط الرياضي.",
        price: 49900, // 499.00
        stock: 50,
        category: "إلكترونيات",
        imageUrl: "https://images.unsplash.com/photo-1546868871-7041f2a55e12?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
        tags: ["ساعة", "ذكية", "إلكترونيات"],
      },
      {
        name: "سماعات رأس لاسلكية",
        description: "سماعات رأس مزودة بعزل الضوضاء النشط وصوت محيطي عالي الجودة.",
        price: 89900, // 899.00
        stock: 30,
        category: "إلكترونيات",
        imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
        tags: ["سماعات", "صوتيات"],
      },
      {
        name: "عطر فرنسي راقي",
        description: "عطر رجالي بمزيج من روائح الأخشاب والتوابل يدوم طويلاً.",
        price: 35000, // 350.00
        stock: 100,
        category: "عطور",
        imageUrl: "https://images.unsplash.com/photo-1523293182086-7651a899d37f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
        tags: ["عطور", "رجالي"],
      },
      {
        name: "حقيبة ظهر جلدية",
        description: "حقيبة ظهر مصنوعة من الجلد الطبيعي تناسب الكمبيوتر المحمول والأغراض اليومية.",
        price: 25000,
        stock: 20,
        category: "أزياء",
        imageUrl: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
        tags: ["حقائب", "أزياء"],
      },
      {
        name: "حذاء رياضي مريح",
        description: "حذاء مثالي للجري والمشي لمسافات طويلة بتصميم عصري وألوان جذابة.",
        price: 42000,
        stock: 40,
        category: "أحذية",
        imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
        tags: ["أحذية", "رياضة"],
      }
    ];
    
    await db.insert(products).values(sampleProducts);
    console.log("Created sample products");
  }

  // Seed coupons
  const existingCoupons = await db.select().from(coupons);
  if (existingCoupons.length === 0) {
    await db.insert(coupons).values({
      code: "WELCOME20",
      discountType: "percent",
      discountValue: 20, // 20%
      usageLimit: 100,
      isActive: true,
    });
    await db.insert(coupons).values({
      code: "SAVE50",
      discountType: "fixed",
      discountValue: 5000, // 50.00
      usageLimit: 50,
      isActive: true,
    });
    console.log("Created sample coupons (WELCOME20, SAVE50)");
  }

  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
