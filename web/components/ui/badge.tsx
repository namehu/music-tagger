import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2.5 py-0.5 text-[0.72rem] font-semibold whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-[color:var(--primary-container)] text-[color:var(--primary-container-foreground)] [a]:hover:brightness-95",
        secondary:
          "bg-[color:var(--secondary-container)] text-[color:var(--secondary-container-foreground)] [a]:hover:brightness-95",
        destructive:
          "bg-[color:color-mix(in_srgb,var(--destructive)_12%,white)] text-destructive focus-visible:ring-destructive/20 [a]:hover:bg-[color:color-mix(in_srgb,var(--destructive)_18%,white)]",
        outline:
          "border-[color:var(--ghost-border)] bg-white/56 text-foreground [a]:hover:bg-[color:var(--surface-container-low)] [a]:hover:text-foreground",
        ghost:
          "text-muted-foreground hover:bg-[color:var(--surface-container-low)] hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
