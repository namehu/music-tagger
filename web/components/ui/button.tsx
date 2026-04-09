"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap text-foreground transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-[linear-gradient(135deg,var(--primary-strong),var(--primary))] text-primary-foreground shadow-[0_20px_48px_-24px_rgba(0,150,250,0.55)] [a]:hover:brightness-105",
        outline:
          "border-[color:var(--ghost-border)] bg-white/56 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] hover:border-[color:var(--ghost-border-strong)] hover:bg-white/84 aria-expanded:bg-white/88",
        secondary:
          "bg-[color:var(--secondary-container)] text-[color:var(--secondary-container-foreground)] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] hover:bg-[color:color-mix(in_srgb,var(--secondary-container)_84%,white)] aria-expanded:bg-[color:var(--secondary-container)]",
        ghost:
          "bg-transparent hover:bg-[color:var(--accent)] hover:text-[color:var(--accent-foreground)] aria-expanded:bg-[color:var(--accent)] aria-expanded:text-[color:var(--accent-foreground)]",
        destructive:
          "bg-[color:color-mix(in_srgb,var(--destructive)_12%,white)] text-destructive hover:bg-[color:color-mix(in_srgb,var(--destructive)_18%,white)] focus-visible:border-destructive/40 focus-visible:ring-destructive/20",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-10 gap-1.5 px-4 has-data-[icon=inline-end]:pr-3.5 has-data-[icon=inline-start]:pl-3.5",
        xs: "h-7 gap-1 rounded-full px-2.5 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-full px-3 text-[0.8rem] has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-2 px-5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        icon: "size-8",
        "icon-xs":
          "size-7 rounded-full [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-8 rounded-full",
        "icon-lg": "size-10 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
