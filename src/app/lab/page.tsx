"use client";

export const ssr = false;

import { useRouter } from "next/navigation";
import { 
  DndContext,
  DragEndEvent,
} from "@dnd-kit/core";

import Column from "@/components/lab/Column";
import OrderCard from "@/components/lab/OrderCard";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type OrderStatus =
  | "NUOVO"
  | "IN_PREPARAZIONE"
  | "PRONTO"
  | "CONSEGNATO";

type OrderItem = {
  quantity: number;
  unit_price: number;
  products: {
    name: string;
  };
};

type Order = {
  id: string;
  customer_name: string;
  customer_phone: string;
  delivery_time: string;
  status: OrderStatus;
  total: number;
  created_at: string;
  order_items: OrderItem[];
};

const columns: OrderStatus[] = [
  "NUOVO",
  "IN_PREPARAZIONE",
  "PRONTO",
  "CONSEGNATO",
];

const columnColors: Record<
  OrderStatus,
  string
> = {
  NUOVO: "bg-blue-100",
  IN_PREPARAZIONE: "bg-yellow-100",
  PRONTO: "bg-green-100",
  CONSEGNATO: "bg-gray-200",
};



export default function LabPage() {

  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>(
    []
  );

  useEffect(() => {
    const audio = new Audio(
      "/notification.mp3"
    );

    checkUser();
    loadOrders();

    const channel = supabase
      .channel("lab-orders")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        () => {
          audio.play();
          loadOrders();
        }
      )
      .subscribe((status) => {
        console.log(
          "Realtime status:",
          status
        );
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

  async function loadOrders() {
    const { data, error } = await supabase
      .from("orders")
      .select(`
        *,
        order_items (
          quantity,
          unit_price,
          products (
            name
          )
        )
      `)
      .order("created_at", {
        ascending: false,
      });

    console.log("ORDERS:", data);
    console.log("ERROR:", error);

    if (data) {
      setOrders(data as Order[]);
    }
  }

  async function updateOrderStatus(
    orderId: string,
    status: OrderStatus
  ) {
    const { error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", orderId);

    if (error) {
      console.error(error);
      return;
    }

    loadOrders();
  }

  async function handleDragEnd(
    event: DragEndEvent
  ) {
    const { active, over } = event;

    if (!over) return;

    const orderId = active.id as string;
    const newStatus =
      over.id as OrderStatus;

    const order = orders.find(
      (o) => o.id === orderId
    );

    if (!order) return;

    if (order.status === newStatus)
      return;

    await updateOrderStatus(
      orderId,
      newStatus
    );
  }

  function getUrgencyColor(
    deliveryTime: string
  ) {
    if (!deliveryTime)
      return "border-gray-200 bg-white";

    const now = new Date();
    const delivery = new Date(
      deliveryTime
    );

    const diffMinutes =
      (delivery.getTime() -
        now.getTime()) /
      1000 /
      60;

    if (diffMinutes < 0) {
      return "border-red-500 bg-red-50";
    }

    if (diffMinutes <= 15) {
      return "border-orange-500 bg-orange-50";
    }

    if (diffMinutes <= 30) {
      return "border-yellow-400 bg-yellow-50";
    }

    return "border-gray-200 bg-white";
  }

  function getRemainingTime(
    deliveryTime: string
  ) {
    if (!deliveryTime) return "-";

    const now = new Date();
    const delivery = new Date(
      deliveryTime
    );

    const diff =
      delivery.getTime() - now.getTime();

    const minutes = Math.floor(
      diff / 1000 / 60
    );

    if (minutes < 0) {
      return `RITARDO ${Math.abs(
        minutes
      )} min`;
    }

    return `${minutes} min`;
  }

  return (
    <main className="h-screen overflow-hidden bg-gray-100 p-4">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-4xl font-bold">
          Laboratorio
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

        <button
          onClick={() => {
            if (
              document.fullscreenElement
            ) {
              document.exitFullscreen();
            } else {
              document.documentElement.requestFullscreen();
            }
          }}
          className="bg-black text-white px-5 py-3 rounded-2xl text-lg font-semibold"
        >
          Fullscreen
        </button>
      </div>

      {/* BOARD */}
      <DndContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-4 gap-4 h-[calc(100vh-100px)]">
          {columns.map((column) => {
            const columnOrders =
              orders.filter(
                (order) =>
                  order.status === column
              );

            return (
              <Column
                key={column}
                id={column}
                className={`rounded-3xl p-4 overflow-y-auto ${columnColors[column]}`}
              >
                {/* COLUMN HEADER */}
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-2xl font-bold">
                    {column.replaceAll(
                      "_",
                      " "
                    )}
                  </h2>

                  <div className="bg-black text-white rounded-full px-4 py-2 text-lg font-bold">
                    {
                      columnOrders.length
                    }
                  </div>
                </div>

                {/* CARDS */}
                <div className="space-y-4">
                  {columnOrders.map(
                    (order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        
                      >
                        {/* TOP */}
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="text-2xl font-bold">
                              {
                                order.customer_name
                              }
                            </div>

                            <div className="text-gray-500 mt-1">
                              📞{" "}
                              {
                                order.customer_phone
                              }
                            </div>
                          </div>

                          <div className="text-3xl font-bold">
                            €
                            {Number(
                              order.total
                            ).toFixed(2)}
                          </div>
                        </div>

                        {/* TIME */}
                        <div className="mt-4 flex items-center justify-between">
                          <div className="text-lg font-semibold">
                            ⏰{" "}
                            {order.delivery_time
                              ? new Date(
                                  order.delivery_time
                                ).toLocaleTimeString(
                                  [],
                                  {
                                    hour:
                                      "2-digit",
                                    minute:
                                      "2-digit",
                                  }
                                )
                              : "-"}
                          </div>

                          <div className="text-lg font-bold">
                            {getRemainingTime(
                              order.delivery_time
                            )}
                          </div>
                        </div>

                        {/* PRODUCTS */}
                        <div className="mt-5 space-y-2">
                          {order.order_items?.map(
                            (
                              item,
                              index
                            ) => (
                              <div
                                key={
                                  index
                                }
                                className="bg-white rounded-xl px-3 py-2 flex justify-between"
                              >
                                <div className="font-semibold">
                                  {
                                    item
                                      .products
                                      .name
                                  }
                                </div>

                                <div className="text-lg">
                                  x{" "}
                                  {
                                    item.quantity
                                  }
                                </div>
                              </div>
                            )
                          )}
                        </div>

                        {/* ACTION */}
                        <div className="mt-5">
                          <button
                            onClick={async () => {
                              const nextIndex =
                                columns.indexOf(
                                  order.status
                                ) + 1;

                              if (
                                nextIndex >=
                                columns.length
                              )
                                return;

                              await updateOrderStatus(
                                order.id,
                                columns[
                                  nextIndex
                                ]
                              );
                            }}
                            className="w-full bg-black text-white rounded-xl py-4 text-xl font-semibold"
                          >
                            Avanza Stato
                          </button>
                        </div>
                      </OrderCard>
                    )
                  )}
                </div>
              </Column>
            );
          })}
        </div>
      </DndContext>
    </main>
  );
}