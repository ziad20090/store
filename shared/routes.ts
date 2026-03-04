import { z } from 'zod';
import { 
  insertUserSchema, insertProductSchema, insertCouponSchema,
  products, coupons, orders, orderItems, wishlist
} from './schema';

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  notFound: z.object({ message: z.string() }),
  unauthorized: z.object({ message: z.string() }),
  forbidden: z.object({ message: z.string() }),
  internal: z.object({ message: z.string() }),
};

const userSchema = z.object({
  id: z.number(),
  username: z.string(),
  role: z.string(),
  createdAt: z.any(),
});

const productSchema = z.custom<typeof products.$inferSelect>();
const couponSchema = z.custom<typeof coupons.$inferSelect>();
const orderSchema = z.custom<typeof orders.$inferSelect>();
const orderItemSchema = z.custom<typeof orderItems.$inferSelect>();
const wishlistSchema = z.custom<typeof wishlist.$inferSelect>();

export const api = {
  auth: {
    register: {
      method: 'POST' as const,
      path: '/api/auth/register' as const,
      input: insertUserSchema,
      responses: {
        201: userSchema,
        400: errorSchemas.validation,
      },
    },
    login: {
      method: 'POST' as const,
      path: '/api/auth/login' as const,
      input: insertUserSchema,
      responses: {
        200: userSchema,
        401: errorSchemas.unauthorized,
      },
    },
    logout: {
      method: 'POST' as const,
      path: '/api/auth/logout' as const,
      responses: {
        200: z.object({ message: z.string() }),
      },
    },
    me: {
      method: 'GET' as const,
      path: '/api/auth/me' as const,
      responses: {
        200: userSchema,
        401: errorSchemas.unauthorized,
      },
    },
  },
  products: {
    list: {
      method: 'GET' as const,
      path: '/api/products' as const,
      input: z.object({
        search: z.string().optional(),
        category: z.string().optional(),
        minPrice: z.string().optional(),
        maxPrice: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(productSchema),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/products/:id' as const,
      responses: {
        200: productSchema,
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/products' as const,
      input: insertProductSchema,
      responses: {
        201: productSchema,
        401: errorSchemas.unauthorized,
        403: errorSchemas.forbidden,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/products/:id' as const,
      input: insertProductSchema.partial(),
      responses: {
        200: productSchema,
        401: errorSchemas.unauthorized,
        403: errorSchemas.forbidden,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/products/:id' as const,
      responses: {
        204: z.void(),
        401: errorSchemas.unauthorized,
        403: errorSchemas.forbidden,
        404: errorSchemas.notFound,
      },
    },
  },
  coupons: {
    list: {
      method: 'GET' as const,
      path: '/api/coupons' as const,
      responses: {
        200: z.array(couponSchema),
        401: errorSchemas.unauthorized,
        403: errorSchemas.forbidden,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/coupons' as const,
      input: insertCouponSchema,
      responses: {
        201: couponSchema,
        401: errorSchemas.unauthorized,
        403: errorSchemas.forbidden,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/coupons/:id' as const,
      input: insertCouponSchema.partial(),
      responses: {
        200: couponSchema,
        401: errorSchemas.unauthorized,
        403: errorSchemas.forbidden,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/coupons/:id' as const,
      responses: {
        204: z.void(),
        401: errorSchemas.unauthorized,
        403: errorSchemas.forbidden,
        404: errorSchemas.notFound,
      },
    },
    validate: {
      method: 'POST' as const,
      path: '/api/coupons/validate' as const,
      input: z.object({ code: z.string() }),
      responses: {
        200: z.object({
          valid: z.boolean(),
          coupon: couponSchema.optional(),
          message: z.string().optional(),
        }),
      },
    },
  },
  orders: {
    list: {
      method: 'GET' as const,
      path: '/api/orders' as const,
      responses: {
        200: z.array(orderSchema.and(z.object({ items: z.array(orderItemSchema.and(z.object({ product: productSchema }))) }))),
        401: errorSchemas.unauthorized,
      },
    },
    listAll: {
      method: 'GET' as const,
      path: '/api/admin/orders' as const,
      responses: {
        200: z.array(orderSchema.and(z.object({ items: z.array(orderItemSchema.and(z.object({ product: productSchema }))) }))),
        401: errorSchemas.unauthorized,
        403: errorSchemas.forbidden,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/orders' as const,
      input: z.object({
        items: z.array(z.object({
          productId: z.number(),
          quantity: z.number(),
        })),
        couponCode: z.string().optional(),
      }),
      responses: {
        201: orderSchema,
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
    updateStatus: {
      method: 'PATCH' as const,
      path: '/api/orders/:id/status' as const,
      input: z.object({ status: z.string() }),
      responses: {
        200: orderSchema,
        401: errorSchemas.unauthorized,
        403: errorSchemas.forbidden,
        404: errorSchemas.notFound,
      },
    }
  },
  wishlist: {
    list: {
      method: 'GET' as const,
      path: '/api/wishlist' as const,
      responses: {
        200: z.array(wishlistSchema.and(z.object({ product: productSchema }))),
        401: errorSchemas.unauthorized,
      },
    },
    toggle: {
      method: 'POST' as const,
      path: '/api/wishlist/toggle' as const,
      input: z.object({ productId: z.number() }),
      responses: {
        200: z.object({ added: z.boolean() }),
        401: errorSchemas.unauthorized,
      },
    },
  },
  analytics: {
    get: {
      method: 'GET' as const,
      path: '/api/admin/analytics' as const,
      responses: {
        200: z.object({
          totalSales: z.number(),
          totalOrders: z.number(),
          totalUsers: z.number(),
          lowStockProducts: z.array(productSchema),
        }),
        401: errorSchemas.unauthorized,
        403: errorSchemas.forbidden,
      }
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
