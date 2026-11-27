import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

function isSafeInternalRoute(route: unknown): route is string {
  return typeof route === "string"
    && route.length > 0
    && route.length <= 2048
    && route.startsWith("/")
    && !route.startsWith("//")
    && !route.includes("\\")
    && !/[\u0000-\u001f\u007f]/.test(route);
}

export default function NotificationRouteHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (event: Event) => {
      const route = (event as CustomEvent<unknown>).detail;
      if (isSafeInternalRoute(route)) navigate(route);
    };
    window.addEventListener("master-minds-notification-route", handler);
    return () => window.removeEventListener("master-minds-notification-route", handler);
  }, [navigate]);

  return null;
}
