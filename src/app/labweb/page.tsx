"use client";

export const ssr = false;

import { useRouter } from "next/navigation";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  MouseSensor,
  useSensor,
  useSensors,
  closestCorners,
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

  const [activeOrder, setActiveOrder] = useState<Order | null>(null);

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
          audio.play().catch(() => {});
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

  function handleDragStart(
    event: DragStartEvent
    ) {
      const orderId = event.active.id;

      const order = orders.find(
        (o) => o.id === orderId
      );

      if (order) {
        setActiveOrder(order);
      }
    }


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
    }
  }


  /*
  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    setActiveOrder(null);

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

    //setActiveOrder(null);
  }*/

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over) return;

    const orderId = active.id as string;
    const newStatus = over.id as OrderStatus;

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, status: newStatus }
          : o
      )
    );

    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    if (order.status === newStatus) return;

    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .eq("id", orderId);

    if (error) {
      console.error(error);

      // rollback in caso di errore
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, status: order.status }
            : o
        )
      );
    }
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

  const sensors = useSensors(
    useSensor(MouseSensor),

    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 8,
      },
    }),

    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );


  return (
    <main className="min-h-screen bg-[#f5f1ea] p-3 lg:p-4 overflow-y-auto">
      
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">

        <div className="flex items-center gap-4">

          <div className="w-14 h-14 rounded-2xl bg-[#2d1f16] text-white flex items-center justify-center text-3xl font-black shadow-lg">
            C
          </div>

          <div>
            <h1 className="text-2xl lg:text-4xl font-black tracking-tight">
              CHEPAN
            </h1>

            <div className="text-gray-500 font-medium">
              Laboratorio Live
            </div>
          </div>

        </div>

        <div className="flex gap-3">

          <button
            onClick={() => {
              if (document.fullscreenElement) {
                document.exitFullscreen();
              } else {
                document.documentElement.requestFullscreen();
              }
            }}
            className="bg-[#2d1f16] text-white px-5 py-3 rounded-2xl text-lg font-semibold"
          >
            Fullscreen
          </button>

          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.push("/login");
            }}
            className="bg-red-500 text-white px-5 py-3 rounded-2xl text-lg font-semibold"
          >
            Logout
          </button>

        </div>

      </div>

      {/* BOARD */}
      <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          
        >
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-4 lg:h-[calc(100vh-110px)]">
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
                className={`
                    rounded-3xl
                    p-4
                    lg:overflow-y-auto
                    border
                    border-white/40
                    backdrop-blur-sm
                    shadow-sm
                    ${columnColors[column]}
                  `}
              >
                {/* COLUMN HEADER */}
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-xl lg:text-2xl font-black tracking-tight">
                    {column.replaceAll(
                      "_",
                      " "
                    )}
                  </h2>

                  <div className="bg-[#2d1f16] text-white rounded-2xl px-4 py-2 text-lg font-black shadow">
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
                          className={`
                            border-2
                            ${getUrgencyColor(order.delivery_time)}
                          `}
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

                          <div className={`
                              text-xl lg:text-2xl font-black
                              ${
                                getRemainingTime(order.delivery_time).includes("RITARDO")
                                  ? "text-red-600"
                                  : "text-black"
                              }
                            `}>
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
                                className="bg-white rounded-2xl px-4 py-3 flex justify-between items-center shadow-sm"
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
                          onPointerDown={(e) => {
                            e.stopPropagation();
                          }}
                          onTouchStart={(e) => {
                            e.stopPropagation();
                          }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                          }}
                          onClick={async (e) => {
                            e.stopPropagation();

                            const currentIndex =
                              columns.indexOf(order.status);

                            const nextIndex =
                              currentIndex + 1;

                            if (nextIndex >= columns.length)
                              return;

                            const nextStatus =
                              columns[nextIndex] as OrderStatus;

                            await updateOrderStatus(
                              order.id,
                              nextStatus
                            );

                            setOrders((prev) =>
                              prev.map((o) =>
                                o.id === order.id
                                  ? {
                                      ...o,
                                      status: nextStatus,
                                    }
                                  : o
                              )
                            );
                          }}
                          className="
                            w-full
                            bg-black
                            text-white
                            rounded-2xl
                            py-4
                            text-xl
                            font-bold
                            hover:opacity-90
                            transition
                            touch-manipulation
                          "
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
        <DragOverlay>
          {activeOrder ? (
            <div className="rounded-3xl bg-white shadow-2xl p-5 border-2 border-black rotate-1 scale-105 w-[350px] opacity-95">
              <div className="text-2xl font-bold">
                {activeOrder.customer_name}
              </div>

              <div className="mt-2 text-lg">
                € {Number(activeOrder.total).toFixed(2)}
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </main>
  );
}