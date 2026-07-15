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
      pathname.startsWith("/therapist");

    const manifestHref = isTherapist
      ? "/manifest-therapist.webmanifest"
      : "/manifest-admin.webmanifest";
    const appleIcon = isTherapist
      ? "/therapist-apple-touch.png"
      : "/apple-touch-icon.png";
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
  }, [pathname]);
}
