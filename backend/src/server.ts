
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import crypto from 'node:crypto';

const app = express();
const prisma = new PrismaClient();
const port = Number(process.env.PORT || 4000);

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  }),
);
app.use(express.json({ limit: '1mb' }));

// Proteksi endpoint admin menggunakan API key.
const requireAdmin = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  const expected = process.env.ADMIN_API_KEY;

  if (!expected || req.header('x-admin-key') !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
};

// Status API.
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'otk-api',
    paymentMode: 'manual-selection-only',
  });
});

// Login admin.
app.post('/api/admin/login', (req, res) => {
  const email = String(req.body?.email || '');
  const password = String(req.body?.password || '');

  const expectedEmail = process.env.ADMIN_EMAIL || 'admin@otk.local';
  const expectedPassword = process.env.ADMIN_PASSWORD;
  const adminKey = process.env.ADMIN_API_KEY;

  if (!expectedPassword || !adminKey) {
    return res.status(503).json({
      error:
        'Konfigurasi ADMIN_PASSWORD dan ADMIN_API_KEY belum diisi di backend/.env.',
    });
  }

  if (email !== expectedEmail || password !== expectedPassword) {
    return res.status(401).json({
      error: 'Email atau password admin salah.',
    });
  }

  return res.json({ ok: true, adminKey });
});

// Katalog produk aktif.
app.get('/api/products', async (_req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json(products);
  } catch (err) {
    console.error('Get products error:', err);
    res.status(500).json({ error: 'Gagal mengambil katalog' });
  }
});

// Daftar produk untuk admin.
app.get('/api/admin/products', requireAdmin, async (_req, res) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
    });

    res.json(products);
  } catch (err) {
    console.error('Get admin products error:', err);
    res.status(500).json({ error: 'Gagal mengambil katalog' });
  }
});

// Daftar pesanan untuk admin.
app.get('/api/admin/orders', requireAdmin, async (_req, res) => {
  try {
    const orders = await prisma.order.findMany({
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json(orders);
  } catch (err) {
    console.error('Get orders error:', err);
    res.status(500).json({
      error: 'Gagal mengambil daftar pesanan',
    });
  }
});


app.put(
  '/api/admin/orders/:orderNumber/status',
  requireAdmin,
  async (req, res) => {
    const allowedStatuses = [
      'Menunggu konfirmasi',
      'Diproses',
      'Siap Diambil',
      'Dalam Pengantaran',
      'Selesai',
      'Dibatalkan',
    ];

    const status = req.body?.status;

    if (
      typeof status !== 'string' ||
      !allowedStatuses.includes(status)
    ) {
      return res.status(400).json({
        error: 'Status pesanan tidak valid.',
      });
    }

    try {
      const order = await prisma.order.update({
        where: {
          orderNumber: req.params.orderNumber,
        },
        data: {
          status,
        },
      });

      return res.json({
        ok: true,
        orderNumber: order.orderNumber,
        status: order.status,
      });
    } catch (err) {
      console.error('Update order status error:', err);

      return res.status(404).json({
        error: 'Pesanan tidak ditemukan atau status gagal disimpan.',
      });
    }
  },
);

// Validasi produk admin.
// Stok tidak wajib diisi karena OTK tidak menggunakan fitur stok.
const productSchema = z.object({
  name: z.string().min(2),
  category: z.string().min(2),
  price: z.number().int().positive(),
  description: z.string().min(2),
  image: z.string().url(),
  active: z.boolean().optional(),
});

// Tambah produk.
app.post('/api/admin/products', requireAdmin, async (req, res) => {
  const parsed = productSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Data produk tidak valid',
    });
  }

  try {
    const product = await prisma.product.create({
      data: parsed.data,
    });

    res.status(201).json(product);
  } catch (err) {
    console.error('Create product error:', err);
    res.status(500).json({
      error: 'Gagal menyimpan produk',
    });
  }
});

