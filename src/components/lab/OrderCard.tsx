"use client";

import {
  useDraggable,
} from "@dnd-kit/core";

type Props = {
  order: {
    id: string;
  };

  children: React.ReactNode;

  className?: string;
};

export default function OrderCard({
  order,
  children,
  className = "",
}: Props) {

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
  } = useDraggable({
    id: order.id,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        touch-none
        rounded-3xl
        shadow-sm
        p-5
        bg-white
        transition
        ${className}
      `}
    >
      {children}
    </div>
  );
}