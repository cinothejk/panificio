"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Props = {
  title: string;
  type: "PASTICCERIA" | "PANETTERIA";
};

type RawItem = {
  quantity: number;
  weight: number | null;

  products: {
    id: string;
    name: string;
    category: string;
    price_type: "FIXED" | "WEIGHT";
  };

  orders: {
    delivery_time: string;
  };
};

type ProductionItem = {
  product_id: string;
  name: string;
  category: string;
  price_type: "FIXED" | "WEIGHT";
  total_quantity: number;
  total_weight: number;
};

export default function ProductionPage({
  title,
  type,
}: Props) {
  const [items, setItems] = useState<
    ProductionItem[]
  >([]);

  const [selectedDate, setSelectedDate] =
    useState(
      new Date().toISOString().split("T")[0]
    );

  useEffect(() => {
    loadProduction();
  }, [selectedDate]);

  async function loadProduction() {
    const { data, error } = await supabase
      .from("order_items")
      .select(`
        quantity,
        weight,

        products (
          id,
          name,
          category,
          price_type
        ),

        orders (
          delivery_time
        )
      `);

    if (error || !data) {
      console.error(error);
      return;
    }

    const typedData = data as unknown as RawItem[];

    const filtered = typedData.filter(
      (item) => {
        if (
          !item.orders?.delivery_time
        ) {
          return false;
        }

        const deliveryDate =
          item.orders.delivery_time.split(
            "T"
          )[0];

        const dateMatch =
          deliveryDate === selectedDate;

        const isBrioche =
          item.products.category ===
          "BRIOCHE";

        const typeMatch =
          type === "PASTICCERIA"
            ? isBrioche
            : !isBrioche;

        return dateMatch && typeMatch;
      }
    );

    const map = new Map<
      string,
      ProductionItem
    >();

    for (const item of filtered) {
      const key = item.products.id;

      if (!map.has(key)) {
        map.set(key, {
          product_id: key,
          name: item.products.name,
          category:
            item.products.category,
          price_type:
            item.products.price_type,
          total_quantity: 0,
          total_weight: 0,
        });
      }

      const existing = map.get(key)!;

      if (
        item.products.price_type ===
        "WEIGHT"
      ) {
        existing.total_weight +=
          item.weight || 0;
      } else {
        existing.total_quantity +=
          item.quantity || 0;
      }
    }

    setItems(Array.from(map.values()));
  }

  const grouped = useMemo(() => {
    const groups: Record<
      string,
      ProductionItem[]
    > = {};

    items.forEach((item) => {
      if (!groups[item.category]) {
        groups[item.category] = [];
      }

      groups[item.category].push(item);
    });

    return groups;
  }, [items]);

  return (
    <main className="min-h-screen bg-[#f5f1eb] p-6">

      {/* HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">

        <div>
          <h1 className="text-4xl font-black text-[#3E2723]">
            {title}
          </h1>

          <div className="text-[#6D4C41] mt-2">
            CHEPAN Torino
          </div>
        </div>

        <input
          type="date"
          value={selectedDate}
          onChange={(e) =>
            setSelectedDate(
              e.target.value
            )
          }
          className="border-2 border-[#D7CCC8] bg-white rounded-2xl px-4 py-3 text-lg"
        />
      </div>

      {/* EMPTY */}
      {items.length === 0 && (
        <div className="bg-white rounded-3xl p-10 text-center text-gray-500 text-xl shadow-sm">
          Nessuna produzione per questa data
        </div>
      )}

      {/* GROUPS */}
      <div className="space-y-8">

        {Object.entries(grouped).map(
          ([category, products]) => (
            <div
              key={category}
              className="bg-white rounded-3xl p-6 shadow-sm"
            >

              {/* CATEGORY */}
              <div className="flex items-center justify-between mb-6">

                <h2 className="text-3xl font-black text-[#3E2723]">
                  {category}
                </h2>

                <div className="bg-[#5D4037] text-white px-4 py-2 rounded-full font-bold">
                  {products.length} prodotti
                </div>
              </div>

              {/* PRODUCTS */}
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">

                {products.map((item) => (
                  <div
                    key={item.product_id}
                    className="border-2 border-[#EFEBE9] rounded-3xl p-5 bg-[#fffaf5]"
                  >

                    <div className="text-2xl font-bold text-[#3E2723]">
                      {item.name}
                    </div>

                    <div className="mt-5">

                      {item.price_type ===
                      "WEIGHT" ? (
                        <div>

                          <div className="text-sm text-gray-500">
                            Peso Totale
                          </div>

                          <div className="text-5xl font-black text-[#BF360C]">
                            {item.total_weight.toFixed(
                              2
                            )}{" "}
                            kg
                          </div>
                        </div>
                      ) : (
                        <div>

                          <div className="text-sm text-gray-500">
                            Quantità
                          </div>

                          <div className="text-5xl font-black text-[#1B5E20]">
                            {
                              item.total_quantity
                            }
                          </div>
                        </div>
                      )}

                    </div>

                  </div>
                ))}

              </div>
            </div>
          )
        )}

      </div>
    </main>
  );
}