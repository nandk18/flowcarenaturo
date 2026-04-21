export const requestPushPermission = async (): Promise<boolean> => {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;

  try {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  } catch {
    return false;
  }
};

export const triggerPushNotification = (params: {
  id: string;
  title: string;
  body: string;
  url?: string;
}) => {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  try {
    const notification = new Notification(params.title, {
      body: params.body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: params.id,
    });

    notification.onclick = () => {
      window.focus();
      if (params.url) window.location.href = params.url;
      notification.close();
    };

    setTimeout(() => notification.close(), 8000);
  } catch {
    // Some browsers throw if not in a user-gesture context — ignore
  }
};
