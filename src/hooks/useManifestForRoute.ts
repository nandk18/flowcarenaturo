import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Swap the PWA manifest, apple-touch-icon and app title based on the
 * current route so installing from a therapist page yields a separate
 * "FlowCare Therapist" home-screen app.
 */
export function useManifestForRoute() {
  const { pathname } = useLocation();

  useEffect(() => {
    const isTherapist =
      pathname.startsWith("/therapist-login") ||
      pathname.startsWith("/therapist-app") ||
      pathname.startsWith("/therapist") ||
      pathname.startsWith("/treatment/therapist");

    const manifestHref = isTherapist
      ? "/manifest-therapist.webmanifest?v=therapist-2"
      : "/manifest-admin.webmanifest?v=admin-2";
    const appleIcon = isTherapist
      ? "/therapist-apple-touch.png"
      : "/apple-touch-icon.png";
    const icon192 = isTherapist ? "/therapist-icon-192.png" : "/flowcare-icon-192.png";
    const icon512 = isTherapist ? "/therapist-icon-512.png" : "/flowcare-icon-512.png";
    const title = isTherapist ? "FlowCare Therapist" : "FlowCare";

    let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "manifest";
      document.head.appendChild(link);
    }
    if (link.getAttribute("href") !== manifestHref) link.setAttribute("href", manifestHref);

    let apple = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    if (!apple) {
      apple = document.createElement("link");
      apple.rel = "apple-touch-icon";
      document.head.appendChild(apple);
    }
    if (apple.getAttribute("href") !== appleIcon) apple.setAttribute("href", appleIcon);

    const appleTitle = document.querySelector<HTMLMetaElement>(
      'meta[name="apple-mobile-web-app-title"]',
    );
    if (appleTitle && appleTitle.content !== title) appleTitle.content = title;
    document.title = title;

    document.querySelectorAll<HTMLLinkElement>('link[rel="icon"][sizes]').forEach((icon) => {
      const sizes = icon.getAttribute("sizes");
      if (sizes === "192x192" && icon.getAttribute("href") !== icon192) icon.setAttribute("href", icon192);
      if (sizes === "512x512" && icon.getAttribute("href") !== icon512) icon.setAttribute("href", icon512);
    });
  }, [pathname]);
}