// Edit produk.
app.put('/api/admin/products/:id', requireAdmin, async (req, res) => {
  const parsed = productSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Data produk tidak valid',
    });
  }

  try {
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: parsed.data,
    });

    res.json(product);
  } catch (err) {
    console.error('Update product error:', err);
    res.status(404).json({
      error: 'Produk tidak ditemukan',
    });
  }
});

// Hapus produk.
app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
  try {
    await prisma.product.delete({
      where: { id: req.params.id },
    });

    res.status(204).end();
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(404).json({
      error: 'Produk tidak ditemukan',
    });
  }
});

// Validasi data checkout.
const checkoutSchema = z.object({
  customer: z.object({
    name: z.string().min(2),
    phone: z.string().min(8),
    email: z.string().email().optional().or(z.literal('')),
    fulfillment: z.string(),
    address: z.string().optional(),
    note: z.string().optional(),
  }),

  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1).max(50),
      }),
    )
    .min(1),

  paymentMethod: z.enum([
    'Tunai',
    'Transfer Bank',
    'QRIS',
    'DANA',
    'GoPay',
    'OVO',
    'ShopeePay',
  ]),
});

// Checkout pembayaran manual.
// Tidak memeriksa atau mengurangi stok dan tidak memanggil Midtrans.
app.post('/api/orders/create', async (req, res) => {
  const parsed = checkoutSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error:
        'Data checkout tidak valid. Periksa data pelanggan, produk, jumlah, dan metode pembayaran.',
      details: parsed.error.flatten(),
    });
  }

  const { customer, items, paymentMethod } = parsed.data;

  if (
    customer.fulfillment === 'Diantar' &&
    !customer.address?.trim()
  ) {
    return res.status(400).json({
      error: 'Alamat pengantaran wajib diisi.',
    });
  }

  try {
    // Ambil produk aktif yang dipilih pelanggan.
    const ids = [...new Set(items.map((item) => item.productId))];

    const products = await prisma.product.findMany({
      where: {
        id: { in: ids },
        active: true,
      },
    });

    
const byId = new Map<string, (typeof products)[number]>();

for (const product of products) {
  byId.set(product.id, product);
}

let total = 0;

const orderItems: {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}[] = [];

for (const item of items) {
  const product = byId.get(item.productId);

  // Produk harus tersedia dan aktif.
  if (!product) {
    return res.status(400).json({
      error: 'Ada produk yang tidak tersedia.',
    });
  }

  total += product.price * item.quantity;

  orderItems.push({
    productId: product.id,
    name: product.name,
    price: product.price,
    quantity: item.quantity,
  });
}


    const orderNumber = `OTK-${Date.now()}-${crypto
      .randomBytes(2)
      .toString('hex')
      .toUpperCase()}`;

    // Simpan pesanan dan detailnya ke MySQL.
    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerName: customer.name,
        customerPhone: customer.phone,
        customerEmail: customer.email || null,
        fulfillment: customer.fulfillment,
        address: customer.address || null,
        note: customer.note || null,
        total,
        status: 'MENUNGGU_KONFIRMASI',
        paymentStatus: 'BELUM_DIBAYAR',
        paymentMethod,
        items: {
          create: orderItems,
        },
      },
      include: {
        items: true,
      },
    });

    return res.status(201).json({
      ok: true,
      message: 'Pesanan berhasil disimpan.',
      order,
    });
  } catch (err) {
    console.error('Create order error:', err);

    return res.status(500).json({
      error:
        'Gagal menyimpan pesanan ke database. Periksa koneksi backend dan skema MySQL.',
    });
  }
});

// Cari pesanan berdasarkan nomor pesanan.
app.get('/api/orders/:orderNumber', async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { orderNumber: req.params.orderNumber },
      include: { items: true },
    });

    if (!order) {
      return res.status(404).json({
        error: 'Pesanan tidak ditemukan',
      });
    }

    res.json(order);
  } catch (err) {
    console.error('Get order error:', err);

    res.status(500).json({
      error: 'Gagal mengambil pesanan',
    });
  }
});

app.listen(port, () => {
  console.log(`OTK API listening on ${port}`);
});
