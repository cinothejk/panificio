"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Product = {
  id: string;
  name: string;
  price: number;
};

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    getProducts();
  }, []);

  async function getProducts() {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("name");

    if (error) {
      console.error(error);
      return;
    }

    setProducts(data);
  }

  return (
    <main className="p-10">
      <h1 className="text-3xl font-bold mb-6">
        Panificio App
      </h1>

      <div className="space-y-2">
        {products.map((product) => (
          <div
            key={product.id}
            className="border rounded-xl p-4"
          >
            <div className="font-semibold">
              {product.name}
            </div>

            <div>
              € {product.price}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}