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
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-muted", className)}
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
      className={cn("absolute inset-y-0 left-0 rounded-full bg-foreground", className)}
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
        "block size-4 rounded-full border border-background bg-foreground shadow-sm outline-none transition focus-visible:ring-4 focus-visible:ring-ring/40 active:scale-95",
        className,
      )}
      {...props}
    />
  );
}

export { Slider, SliderControl, SliderIndicator, SliderThumb, SliderTrack };
