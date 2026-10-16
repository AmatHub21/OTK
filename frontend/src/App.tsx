import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowRight, BadgeCheck, ChevronDown, Clock3, Coffee, Heart, Menu as MenuIcon, Minus, Plus, Search, ShieldCheck, ShoppingBag, ShoppingCart, Soup, Sparkles, Trash2, Truck, X } from 'lucide-react';
import { initialProducts, Product, CartItem, Order, rupiah } from './data';

const read = <T,>(key:string, fallback:T):T => { try { const raw=localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; } };
const save = (key:string, value:unknown) => localStorage.setItem(key,JSON.stringify(value));
const categories = ['Semua','Makanan Berat','Camilan','Minuman'];

export default function App() {
 const [products,setProducts] = useState<Product[]>(()=>read('otk_products',initialProducts));
 const [cart,setCart] = useState<CartItem[]>(()=>read('otk_cart',[]));
 const [orders,setOrders] = useState<Order[]>(()=>read('otk_orders',[]));
 const [page,setPage] = useState<'home'|'menu'|'cart'|'checkout'|'admin'|'login'>('home');
 const [category,setCategory] = useState('Semua');
 const [search,setSearch] = useState('');
 const [toast,setToast] = useState('');
 const [admin,setAdmin] = useState(false);
 const [adminApiKey,setAdminApiKey] = useState<string>(()=>localStorage.getItem('otk_admin_api_key')||'');
 const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
 const [showMobileNav,setShowMobileNav] = useState(false);
 const [showLogin,setShowLogin] = useState(false);
 const [editing,setEditing] = useState<Product|null>(null);
 const [customer,setCustomer] = useState({name:'',phone:'',email:'',fulfillment:'Ambil di kantin',address:'',note:''});
 const [paymentMethod,setPaymentMethod] = useState('Tunai');
 const [busy,setBusy] = useState(false);  
 const location = useLocation();
 useEffect(()=>{ save('otk_products',products); },[products]);
 useEffect(()=>{ let cancelled=false; fetch(`${API_URL}/api/products`).then(r=>{if(!r.ok)throw new Error('API katalog tidak tersedia');return r.json();}).then((data:Product[])=>{if(!cancelled&&Array.isArray(data))setProducts(data);}).catch(()=>{/* Gunakan katalog lokal saat backend belum berjalan. */}); return()=>{cancelled=true;}; },[]);
 useEffect(()=>{ save('otk_cart',cart); },[cart]);
 useEffect(()=>{ save('otk_orders',orders); },[orders]);
 useEffect(()=>{ if(toast){const t=setTimeout(()=>setToast(''),2800);return()=>clearTimeout(t)} },[toast]);
 useEffect(()=>{ const params=new URLSearchParams(location.search); if(params.get('payment')==='pending')setToast('Pembayaran sedang diproses. Status final menunggu konfirmasi server.'); },[location.search]);
 const cartCount=cart.reduce((n,i)=>n+i.quantity,0);
 const subtotal=cart.reduce((n,i)=>n+(products.find(p=>p.id===i.productId)?.price||0)*i.quantity,0);
 const filtered=useMemo(()=>products.filter(p=>p.active&&(category==='Semua'||p.category===category)&&p.name.toLowerCase().includes(search.toLowerCase())),[products,category,search]);
 const go=(p:typeof page)=>{setPage(p);setShowMobileNav(false);window.scrollTo({top:0,behavior:'smooth'});};
 const add=(p:Product)=>{setCart(old=>{const found=old.find(i=>i.productId===p.id);if(found&&found.quantity>=50){setToast('Maksimal 50 item untuk satu produk.');return old;}return found?old.map(i=>i.productId===p.id?{...i,quantity:i.quantity+1}:i):[...old,{productId:p.id,quantity:1}];});setToast(`${p.name} ditambahkan ke keranjang`);};
 const updateQty=(id:string,delta:number)=>setCart(old=>old.map(i=>i.productId===id?{...i,quantity:Math.max(1,Math.min(50,i.quantity+delta))}:i));
 const remove=(id:string)=>setCart(old=>old.filter(i=>i.productId!==id));
 

const checkout = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!cart.length) {
    setToast('Keranjang masih kosong.');
    return;
  }

  if (
    customer.fulfillment === 'Diantar' &&
    !customer.address.trim()
  ) {
    setToast('Alamat pengantaran wajib diisi.');
    return;
  }

  // Simpan data keranjang sebelum dikosongkan.
  const cartSnapshot = [...cart];
  const customerSnapshot = { ...customer };
  const paymentSnapshot = paymentMethod;
  const totalSnapshot = cartSnapshot.reduce((sum, item) => {
    const product = products.find(p => p.id === item.productId);
    return sum + (product?.price || 0) * item.quantity;
  }, 0);

  // Membuka tab saat tombol masih diklik pengguna.
  const waWindow = window.open('about:blank', '_blank');
  setBusy(true);

  try {
    const response = await fetch(`${API_URL}/api/orders/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: customerSnapshot,
        items: cartSnapshot.map(i => ({
          productId: i.productId,
          quantity: i.quantity,
        })),
        paymentMethod: paymentSnapshot,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Gagal menyimpan pesanan.');
    }

    // Mendukung respons berbentuk { order: {...} } atau {...}.
    const saved = result.order ?? result;

    // Ambil detail produk dari respons server atau keranjang.
    const orderItems = Array.isArray(saved.items) && saved.items.length
      ? saved.items.map((i: any) => ({
          name: i.name,
          quantity: Number(i.quantity),
          price: Number(i.price),
        }))
      : cartSnapshot.map(i => {
          const p = products.find(x => x.id === i.productId);
          return {
            name: p?.name || 'Produk',
            quantity: i.quantity,
            price: p?.price || 0,
          };
        });

    const orderNumber = saved.orderNumber ?? saved.id ?? 'Belum tersedia';
    const name = saved.customerName ?? customerSnapshot.name;
    const phone = saved.customerPhone ?? customerSnapshot.phone;
    const email = saved.customerEmail ?? customerSnapshot.email;
    const fulfillment = saved.fulfillment ?? customerSnapshot.fulfillment;
    const address = saved.address ?? customerSnapshot.address;
    const note = saved.note ?? customerSnapshot.note;
    const payment = saved.paymentMethod ?? paymentSnapshot;
    const total = Number.isFinite(Number(saved.total))
      ? Number(saved.total)
      : totalSnapshot;
    const status = saved.status ?? 'MENUNGGU_KONFIRMASI';

    const message = [
      '*PESANAN BARU - OTK OTEWE KANTIN*',
      '',
      `No. Pesanan: ${orderNumber}`,
      `Nama: ${name}`,
      `No. HP: ${phone}`,
      `Email: ${email || '-'}`,
      '',
      '*Detail Pesanan:*',
      ...orderItems.map(
        (i: { name: string; quantity: number; price: number }) =>
          `- ${i.name} x${i.quantity} = ${rupiah(i.price * i.quantity)}`
      ),
      '',
      `Total: ${rupiah(total)}`,
      `Metode Pembayaran: ${payment}`,
      `Metode Pemenuhan: ${fulfillment}`,
      ...(fulfillment === 'Diantar' ? [`Alamat Pengantaran: ${address || '-'}`] : []),
      `Catatan Pesanan: ${note || '-'}`,
      `Status: ${status}`,
    ].join('\n');

    const waUrl =
      `https://wa.me/6285772354593?text=${encodeURIComponent(message)}`;

    if (waWindow) {
      waWindow.location.href = waUrl;
    } else {
      window.location.href = waUrl;
    }

    const order: Order = {
      id: String(orderNumber),
      customer: String(name),
      phone: String(phone),
      fulfillment: String(fulfillment),
      address: String(address || ''),
      items: orderItems,
      total,
      status: String(status),
      paymentStatus: saved.paymentStatus ?? 'BELUM_DIBAYAR',
      paymentMethod: String(payment),
      createdAt: saved.createdAt ?? new Date().toISOString(),
    };

    setOrders(old => [order, ...old.filter(o => o.id !== order.id)]);
    setCart([]);
    setToast(`Pesanan ${orderNumber} berhasil disimpan.`);
    go('home');
  } catch (err) {
    if (waWindow && !waWindow.closed) waWindow.close();

    setToast(
      err instanceof Error
        ? err.message
        : 'Backend tidak dapat dihubungi. Pesanan belum tersimpan.'
    );
  } finally {
    setBusy(false);
  }
};


 const login=async(e:React.FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget);const email=String(f.get('email')||'');const password=String(f.get('password')||'');try{const response=await fetch(`${API_URL}/api/admin/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Login admin gagal.');localStorage.setItem('otk_admin_api_key',data.adminKey);setAdminApiKey(data.adminKey);setAdmin(true);setShowLogin(false);const catalog=await fetch(`${API_URL}/api/admin/products`,{headers:{'x-admin-key':data.adminKey}});if(catalog.ok){const rows:Product[]=await catalog.json();setProducts(rows);}const orderResponse=await fetch(`${API_URL}/api/admin/orders`,{headers:{'x-admin-key':data.adminKey}});if(orderResponse.ok){const rows=await orderResponse.json();setOrders(rows.map((o:any)=>({id:o.orderNumber,customer:o.customerName,phone:o.customerPhone,fulfillment:o.fulfillment,address:o.address||'',items:(o.items||[]).map((i:any)=>({name:i.name,quantity:i.quantity,price:i.price})),total:o.total,status:o.status,paymentStatus:o.paymentStatus,paymentMethod:o.paymentMethod,createdAt:o.createdAt})));}go('admin');setToast('Login berhasil. Katalog dan pesanan terhubung ke database.');}catch(err){setToast(err instanceof Error?err.message:'Backend tidak dapat dihubungi.');}};
 const saveProduct=async(e:React.FormEvent<HTMLFormElement>)=>{e.preventDefault();if(!adminApiKey){setToast('Login admin terlebih dahulu agar produk tersimpan ke database.');setShowLogin(true);return;}const f=new FormData(e.currentTarget);const p={name:String(f.get('name')),category:String(f.get('category')),price:Number(f.get('price')),description:String(f.get('description')),image:String(f.get('image'))||'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=85',active:editing?.active??true};try{const response=await fetch(`${API_URL}/api/admin/products${editing?.id?`/${encodeURIComponent(editing.id)}`:''}`,{method:editing?.id?'PUT':'POST',headers:{'Content-Type':'application/json','x-admin-key':adminApiKey},body:JSON.stringify(p)});const data=await response.json();if(!response.ok)throw new Error(data.error||'Gagal menyimpan produk.');setProducts(old=>editing?old.map(x=>x.id===editing.id?data:x):[data,...old]);setEditing(null);setToast('Produk berhasil disimpan ke database MySQL.');}catch(err){setToast(err instanceof Error?err.message:'Tidak dapat menyimpan produk.');}};
 const deleteProduct=async(p:Product)=>{if(!adminApiKey){setToast('Login admin terlebih dahulu.');setShowLogin(true);return;}if(!confirm(`Hapus ${p.name}?`))return;try{const response=await fetch(`${API_URL}/api/admin/products/${encodeURIComponent(p.id)}`,{method:'DELETE',headers:{'x-admin-key':adminApiKey}});if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.error||'Gagal menghapus produk.');}setProducts(old=>old.filter(x=>x.id!==p.id));setToast('Produk dihapus dari database.');}catch(err){setToast(err instanceof Error?err.message:'Gagal menghapus produk.');}};
 const updateOrderStatus = async (
    orderNumber: string,
    status: string,
  ) => {
    if (!adminApiKey) {
      setToast('Silakan login admin terlebih dahulu.');
      setShowLogin(true);
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/api/admin/orders/${encodeURIComponent(orderNumber)}/status`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-key': adminApiKey,
          },
          body: JSON.stringify({ status }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || 'Gagal memperbarui status pesanan.',
        );
      }

      setOrders((old) =>
        old.map((order) =>
          order.id === orderNumber
            ? { ...order, status: data.status }
            : order,
        ),
      );

      setToast('Status pesanan berhasil disimpan ke database.');
    } catch (err) {
      setToast(
        err instanceof Error
          ? err.message
          : 'Backend tidak dapat dihubungi.',
      );
    }
  };
 const ProductCard=({p}:{p:Product})=><article className="product-card"><div className="product-image"><img src={p.image} alt={p.name} loading="lazy"/>{p.popular&&<span className="popular-tag"><Sparkles size={12}/> Favorit</span>}<button className="heart-btn" aria-label="Favorit"><Heart size={17}/></button></div><div className="product-info"><span className="eyebrow">{p.category}</span><h3>{p.name}</h3><p>{p.description}</p><div className="product-bottom"><strong>{rupiah(p.price)}</strong><button className="add-btn" onClick={()=>add(p)} aria-label={`Tambah ${p.name}`}><Plus size={18}/></button></div></div></article>;
 return <div className="app-shell">
  <div className="top-strip"><span><Sparkles size={14}/> Rasa enak, pesan lebih praktis!</span><span className="top-right"><Clock3 size={14}/> Jam kantin mengikuti jadwal operasional</span></div>
  <header className="navbar"><button className="brand" onClick={()=>go('home')}><img src="/logo-otk.png" alt="OTK Otewe Kantin"/></button><nav className={showMobileNav?'nav-links open':'nav-links'}><button className={page==='home'?'active':''} onClick={()=>go('home')}>Beranda</button><button className={page==='menu'?'active':''} onClick={()=>go('menu')}>Menu</button><a href="#tentang" onClick={()=>{go('home');setTimeout(()=>document.getElementById('tentang')?.scrollIntoView({behavior:'smooth'}),100)}}>Tentang</a><button onClick={()=>go('admin')}>Admin</button></nav><div className="nav-actions"><button className="cart-nav" onClick={()=>go('cart')}><ShoppingCart size={19}/><span>Keranjang</span>{cartCount>0&&<b>{cartCount}</b>}</button><button className="login-btn" onClick={()=>setShowLogin(true)}>Masuk <ArrowRight size={16}/></button><button className="mobile-toggle" onClick={()=>setShowMobileNav(!showMobileNav)} aria-label="Buka menu">{showMobileNav?<X/>:<MenuIcon/>}</button></div></header>
  <main>
  {page==='home'&&<><section className="hero"><div className="hero-copy"><div className="hero-pill"><span className="live-dot"/> TEMAN MAKAN HARIANMU</div><h1>Lapar? <span>Otewe</span><br/>Pesan di OTK!</h1><p>Menu favorit kantin, tinggal pilih dan pesan. Praktis buat nemenin hari produktifmu.</p><div className="hero-buttons"><button className="primary-btn" onClick={()=>go('menu')}>Jelajahi Menu <ArrowRight size={18}/></button><button className="text-btn" onClick={()=>document.getElementById('cara-pesan')?.scrollIntoView({behavior:'smooth'})}>Cara pesan <ChevronDown size={17}/></button></div><div className="hero-trust"><div className="trust-avatars"><span>🍜</span><span>🍱</span><span>🧋</span></div><div><strong>Menu pilihan setiap hari</strong><small>Pesan mudah, makan lebih happy</small></div></div></div><div className="hero-art"><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><div className="hero-food hero-food-main"><img src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1000&q=90" alt="Bowl makanan segar"/></div><div className="floating-note note-one"><span>🍊</span><div><b>Fresh & tasty</b><small>Selalu bikin happy</small></div></div><div className="floating-note note-two"><span>🛵</span><div><b>Otewe!</b><small>Pesan tanpa ribet</small></div></div><div className="hero-spark spark-a">✦</div><div className="hero-spark spark-b">✳</div></div></section>
   <section className="benefits"><div><span className="benefit-icon"><Truck/></span><div><b>Praktis & fleksibel</b><small>Pilih ambil atau diantar</small></div></div><div><span className="benefit-icon"><ShieldCheck/></span><div><b>Checkout jelas</b><small>Ringkasan sebelum pesan</small></div></div><div><span className="benefit-icon"><Coffee/></span><div><b>Menu beragam</b><small>Makanan dan minuman favorit</small></div></div></section>
   <section className="section menu-section"><div className="section-heading"><div><span className="section-kicker">PILIHAN BUAT KAMU</span><h2>Menu yang bikin <span>ngiler.</span></h2><p>Temukan teman terbaik untuk mengisi energi harianmu.</p></div><button className="outline-btn" onClick={()=>go('menu')}>Lihat semua menu <ArrowRight size={16}/></button></div><div className="category-row">{categories.slice(1).map((c,i)=><button key={c} className="category-chip" onClick={()=>{setCategory(c);go('menu')}}>{[<Soup size={17}/> ,<Coffee size={17}/> ,<Sparkles size={17}/>][i]} {c}</button>)}</div><div className="product-grid">{products.filter(p=>p.active).slice(0,4).map(p=><ProductCard key={p.id} p={p}/>)}</div></section>
   <section id="cara-pesan" className="how-section"><div className="section-heading centered"><div><span className="section-kicker">GAMPANG BANGET</span><h2>Tiga langkah, <span>beres.</span></h2><p>Nggak perlu antre lama buat pilih menu favoritmu.</p></div></div><div className="steps-grid"><div className="step-card"><span className="step-number">01</span><div className="step-emoji">🔎</div><h3>Pilih menu</h3><p>Jelajahi pilihan makanan dan minuman yang tersedia.</p></div><div className="step-card"><span className="step-number">02</span><div className="step-emoji">🛍️</div><h3>Isi pesanan</h3><p>Masukkan data diri dan cek ringkasan pesananmu.</p></div><div className="step-card"><span className="step-number">03</span><div className="step-emoji">😋</div><h3>Nikmati!</h3><p>Selesaikan pembayaran dan tunggu pesanan siap.</p></div></div></section>
   <section id="tentang" className="cta-section"><div><span className="section-kicker">WAKTUNYA MAKAN ENAK</span><h2>Perut senang,<br/><span>aktivitas lancar.</span></h2><p>OTK bikin urusan makan jadi lebih sederhana.</p><button className="primary-btn" onClick={()=>go('menu')}>Mulai pesan <ArrowRight size={18}/></button></div><div className="cta-illustration">🍱<span>🥤</span><i>✦</i></div></section></>}
  {page==='menu'&&<section className="section page-section"><div className="section-heading"><div><span className="section-kicker">MENU OTEWE KANTIN</span><h2>Temukan favoritmu<span>.</span></h2><p>Pilih menu, tambahkan ke keranjang, lalu lanjut checkout.</p></div></div><div className="menu-tools"><div className="search-box"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari makanan atau minuman..."/></div><div className="filter-row">{categories.map(c=><button key={c} className={category===c?'filter-chip selected':'filter-chip'} onClick={()=>setCategory(c)}>{c}</button>)}</div></div>{filtered.length?<div className="product-grid">{filtered.map(p=><ProductCard key={p.id} p={p}/>)}</div>:<div className="empty-state"><Soup size={38}/><h3>Menu belum ditemukan</h3><p>Coba kata kunci atau kategori lain.</p><button className="outline-btn" onClick={()=>{setSearch('');setCategory('Semua')}}>Reset filter</button></div>}</section>}
  {page==='cart'&&<section className="section page-section"><div className="section-heading"><div><span className="section-kicker">TINGGAL SELANGKAH LAGI</span><h2>Keranjang <span>kamu.</span></h2><p>Periksa lagi pilihan enakmu sebelum checkout.</p></div></div>{!cart.length?<div className="empty-state"><ShoppingBag size={42}/><h3>Keranjangmu masih kosong</h3><p>Yuk pilih menu favorit buat mengisi energi.</p><button className="primary-btn" onClick={()=>go('menu')}>Cari menu <ArrowRight size={17}/></button></div>:<div className="cart-layout"><div className="cart-list">{cart.map(i=>{const p=products.find(x=>x.id===i.productId);if(!p)return null;return <div className="cart-item" key={i.productId}><img src={p.image} alt={p.name}/><div className="cart-item-copy"><span className="eyebrow">{p.category}</span><h3>{p.name}</h3><strong>{rupiah(p.price)}</strong><div className="qty-control"><button onClick={()=>updateQty(p.id,-1)}><Minus size={14}/></button><span>{i.quantity}</span><button onClick={()=>updateQty(p.id,1)}><Plus size={14}/></button></div></div><button className="remove-btn" onClick={()=>remove(p.id)} aria-label="Hapus produk"><Trash2 size={17}/></button></div>})}<button className="text-btn continue-btn" onClick={()=>go('menu')}>← Tambah menu lain</button></div><aside className="summary-card"><h3>Ringkasan pesanan</h3><div className="summary-line"><span>Subtotal</span><strong>{rupiah(subtotal)}</strong></div><div className="summary-line"><span>Biaya pengantaran</span><span>Dihitung jika diantar</span></div><div className="summary-total"><span>Total sementara</span><strong>{rupiah(subtotal)}</strong></div><button className="primary-btn full-btn" onClick={()=>go('checkout')}>Lanjut checkout <ArrowRight size={17}/></button><small><ShieldCheck size={14}/> Total final divalidasi server saat checkout.</small></aside></div>}</section>}
  {page==='checkout'&&<section className="section page-section"><div className="section-heading"><div><span className="section-kicker">DATA PEMESANAN</span><h2>Checkout <span>pesanan.</span></h2><p>Lengkapi data yang diperlukan untuk memproses pesananmu.</p></div></div><form className="checkout-layout" onSubmit={checkout}><div className="form-card"><h3>Informasi customer</h3><div className="form-grid"><label>Nama lengkap *<input required minLength={2} value={customer.name} onChange={e=>setCustomer({...customer,name:e.target.value})} placeholder="Nama kamu"/></label><label>Nomor telepon *<input required pattern="[0-9+() -]{8,18}" value={customer.phone} onChange={e=>setCustomer({...customer,phone:e.target.value})} placeholder="08xxxxxxxxxx"/></label><label>Email (opsional)<input type="email" value={customer.email} onChange={e=>setCustomer({...customer,email:e.target.value})} placeholder="nama@email.com"/></label><label>Metode pemenuhan *<select value={customer.fulfillment} onChange={e=>setCustomer({...customer,fulfillment:e.target.value})}><option>Ambil di kantin</option><option>Diantar</option></select></label>{customer.fulfillment==='Diantar'&&<label className="wide-field">Alamat pengantaran *<textarea required value={customer.address} onChange={e=>setCustomer({...customer,address:e.target.value})} placeholder="Gedung, lantai, atau alamat lengkap"/></label>}<label className="wide-field">Catatan pesanan<textarea value={customer.note} onChange={e=>setCustomer({...customer,note:e.target.value})} placeholder="Contoh: sambal dipisah (opsional)"/></label></div><div className="privacy-note"><ShieldCheck size={17}/> Data digunakan untuk pemrosesan pesanan saja. Jangan masukkan PIN, OTP, atau data kartu.</div></div><aside className="summary-card"><h3>Pesanan kamu</h3>{cart.map(i=>{const p=products.find(x=>x.id===i.productId);return p?<div className="summary-product" key={p.id}><span>{i.quantity} × {p.name}</span><strong>{rupiah(p.price*i.quantity)}</strong></div>:null})}<div className="summary-total"><span>Total sementara</span><strong>{rupiah(subtotal)}</strong></div><label className="payment-method-field">Metode pembayaran *<select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}><option value="Tunai">Tunai</option><option value="Transfer Bank">Transfer Bank</option><option value="QRIS">QRIS</option><option value="DANA">DANA</option><option value="GoPay">GoPay</option><option value="OVO">OVO</option><option value="ShopeePay">ShopeePay</option></select></label><p className="payment-info">Metode pembayaran hanya dicatat pada pesanan. Tidak ada pembayaran otomatis atau koneksi Midtrans; pengelola akan mengonfirmasi pembayaran secara manual.</p><button className="primary-btn full-btn" disabled={busy||!cart.length}>{busy?'Menyimpan pesanan…':'Buat pesanan'} <ArrowRight size={17}/></button><button type="button" className="text-btn full-btn" onClick={()=>go('cart')}>Kembali ke keranjang</button></aside></form></section>}
  {page==='admin'&&<section className="section page-section admin-page"><div className="section-heading"><div><span className="section-kicker">OTK MANAGEMENT</span><h2>Dashboard <span>admin.</span></h2><p>Kelola katalog dan pantau pesanan kantin.</p></div><button className="outline-btn" onClick={()=>setShowLogin(true)}>Verifikasi admin</button></div><div className="admin-warning"><ShieldCheck size={18}/><div><b>Mode pengembangan</b><p>Perubahan katalog dikirim ke API backend dan disimpan melalui Prisma ke MySQL. Pastikan backend aktif dan admin sudah login.</p></div></div><div className="stats-grid"><div className="stat-card"><span>Total produk</span><strong>{products.length}</strong><small>Produk dari katalog database/API</small></div><div className="stat-card"><span>Total pesanan</span><strong>{orders.length}</strong><small>Pesanan dari database</small></div><div className="stat-card"><span>Menunggu</span><strong>{orders.filter(o=>o.status!=='Selesai').length}</strong><small>Status pemenuhan</small></div><div className="stat-card"><span>Nilai total pesanan</span><strong>{rupiah(orders.reduce((s,o)=>s+o.total,0))}</strong><small>Bukan laporan pembayaran terverifikasi</small></div></div><div className="admin-toolbar"><div><h3>Kelola katalog</h3><p>Tambah, edit, dan hapus produk. Perubahan tersimpan di MySQL.</p></div><button className="primary-btn" onClick={()=>setEditing({id:'',name:'',category:'Makanan Berat',price:0,description:'',image:'',stock:0,active:true})}><Plus size={17}/> Tambah produk</button></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Produk</th><th>Kategori</th><th>Harga</th><th>Aksi</th></tr></thead><tbody>{products.map(p=><tr key={p.id}><td><div className="table-product"><img src={p.image} alt=""/><b>{p.name}</b></div></td><td>{p.category}</td><td>{rupiah(p.price)}</td><td><div className="table-actions"><button onClick={()=>setEditing(p)}>Edit</button><button className="danger-link" onClick={()=>deleteProduct(p)}>Hapus</button></div></td></tr>)}</tbody></table></div><div className="admin-toolbar orders-toolbar"><div><h3>Pesanan terbaru</h3><p>Daftar pesanan yang tersimpan di database MySQL. Metode pembayaran dicatat saja; konfirmasi dilakukan manual.</p></div></div>{orders.length===0?<div className="empty-state compact"><ShoppingBag/><h3>Belum ada pesanan lokal</h3></div>:<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>No. pesanan</th><th>Customer</th><th>Total</th><th>Metode pembayaran</th><th>Status pembayaran</th><th>Status pesanan</th><th>Aksi</th></tr></thead><tbody>{orders.map(o=><tr key={o.id}><td>{o.id}</td><td>{o.customer}<small>{o.phone}</small></td><td>{rupiah(o.total)}</td><td>{o.paymentMethod||'—'}</td><td><span className="status unavailable">{o.paymentStatus}</span></td><td>{o.status}</td><td>
<select
  value={
    o.status === 'MENUNGGU_KONFIRMASI'
      ? 'Menunggu konfirmasi'
      : o.status
  }
  onChange={(e) =>
    updateOrderStatus(o.id, e.target.value)
  }
>
  <option>Menunggu konfirmasi</option>
  <option>Diproses</option>
  <option>Siap Diambil</option>
  <option>Dalam Pengantaran</option>
  <option>Selesai</option>
  <option>Dibatalkan</option>
</select>
</td></tr>)}</tbody></table></div>}</section>}
  </main>
  <footer className="footer"><div className="footer-main"><div className="footer-brand"><img src="/logo-otk.png" alt="OTK Otewe Kantin"/><p>Teman makan harianmu. Pilih menu favorit dan pesan dengan lebih praktis.</p></div><div><b>Jelajahi</b><button onClick={()=>go('home')}>Beranda</button><button onClick={()=>go('menu')}>Menu makanan</button><button onClick={()=>go('cart')}>Keranjang</button></div><div><b>Informasi</b><a href="#tentang">Tentang OTK</a><span>Jam operasional mengikuti kantin</span><span>OTK — Otewe Kantin</span></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} OTK — Otewe Kantin</span><span>Dibuat dengan <Heart size={13} fill="currentColor"/> untuk pecinta makan enak</span></div></footer>
  {toast&&<div className="toast"><BadgeCheck size={18}/>{toast}<button onClick={()=>setToast('')}><X size={15}/></button></div>}
  {showLogin&&<div className="modal-backdrop" onClick={()=>setShowLogin(false)}><form className="login-modal" onSubmit={login} onClick={e=>e.stopPropagation()}><button type="button" className="modal-close" onClick={()=>setShowLogin(false)}><X/></button><img src="/logo-otk.png" alt="OTK"/><span className="section-kicker">AREA ADMIN</span><h2>Selamat datang!</h2><p>Masuk menggunakan kredensial admin yang diatur pada backend/.env.</p><label>Email admin<input name="email" type="email" required placeholder="admin@otk.local"/></label><label>Password<input name="password" type="password" required placeholder="Masukkan password"/></label><button className="primary-btn full-btn">Masuk dashboard <ArrowRight size={17}/></button><small>Untuk penggunaan publik, tambahkan autentikasi dan sesi admin yang lebih kuat.</small></form></div>}
  {editing&&<div className="modal-backdrop" onClick={()=>setEditing(null)}><form className="product-modal" onSubmit={saveProduct} onClick={e=>e.stopPropagation()}><button type="button" className="modal-close" onClick={()=>setEditing(null)}><X/></button><span className="section-kicker">KATALOG OTK</span><h2>{editing.id?'Edit produk':'Tambah produk'}</h2><label>Nama produk *<input name="name" defaultValue={editing.name} required/></label><label>Kategori *<select name="category" defaultValue={editing.category}>{categories.slice(1).map(c=><option key={c}>{c}</option>)}</select></label><label>Harga (Rupiah) *<input name="price" type="number" min="1" defaultValue={editing.price||''} required/></label><label>URL gambar<input name="image" type="url" defaultValue={editing.image} placeholder="https://..."/></label><label>Deskripsi *<textarea name="description" defaultValue={editing.description} required/></label><button className="primary-btn full-btn">Simpan produk <ArrowRight size={17}/></button></form></div>}
 </div>;
}