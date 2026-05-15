"use client";

import { useDroppable } from "@dnd-kit/core";

type Props = {
  id: string;
  children: React.ReactNode;
  className?: string;
};

export default function Column({
  id,
  children,
  className,
}: Props) {
  const { setNodeRef } = useDroppable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`
        min-h-full
        rounded-3xl
        p-4
        ${className}
      `}
    >
      {children}
    </div>
  );
}