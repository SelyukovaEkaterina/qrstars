"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Star } from "lucide-react";

interface StarRatingProps {
  value: number;
  onChange: (rating: number) => void;
  size?: "sm" | "md" | "lg";
  readonly?: boolean;
}

export default function StarRating({ value, onChange, size = "lg", readonly = false }: StarRatingProps) {
  const [hovered, setHovered] = useState(0);

  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-12 h-12",
  };

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          className={cn("transition-transform duration-150", !readonly && "hover:scale-110")}
          onMouseEnter={() => !readonly && setHovered(star)}
          onMouseLeave={() => !readonly && setHovered(0)}
          onClick={() => onChange(star)}
        >
          <Star
            className={cn(
              sizeClasses[size],
              "transition-colors duration-150",
              (hovered || value) >= star
                ? "fill-yellow-400 text-yellow-400"
                : "fill-gray-200 text-gray-200"
            )}
          />
        </button>
      ))}
    </div>
  );
}
