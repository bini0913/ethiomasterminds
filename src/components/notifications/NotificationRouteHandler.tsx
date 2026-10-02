import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function NotificationRouteHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (event: Event) => {
      const route = (event as CustomEvent<string>).detail;
      if (typeof route === "string" && route.startsWith("/")) navigate(route);
    };
    window.addEventListener("master-minds-notification-route", handler);
    return () => window.removeEventListener("master-minds-notification-route", handler);
  }, [navigate]);

  return null;
}
