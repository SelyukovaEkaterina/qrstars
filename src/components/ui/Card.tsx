import { cn } from "@/lib/utils";
import { type ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: "sm" | "md" | "lg";
  id?: string;
}

export default function Card({ children, className, padding = "md", id }: CardProps) {
  return (
    <div
      id={id}
      className={cn(
        "bg-white rounded-xl border border-gray-200 shadow-sm",
        {
          "p-4": padding === "sm",
          "p-6": padding === "md",
          "p-8": padding === "lg",
        },
        className
      )}
    >
      {children}
    </div>
  );
}
