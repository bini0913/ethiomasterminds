import type { LucideIcon } from "lucide-react"
import { AlertCircle, Inbox, LoaderCircle, WifiOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type StateTone = "default" | "error" | "offline"

const toneStyles: Record<StateTone, string> = {
  default: "bg-muted text-muted-foreground",
  error: "bg-destructive/10 text-destructive",
  offline: "bg-warning/10 text-warning",
}

interface StatusStateProps {
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  icon?: LucideIcon
  tone?: StateTone
  className?: string
}

function StatusState({
  title,
  description,
  actionLabel,
  onAction,
  icon: Icon = Inbox,
  tone = "default",
  className,
}: StatusStateProps) {
  return (
    <section className={cn("mx-auto grid w-full max-w-md justify-items-center gap-3 px-4 py-8 text-center", className)} aria-live={tone === "error" ? "assertive" : "polite"}>
      <div className={cn("grid h-12 w-12 place-items-center rounded-pill", toneStyles[tone])}>
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <div className="grid gap-1">
        <h2 className="font-display text-heading-sm font-bold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actionLabel && onAction && <Button type="button" variant={tone === "error" ? "destructive" : "outline"} onClick={onAction}>{actionLabel}</Button>}
    </section>
  )
}

function LoadingState({ label = "Loading content…", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex min-h-24 items-center justify-center gap-3 px-4 py-6 text-sm text-muted-foreground", className)} role="status">
      <LoaderCircle className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

const EmptyState = (props: Omit<StatusStateProps, "icon" | "tone">) => <StatusState {...props} icon={Inbox} />
const ErrorState = (props: Omit<StatusStateProps, "icon" | "tone">) => <StatusState {...props} icon={AlertCircle} tone="error" />
const OfflineState = (props: Omit<StatusStateProps, "icon" | "tone">) => <StatusState {...props} icon={WifiOff} tone="offline" />

export { EmptyState, ErrorState, LoadingState, OfflineState, StatusState }
