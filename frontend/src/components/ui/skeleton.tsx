import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("rounded-xl bg-slate-100", className)}
      {...props}
    />
  )
}

export { Skeleton }
