"use client";

import * as React from "react";
import { CheckIcon, MinusIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type CheckboxState = boolean | "indeterminate";

type CheckboxProps = Omit<React.ComponentProps<"input">, "type" | "checked"> & {
  checked?: CheckboxState;
};

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ checked = false, className, disabled, ...props }, forwardedRef) => {
    const innerRef = React.useRef<HTMLInputElement>(null);

    React.useImperativeHandle(forwardedRef, () => innerRef.current as HTMLInputElement);

    React.useEffect(() => {
      if (!innerRef.current) {
        return;
      }

      innerRef.current.indeterminate = checked === "indeterminate";
    }, [checked]);

    return (
      <label
        className={cn(
          "group/checkbox relative inline-flex size-4 shrink-0 items-center justify-center",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <input
          {...props}
          ref={innerRef}
          type="checkbox"
          disabled={disabled}
          checked={checked === true}
          aria-checked={checked === "indeterminate" ? "mixed" : checked}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className={cn(
            "flex size-4 items-center justify-center rounded-[5px] border border-border bg-background text-primary transition-all peer-focus-visible:border-ring peer-focus-visible:ring-3 peer-focus-visible:ring-ring/40 peer-checked:border-primary/50 peer-checked:bg-primary/10 peer-disabled:opacity-50",
            className,
          )}
        >
          {checked === "indeterminate" ? (
            <MinusIcon className="size-3" />
          ) : checked ? (
            <CheckIcon className="size-3" />
          ) : null}
        </span>
      </label>
    );
  },
);

Checkbox.displayName = "Checkbox";
