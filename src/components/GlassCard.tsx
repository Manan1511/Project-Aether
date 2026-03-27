"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function GlassCard({ className, children, ...props }: HTMLMotionProps<"div">) {
  return (
    <motion.div
      className={cn("glass-card p-6", className)}
      whileHover={{ 
        y: -4, 
        scale: 1.01,
        boxShadow: "0 16px 40px -8px rgba(0,0,0,0.2)"
      }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
