"use client";

import * as React from "react";
import { cn } from "../../lib/utils";
import { Shimmer } from "./shimmer";

export type Variant = "default" | "pink" | "light";
export type Size = "lg" | "xl" | "xxl" | "xxxl";
export type Weight = "thin" | "base" | "semi" | "bold" | "black";

export interface GradientHeadingProps
  extends React.HTMLAttributes<HTMLHeadingElement> {
  variant?: Variant;
  size?: Size;
  weight?: Weight;
  shimmer?: boolean;
  as?: keyof JSX.IntrinsicElements;
}

const sizeClasses: Record<Size, string> = {
  lg: "text-lg",
  xl: "text-xl",
  xxl: "text-2xl",
  xxxl: "text-3xl",
};

const weightClasses: Record<Weight, string> = {
  thin: "font-light",
  base: "font-normal",
  semi: "font-semibold",
  bold: "font-bold",
  black: "font-black",
};

const variantClasses: Record<Variant, string> = {
  // Use tokens where possible; fall back to harmonious palette
  default:
    "bg-gradient-to-r from-primary/90 via-primary/70 to-primary/50 text-transparent bg-clip-text",
  pink:
    "bg-gradient-to-r from-fuchsia-500 via-pink-400 to-rose-400 text-transparent bg-clip-text",
  light:
    "bg-gradient-to-r from-foreground via-foreground/70 to-foreground/50 text-transparent bg-clip-text",
};

export const GradientHeading = React.forwardRef<HTMLHeadingElement, GradientHeadingProps>(
  (
    {
      children,
      className,
      variant = "default",
      size = "xl",
      weight = "semi",
      shimmer = true,
      as = "h3",
      ...props
    },
    ref
  ) => {
    const Tag = as as any;
    const content = shimmer && typeof children === "string" ? (
      <Shimmer className={cn(variantClasses[variant])}>{children}</Shimmer>
    ) : (
      <span className={cn(variantClasses[variant])}>{children}</span>
    );

    return (
      <Tag
        ref={ref}
        className={cn(
          "tracking-tight",
          sizeClasses[size],
          weightClasses[weight],
          className
        )}
        {...props}
      >
        {content}
      </Tag>
    );
  }
);

GradientHeading.displayName = "GradientHeading";

export default GradientHeading;



