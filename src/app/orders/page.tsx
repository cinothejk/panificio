"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Product = {
  id: string;
  name: string;
  price: number;
  category: string;
  price_type: "FIXED" | "WEIGHT";
};

type Order = {
  id: string;
  customer_name: string;
  customer_phone: string;
  delivery_time: string;
  status: string;
  total: number;
  created_at: string;
};

type CartItem = {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  category: string;
  price_type: "FIXED" | "WEIGHT";
  weight?: number;
};

export default function OrdersPage() {
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [manualTotal, setManualTotal] = useState("");

  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [search, setSearch] = useState("");
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    checkUser();
    loadProducts();
    loadOrders();

    const channel = supabase
      .channel("orders-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => loadOrders()
      )
      .subscribe();
    
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener(
      "fullscreenchange",
      handleFullscreenChange
    );

    return () => {
      document.removeEventListener(
        "fullscreenchange",
        handleFullscreenChange
      );

      supabase.removeChannel(channel);
    };

    /*
    return () => {
      supabase.removeChannel(channel);
    }; */
  }, []);

  async function checkUser() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) router.push("/login");
  }

  async function loadProducts() {
    const { data } = await supabase
      .from("products")
      .select("*")
      .order("category")
      .order("name");

    if (data) setProducts(data);
  }

  async function loadOrders() {
    const { data } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setOrders(data);
  }

  const categories = useMemo(() => {
    const unique = [...new Set(products.map((p) => p.category))];
    return ["ALL", ...unique];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = selectedCategory === "ALL" || p.category === selectedCategory;
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [products, selectedCategory, search]);

  function addProduct(product: Product) {
    const existing = cartItems.find(i => i.product_id === product.id);

    if (existing && product.price_type === "FIXED") {
      setCartItems(prev =>
        prev.map(item =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
      return;
    }

    setCartItems(prev => [
      ...prev,
      {
        product_id: product.id,
        name: product.name,
        quantity: 1,
        unit_price: product.price,
        category: product.category,
        price_type: product.price_type,
        weight: product.price_type === "WEIGHT" ? 0 : undefined,
      },
    ]);
  }

  function updateQuantity(id: string, qty: number) {
    if (qty <= 0) {
      setCartItems(prev => prev.filter(i => i.product_id !== id));
      return;
    }

    setCartItems(prev =>
      prev.map(i =>
        i.product_id === id ? { ...i, quantity: qty } : i
      )
    );
  }

  function updateWeight(id: string, weight: number) {
    setCartItems(prev =>
      prev.map(i =>
        i.product_id === id ? { ...i, weight } : i
      )
    );
  }

  function removeProduct(id: string) {
    setCartItems(prev => prev.filter(i => i.product_id !== id));
  }

  function calculateItemTotal(item: CartItem) {
    if (item.price_type === "WEIGHT") {
      return (item.weight || 0) * item.unit_price;
    }
    return item.quantity * item.unit_price;
  }

  const automaticTotal = cartItems.reduce(
    (sum, item) => sum + calculateItemTotal(item),
    0
  );

  const total = manualTotal !== "" ? Number(manualTotal) : automaticTotal;

  async function createOrder() {
    if (
      !customerName.trim() ||
      !customerPhone.trim() ||
      !deliveryTime ||
      cartItems.length === 0
    ) {
      alert(
        "Compila tutti i dati cliente, orario di consegna e almeno un prodotto"
      );

      return;
    }

    if (editingOrderId) {
      await updateOrder();
      return;
    }

    const { data: order } = await supabase
      .from("orders")
      .insert({
        customer_name: customerName,
        customer_phone: customerPhone,
        delivery_time: deliveryTime || null,
        total,
      })
      .select()
      .single();

    if (!order) return;

    await supabase.from("order_items").insert(
      cartItems.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        weight: item.weight || null,
      }))
    );

    resetForm();
  }

  async function updateOrder() {
    if (!editingOrderId) return;
    if (
      !customerName.trim() ||
      !customerPhone.trim() ||
      !deliveryTime ||
      cartItems.length === 0
    ) {
      alert(
        "Compila tutti i dati cliente, orario di consegna e almeno un prodotto"
      );

      return;
    }

    await supabase.from("orders")
      .update({
        customer_name: customerName,
        customer_phone: customerPhone,
        delivery_time: deliveryTime || null,
        total,
      })
      .eq("id", editingOrderId);

    await supabase.from("order_items")
      .delete()
      .eq("order_id", editingOrderId);

    await supabase.from("order_items").insert(
      cartItems.map(item => ({
        order_id: editingOrderId,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        weight: item.weight || null,
      }))
    );

    resetForm();
    loadOrders();
  }

  async function deleteOrder(id: string) {
    if (!confirm("Eliminare ordine?")) return;

    await supabase.from("order_items").delete().eq("order_id", id);
    await supabase.from("orders").delete().eq("id", id);

    loadOrders();
  }

  async function editOrder(order: Order) {
    setEditingOrderId(order.id);

    setCustomerName(order.customer_name);
    setCustomerPhone(order.customer_phone || "");
    setDeliveryTime(order.delivery_time || "");

    const { data: items } = await supabase
      .from("order_items")
      .select(`
        product_id,
        quantity,
        unit_price,
        weight,
        products (
          name,
          category,
          price_type
        )
      `)
      .eq("order_id", order.id);

    if (!items) return;

    const formatted: CartItem[] = items.map((i: any) => ({
      product_id: i.product_id,
      name: i.products.name,
      category: i.products.category,
      price_type: i.products.price_type,
      quantity: i.quantity,
      unit_price: i.unit_price,
      weight: i.weight || undefined,
    }));

    setCartItems(formatted);
  }

  function resetForm() {
    setCustomerName("");
    setCustomerPhone("");
    setDeliveryTime("");
    setCartItems([]);
    setManualTotal("");
    setEditingOrderId(null);
  }

  async function toggleFullscreen() {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4 lg:p-6 overflow-y-auto">

      {/* HEADER */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <h1 className="text-2xl lg:text-4xl font-bold">Gestione Ordini</h1>

        <div className="flex items-center gap-3">

          <button
            onClick={toggleFullscreen}
            className="bg-black text-white px-5 py-3 rounded-2xl font-semibold"
          >
            {isFullscreen ? "Esci Fullscreen" : "Fullscreen"}
          </button>

          <button
            onClick={() =>
              supabase.auth
                .signOut()
                .then(() => router.push("/login"))
            }
            className="bg-red-500 text-white px-5 py-3 rounded-2xl font-semibold"
          >
            Logout
          </button>

        </div>
      </div>

      {/* 3 COLONNE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:h-[calc(100vh-120px)]">

        {/* COL 1 */}
        <div className="space-y-4 lg:overflow-y-auto">

          {/* CLIENTE */}
          <div className="bg-white p-4 rounded-3xl">
            <h2 className="font-bold mb-3">Cliente</h2>

            <input className="border p-2 w-full mb-2 rounded-xl"
              required
              placeholder="Nome"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
            />

            <input className="border p-2 w-full mb-2 rounded-xl"
              required
              placeholder="Telefono"
              value={customerPhone}
              onChange={e => setCustomerPhone(e.target.value)}
            />

            <input type="datetime-local"
              required
              className="border p-2 w-full rounded-xl"
              value={deliveryTime}
              onChange={e => setDeliveryTime(e.target.value)}
            />
          </div>

          {/* PRODUCTS */}
          <div className="bg-white p-4 rounded-3xl">
            <input
              className="border p-2 w-full mb-3 rounded-xl"
              placeholder="Cerca..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />

            <div className="flex flex-wrap gap-2 mb-3">
              {categories.map(c => (
                <button
                  key={c}
                  onClick={() => setSelectedCategory(c)}
                  className={`px-3 py-1 rounded-xl ${
                    selectedCategory === c ? "bg-black text-white" : "bg-gray-200"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {filteredProducts.map(p => (
                <button
                  key={p.id}
                  onClick={() => addProduct(p)}
                  className="w-full text-left border p-3 rounded-xl"
                >
                  <div className="font-bold">{p.name}</div>
                  <div className="text-sm text-gray-500">
                    {p.price_type === "WEIGHT" ? `${p.price}/kg` : `€${p.price}`}
                  </div>
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* COL 2 */}
        <div className="bg-white p-4 rounded-3xl lg:overflow-y-auto lg:sticky lg:top-6">

          <h2 className="font-bold mb-4">Ordine</h2>

          {cartItems.map(item => (
            <div key={item.product_id} className="border p-3 rounded-xl mb-3">

              <div className="flex justify-between">
                <div className="font-bold">{item.name}</div>
                <button onClick={() => removeProduct(item.product_id)}>✕</button>
              </div>

              {item.price_type === "WEIGHT" ? (
                <input
                  type="number"
                  className="border mt-2 p-2 w-full rounded-xl"
                  placeholder="kg"
                  value={item.weight || ""}
                  onChange={e => updateWeight(item.product_id, Number(e.target.value))}
                />
              ) : (
                <div className="flex gap-3 mt-2">
                  <button onClick={() => updateQuantity(item.product_id, item.quantity - 1)}>-</button>
                  <div>{item.quantity}</div>
                  <button onClick={() => updateQuantity(item.product_id, item.quantity + 1)}>+</button>
                </div>
              )}

              <div className="font-bold text-right mt-2">
                € {calculateItemTotal(item).toFixed(2)}
              </div>

            </div>
          ))}

          <div className="border-t pt-4 mt-4">
            <div className="text-xl font-bold">
              Totale: € {automaticTotal.toFixed(2)}
            </div>

            <button
              onClick={createOrder}
              className="w-full mt-4 bg-black text-white p-3 rounded-xl"
            >
              {editingOrderId ? "Aggiorna" : "Salva"}
            </button>
          </div>

        </div>

        {/* COL 3 */}
        <div className="bg-white p-4 rounded-3xl lg:overflow-y-auto lg:sticky lg:top-6">

          <h2 className="font-bold mb-4">Ordini Live</h2>

          {orders.map(o => (
            <div key={o.id} className="border p-3 rounded-xl mb-3">

              <div className="font-bold">{o.customer_name}</div>
              <div className="text-sm text-gray-500">
                € {Number(o.total).toFixed(2)}
              </div>

              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => editOrder(o)}
                  className="bg-black text-white px-3 py-1 rounded-xl"
                >
                  Modifica
                </button>

                <button
                  onClick={() => deleteOrder(o.id)}
                  className="bg-red-500 text-white px-3 py-1 rounded-xl"
                >
                  Elimina
                </button>
              </div>

            </div>
          ))}

        </div>

      </div>
    </main>
  );
}