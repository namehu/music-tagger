"use client";

import * as React from "react";
import { Slider as SliderPrimitive } from "@base-ui/react/slider";

import { cn } from "@/lib/utils";

function Slider({
  className,
  ...props
}: SliderPrimitive.Root.Props<number>) {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn("group/slider flex touch-none select-none items-center", className)}
      {...props}
    />
  );
}

function SliderControl({
  className,
  ...props
}: SliderPrimitive.Control.Props) {
  return (
    <SliderPrimitive.Control
      data-slot="slider-control"
      className={cn("relative flex w-full touch-none items-center py-2", className)}
      {...props}
    />
  );
}

function SliderTrack({
  className,
  ...props
}: SliderPrimitive.Track.Props) {
  return (
    <SliderPrimitive.Track
      data-slot="slider-track"
      className={cn("relative h-1 w-full overflow-hidden rounded-full bg-[color:var(--surface-container-high)]", className)}
      {...props}
    />
  );
}

function SliderIndicator({
  className,
  ...props
}: SliderPrimitive.Indicator.Props) {
  return (
    <SliderPrimitive.Indicator
      data-slot="slider-indicator"
      className={cn("absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(135deg,var(--primary-strong),var(--primary))]", className)}
      {...props}
    />
  );
}

function SliderThumb({
  className,
  ...props
}: SliderPrimitive.Thumb.Props) {
  return (
    <SliderPrimitive.Thumb
      data-slot="slider-thumb"
      className={cn(
        "block size-4 rounded-full border-2 border-white bg-primary shadow-[0_8px_24px_-10px_rgba(0,150,250,0.65)] opacity-0 outline-none transition group-hover/slider:opacity-100 group-focus-within/slider:opacity-100 focus-visible:opacity-100 focus-visible:ring-4 focus-visible:ring-ring/40 active:scale-95",
        className,
      )}
      {...props}
    />
  );
}

export { Slider, SliderControl, SliderIndicator, SliderThumb, SliderTrack };
