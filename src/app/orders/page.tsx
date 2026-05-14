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

  const [customerName, setCustomerName] =
    useState("");

  const [customerPhone, setCustomerPhone] =
    useState("");

  const [deliveryTime, setDeliveryTime] =
    useState("");

  const [cartItems, setCartItems] = useState<
    CartItem[]
  >([]);

  const [manualTotal, setManualTotal] =
    useState("");

  const [selectedCategory, setSelectedCategory] =
    useState("ALL");

  const [search, setSearch] = useState("");

  const [editingOrderId, setEditingOrderId] =
    useState<string | null>(null);

  useEffect(() => {
    checkUser();
    loadProducts();
    loadOrders();

    const channel = supabase
      .channel("orders-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        () => {
          loadOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function checkUser() {
    const { data } =
      await supabase.auth.getUser();

    if (!data.user) {
      router.push("/login");
    }
  }

  async function loadProducts() {
    const { data } = await supabase
      .from("products")
      .select("*")
      .order("category")
      .order("name");

    if (data) {
      setProducts(data);
    }
  }

  async function loadOrders() {
    const { data } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", {
        ascending: false,
      });

    if (data) {
      setOrders(data);
    }
  }

  const categories = useMemo(() => {
    const unique = [
      ...new Set(
        products.map((p) => p.category)
      ),
    ];

    return ["ALL", ...unique];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const categoryMatch =
        selectedCategory === "ALL" ||
        product.category ===
          selectedCategory;

      const searchMatch =
        product.name
          .toLowerCase()
          .includes(search.toLowerCase());

      return categoryMatch && searchMatch;
    });
  }, [
    products,
    selectedCategory,
    search,
  ]);

  function addProduct(product: Product) {
    const existing = cartItems.find(
      (item) =>
        item.product_id === product.id
    );

    if (existing) {
      if (product.price_type === "WEIGHT") {
        return; // evita duplicati per peso
      }

      setCartItems((current) =>
        current.map((item) =>
          item.product_id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
              }
            : item
        )
      );

      return;
    }

    setCartItems((current) => [
      ...current,
      {
        product_id: product.id,
        name: product.name,
        quantity: 1,
        unit_price: Number(product.price),
        category: product.category,
        price_type: product.price_type,
        weight: product.price_type === "WEIGHT" ? 0 : undefined,
      },
    ]);
  }

  function removeProduct(productId: string) {
    setCartItems((current) =>
      current.filter(
        (item) =>
          item.product_id !== productId
      )
    );
  }

  function updateQuantity(
    productId: string,
    quantity: number
  ) {
    if (quantity <= 0) {
      removeProduct(productId);
      return;
    }

    setCartItems((current) =>
      current.map((item) =>
        item.product_id === productId
          ? {
              ...item,
              quantity,
            }
          : item
      )
    );
  }

  function updateWeight(
    productId: string,
    weight: number
  ) {
    setCartItems((current) =>
      current.map((item) =>
        item.product_id === productId
          ? {
              ...item,
              weight,
            }
          : item
      )
    );
  }

  function calculateItemTotal(item: CartItem) {
    if (item.price_type === "WEIGHT") {
      return (item.weight || 0) * item.unit_price;
    }

    return item.quantity * item.unit_price;
  }

  const automaticTotal = cartItems.reduce(
    (sum, item) =>
      sum + calculateItemTotal(item),
    0
  );

  const total =
    manualTotal !== ""
      ? Number(manualTotal)
      : automaticTotal;

  async function createOrder() {
    if (
      !customerName ||
      cartItems.length === 0
    ) {
      alert(
        "Compila cliente e prodotti"
      );
      return;
    }

    if (editingOrderId) {
      await updateOrder();
      return;
    }

    const { data: order, error } =
      await supabase
        .from("orders")
        .insert({
          customer_name: customerName,
          customer_phone:
            customerPhone,
          delivery_time:
            deliveryTime || null,
          total,
        })
        .select()
        .single();

    if (error || !order) {
      console.error(error);
      return;
    }

    const items = cartItems.map(
      (item) => ({
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        weight: item.weight || null,
      })
    );

    const { error: itemsError } =
      await supabase
        .from("order_items")
        .insert(items);

    if (itemsError) {
      console.error(itemsError);
      return;
    }

    resetForm();
  }

  async function updateOrder() {
    if (!editingOrderId) return;

    await supabase
      .from("orders")
      .update({
        customer_name: customerName,
        customer_phone:
          customerPhone,
        delivery_time:
          deliveryTime || null,
        total,
      })
      .eq("id", editingOrderId);

    await supabase
      .from("order_items")
      .delete()
      .eq("order_id", editingOrderId);

    const items = cartItems.map(
      (item) => ({
        order_id: editingOrderId,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        weight: item.weight || null,
      })
    );

    await supabase
      .from("order_items")
      .insert(items);

    resetForm();
    loadOrders();
  }

  async function deleteOrder(
    orderId: string
  ) {
    const confirmed = confirm(
      "Eliminare ordine?"
    );

    if (!confirmed) return;

    await supabase
      .from("order_items")
      .delete()
      .eq("order_id", orderId);

    await supabase
      .from("orders")
      .delete()
      .eq("id", orderId);

    loadOrders();
  }

  function resetForm() {
    setCustomerName("");
    setCustomerPhone("");
    setDeliveryTime("");
    setCartItems([]);
    setManualTotal("");
    setEditingOrderId(null);

    loadOrders();
  }

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold">
            Gestione Ordini
          </h1>

          <div className="text-gray-500 mt-1">
            Panificio Manager
          </div>
        </div>

        <button
          onClick={async () => {
            await supabase.auth.signOut();
            router.push("/login");
          }}
          className="bg-red-500 text-white px-5 py-3 rounded-2xl font-semibold"
        >
          Logout
        </button>
      </div>

      <div className="grid xl:grid-cols-[1.2fr_0.8fr] gap-6">
        {/* LEFT */}
        <div className="space-y-6">
          {/* CUSTOMER */}
          <div className="bg-white rounded-3xl p-6 shadow-sm">
            <h2 className="text-2xl font-bold mb-5">
              Cliente
            </h2>

            <div className="grid md:grid-cols-3 gap-4">
              <input
                type="text"
                placeholder="Nome cliente"
                value={customerName}
                onChange={(e) =>
                  setCustomerName(
                    e.target.value
                  )
                }
                className="border rounded-2xl p-4"
              />

              <input
                type="text"
                placeholder="Telefono"
                value={customerPhone}
                onChange={(e) =>
                  setCustomerPhone(
                    e.target.value
                  )
                }
                className="border rounded-2xl p-4"
              />

              <input
                type="datetime-local"
                value={deliveryTime}
                onChange={(e) =>
                  setDeliveryTime(
                    e.target.value
                  )
                }
                className="border rounded-2xl p-4"
              />
            </div>
          </div>

          {/* PRODUCTS */}
          <div className="bg-white rounded-3xl p-6 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5">
              <h2 className="text-2xl font-bold">
                Prodotti
              </h2>

              <input
                type="text"
                placeholder="Cerca prodotto..."
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                className="border rounded-2xl px-4 py-3 w-full lg:w-72"
              />
            </div>

            {/* CATEGORIES */}
            <div className="flex flex-wrap gap-3 mb-6">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() =>
                    setSelectedCategory(
                      category
                    )
                  }
                  className={`px-5 py-3 rounded-2xl font-semibold transition ${
                    selectedCategory ===
                    category
                      ? "bg-black text-white"
                      : "bg-gray-200"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            {/* PRODUCT GRID */}
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredProducts.map(
                (product) => (
                  <button
                    key={product.id}
                    onClick={() =>
                      addProduct(product)
                    }
                    className="rounded-2xl border p-5 bg-gray-50 hover:bg-gray-100 transition text-left"
                  >
                    <div className="text-xl font-bold">
                      {product.name}
                    </div>

                    <div className="mt-2 text-sm text-gray-500">
                      {
                        product.category
                      }
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <div className="font-bold text-lg">
                        {product.price_type === "WEIGHT"
                        ? `€${Number(product.price).toFixed(2)}/kg`
                        : `€${Number(product.price).toFixed(2)}`}
                      </div>

                      <div
                        className={`text-xs px-3 py-1 rounded-full font-semibold ${
                          product.price_type ===
                          "WEIGHT"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {product.price_type}
                      </div>
                    </div>
                  </button>
                )
              )}
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="space-y-6">
          {/* CART */}
          <div className="bg-white rounded-3xl p-6 shadow-sm sticky top-6">
            <h2 className="text-2xl font-bold mb-6">
              Ordine
            </h2>

            {cartItems.length === 0 && (
              <div className="text-gray-500">
                Nessun prodotto aggiunto
              </div>
            )}

            <div className="space-y-4 max-h-[450px] overflow-y-auto">
              {cartItems.map((item) => (
                <div
                  key={item.product_id}
                  className="border rounded-2xl p-4"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-lg">
                        {item.name}
                      </div>

                      <div className="text-sm text-gray-500">
                        {
                          item.category
                        }
                      </div>
                    </div>

                    <button
                      onClick={() =>
                        removeProduct(
                          item.product_id
                        )
                      }
                      className="text-red-500 font-bold"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() =>
                          updateQuantity(
                            item.product_id,
                            item.quantity -
                              1
                          )
                        }
                        className="w-10 h-10 rounded-xl bg-gray-200 text-xl"
                      >
                        -
                      </button>

                      <div className="text-xl font-bold w-8 text-center">
                        {item.quantity}
                      </div>

                      <button
                        onClick={() =>
                          updateQuantity(
                            item.product_id,
                            item.quantity +
                              1
                          )
                        }
                        className="w-10 h-10 rounded-xl bg-gray-200 text-xl"
                      >
                        +
                      </button>
                    </div>

                    <div className="font-bold text-lg">
                      €
                      {calculateItemTotal(item).toFixed(2)}
                    </div>
                  </div>

                  {item.price_type ===
                    "WEIGHT" && (
                    <div className="mt-4">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Peso (kg)"
                        value={
                          item.weight || ""
                        }
                        onChange={(e) =>
                          updateWeight(
                            item.product_id,
                            Number(
                              e.target.value
                            )
                          )
                        }
                        className="w-full border rounded-xl p-3"
                      />
                      <div className="text-sm text-gray-500 mt-1">
                        € {item.unit_price}/kg
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* TOTAL */}
            <div className="mt-6 border-t pt-6">
              <div className="flex justify-between items-center mb-4">
                <div className="text-xl font-bold">
                  Totale Automatico
                </div>

                <div className="text-2xl font-bold">
                  €
                  {automaticTotal.toFixed(
                    2
                  )}
                </div>
              </div>

              <div>
                <div className="font-semibold mb-2">
                  Totale Finale
                </div>

                <input
                  type="number"
                  step="0.01"
                  placeholder="Inserisci totale manuale"
                  value={manualTotal}
                  onChange={(e) =>
                    setManualTotal(
                      e.target.value
                    )
                  }
                  className="w-full border rounded-2xl p-4 text-3xl font-bold"
                />
              </div>

              <button
                onClick={createOrder}
                className="w-full mt-6 bg-black text-white rounded-2xl p-5 text-xl font-bold hover:opacity-90 transition"
              >
                {editingOrderId
                  ? "Aggiorna Ordine"
                  : "Salva Ordine"}
              </button>
            </div>
          </div>

          {/* LIVE ORDERS */}
          <div className="bg-white rounded-3xl p-6 shadow-sm">
            <h2 className="text-2xl font-bold mb-6">
              Ordini Live
            </h2>

            <div className="space-y-4">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="border rounded-2xl p-5"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-xl font-bold">
                        {
                          order.customer_name
                        }
                      </div>

                      <div className="text-gray-500 mt-1">
                        📞{" "}
                        {order.customer_phone ||
                          "-"}
                      </div>
                    </div>

                    <div className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full font-semibold text-sm">
                      {order.status}
                    </div>
                  </div>

                  <div className="mt-4 text-gray-500">
                    ⏰{" "}
                    {order.delivery_time
                      ? new Date(
                          order.delivery_time
                        ).toLocaleString()
                      : "Nessun orario"}
                  </div>

                  <div className="mt-4 text-3xl font-bold">
                    €
                    {Number(
                      order.total
                    ).toFixed(2)}
                  </div>

                  <div className="flex gap-3 mt-5">
                    <button
                      className="flex-1 bg-black text-white rounded-xl py-3 font-semibold"
                    >
                      Modifica
                    </button>

                    <button
                      onClick={() =>
                        deleteOrder(
                          order.id
                        )
                      }
                      className="flex-1 bg-red-500 text-white rounded-xl py-3 font-semibold"
                    >
                      Elimina
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}