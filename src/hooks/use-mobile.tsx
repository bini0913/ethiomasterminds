import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(false)

  React.useEffect(() => {
    // Resize events are supported by older Android WebViews that may not
    // implement matchMedia or MediaQueryList.addEventListener.
    const update = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    update()
    window.addEventListener("resize", update, { passive: true })
    return () => window.removeEventListener("resize", update)
  }, [])

  return isMobile
}
