"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Product = {
  id: string;
  name: string;
  price: number;
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
};

export default function OrdersPage() {

  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");

  const [cartItems, setCartItems] = useState<CartItem[]>(
    []
  );

  useEffect(() => {

    checkUser();
    loadProducts();
    loadOrders();

    const channel = supabase
      .channel("orders")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        () => {
          console.log("Realtime event received");
          loadOrders();
        }
      )
      .subscribe((status) => {
        console.log("Realtime status:", status);
      });

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
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("name");

    console.log("PRODUCTS:", data);
    console.log("ERROR:", error);

    if (data) {
      setProducts(data);
    }
  }

  async function loadOrders() {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", {
        ascending: false,
      });

    console.log("ORDERS:", data);
    console.log("ERROR ORDERS:", error);

    if (data) {
      setOrders(data);
    }
  }

  function addProduct(productId: string) {
    const product = products.find(
      (p) => p.id === productId
    );

    if (!product) return;

    const existing = cartItems.find(
      (item) => item.product_id === productId
    );

    if (existing) {
      setCartItems((current) =>
        current.map((item) =>
          item.product_id === productId
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
      },
    ]);
  }

  function removeProduct(productId: string) {
    setCartItems((current) =>
      current.filter(
        (item) => item.product_id !== productId
      )
    );
  }

  function changeQuantity(
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

  const total = cartItems.reduce(
    (sum, item) =>
      sum + item.quantity * item.unit_price,
    0
  );

  async function createOrder() {
    if (
      !customerName ||
      cartItems.length === 0
    ) {
      alert("Compila i campi obbligatori");
      return;
    }

    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        customer_name: customerName,
        customer_phone: customerPhone,
        delivery_time: deliveryTime || null,
        total,
      })
      .select()
      .single();

    if (error || !order) {
      console.error(error);
      return;
    }

    const items = cartItems.map((item) => ({
      order_id: order.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(items);

    if (itemsError) {
      console.error(itemsError);
      return;
    }

    setCustomerName("");
    setCustomerPhone("");
    setDeliveryTime("");
    setCartItems([]);
  }

  return (
    <main className="p-10 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-4xl font-bold">
          Gestione Ordini
        </h1>

      <button
          onClick={async () => {
            await supabase.auth.signOut();
            router.push("/login");
          }}
          className="bg-red-500 text-white px-4 py-2 rounded-xl"
        >
          Logout
      </button>
    </div>
      

      <div className="grid lg:grid-cols-2 gap-10">
        {/* FORM */}
        <div className="border rounded-2xl p-6 shadow-sm">
          <h2 className="text-2xl font-semibold mb-6">
            Nuovo Ordine
          </h2>

          <div className="space-y-4">
            <input
              type="text"
              placeholder="Nome cliente"
              value={customerName}
              onChange={(e) =>
                setCustomerName(e.target.value)
              }
              className="w-full border rounded-xl p-3"
            />

            <input
              type="text"
              placeholder="Telefono"
              value={customerPhone}
              onChange={(e) =>
                setCustomerPhone(e.target.value)
              }
              className="w-full border rounded-xl p-3"
            />

            <input
              type="datetime-local"
              value={deliveryTime}
              onChange={(e) =>
                setDeliveryTime(e.target.value)
              }
              className="w-full border rounded-xl p-3"
            />

            {/* PRODUCTS */}
            <div>
              <div className="font-semibold mb-3">
                Prodotti
              </div>

              <div className="grid grid-cols-2 gap-3">
                {products.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() =>
                      addProduct(product.id)
                    }
                    className="border rounded-xl p-4 hover:bg-gray-100 transition text-left"
                  >
                    <div className="font-semibold">
                      {product.name}
                    </div>

                    <div className="text-sm text-gray-600">
                      € {product.price}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* CART */}
            <div className="border rounded-2xl p-4">
              <div className="font-semibold text-lg mb-4">
                Ordine
              </div>

              {cartItems.length === 0 && (
                <div className="text-gray-500">
                  Nessun prodotto aggiunto
                </div>
              )}

              <div className="space-y-3">
                {cartItems.map((item) => (
                  <div
                    key={item.product_id}
                    className="flex items-center justify-between gap-4"
                  >
                    <div className="flex-1">
                      <div className="font-medium">
                        {item.name}
                      </div>

                      <div className="text-sm text-gray-500">
                        € {item.unit_price}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          changeQuantity(
                            item.product_id,
                            item.quantity - 1
                          )
                        }
                        className="border rounded-lg px-3 py-1"
                      >
                        -
                      </button>

                      <div className="w-8 text-center">
                        {item.quantity}
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          changeQuantity(
                            item.product_id,
                            item.quantity + 1
                          )
                        }
                        className="border rounded-lg px-3 py-1"
                      >
                        +
                      </button>
                    </div>

                    <div className="font-semibold w-20 text-right">
                      €
                      {(
                        item.quantity *
                        item.unit_price
                      ).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t mt-6 pt-4 flex justify-between text-xl font-bold">
                <div>Totale</div>

                <div>
                  € {total.toFixed(2)}
                </div>
              </div>
            </div>

            <button
              onClick={createOrder}
              className="w-full bg-black text-white rounded-xl p-4 text-lg font-semibold hover:opacity-90 transition"
            >
              Salva Ordine
            </button>
          </div>
        </div>

        {/* ORDERS */}
        <div>
          <h2 className="text-2xl font-semibold mb-6">
            Ordini Live
          </h2>

          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className="border rounded-2xl p-5 shadow-sm"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-xl font-bold">
                      {order.customer_name}
                    </div>

                    <div className="text-gray-600">
                      📞{" "}
                      {order.customer_phone ||
                        "-"}
                    </div>
                  </div>

                  <div className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-semibold">
                    {order.status}
                  </div>
                </div>

                <div className="mt-4 text-sm text-gray-600">
                  ⏰{" "}
                  {order.delivery_time
                    ? new Date(
                        order.delivery_time
                      ).toLocaleString()
                    : "Nessun orario"}
                </div>

                <div className="mt-4 text-2xl font-bold">
                  €
                  {Number(order.total).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}