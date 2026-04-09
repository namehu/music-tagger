import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-[var(--radius-md)] border border-transparent bg-input px-3.5 py-2 text-base shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] transition-[background-color,border-color,box-shadow] outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:bg-[color:var(--surface-container-lowest)] focus-visible:border-[color:var(--ghost-border-strong)] focus-visible:ring-4 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-[color:color-mix(in_srgb,var(--surface-container-low)_88%,transparent)] disabled:opacity-50 aria-invalid:border-destructive/50 aria-invalid:ring-4 aria-invalid:ring-destructive/15 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
