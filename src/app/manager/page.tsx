"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const pages = [
  {
    title: "Ordini",
    description: "Gestione ordini clienti",
    href: "/orders",
    color: "bg-blue-500",
  },
  {
    title: "Laboratorio Mobile",
    description: "Workflow produzione tablet/mobile",
    href: "/lab",
    color: "bg-yellow-500",
  },
  {
    title: "Laboratorio Web",
    description: "Board drag & drop desktop",
    href: "/labweb",
    color: "bg-orange-500",
  },
  {
    title: "Pasticceria",
    description: "Produzione brioche",
    href: "/pasticceria",
    color: "bg-pink-500",
  },
  {
    title: "Panetteria",
    description: "Produzione pane/focacce/pizze",
    href: "/panetteria",
    color: "bg-green-600",
  },
];

export default function ManagerPage() {
  const router = useRouter();

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    const { data } =
      await supabase.auth.getUser();

    if (!data.user) {
      const currentPath =
        window.location.pathname;

      router.push(
        `/login?redirect=${encodeURIComponent(
          currentPath
        )}`
      );
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="text-sm font-semibold text-gray-500 uppercase tracking-widest">
            CHEPAN TORINO
          </div>

          <h1 className="text-4xl font-black mt-1">
            Manager
          </h1>
        </div>

        <div className="flex gap-3">
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
            className="bg-black text-white px-5 py-3 rounded-2xl font-semibold"
          >
            Fullscreen
          </button>

          <button
            onClick={logout}
            className="bg-red-500 text-white px-5 py-3 rounded-2xl font-semibold"
          >
            Logout
          </button>
        </div>
      </div>

      {/* GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {pages.map((page) => (
          <button
            key={page.href}
            onClick={() =>
              router.push(page.href)
            }
            className="bg-white rounded-3xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition text-left"
          >
            <div
              className={`w-14 h-14 rounded-2xl ${page.color} mb-5`}
            />

            <div className="text-2xl font-bold">
              {page.title}
            </div>

            <div className="text-gray-500 mt-2">
              {page.description}
            </div>

            <div className="mt-6">
              <div className="inline-flex items-center gap-2 font-semibold">
                Apri →
              </div>
            </div>
          </button>
        ))}
      </div>
    </main>
  );
}