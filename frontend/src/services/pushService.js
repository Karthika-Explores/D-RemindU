import API from "./api";

const PUBLIC_VAPID_KEY = "BC-jTLSWYgv21b388Xc2Cxh9A5FjvcqDnLgCKc2_oKUiakevMHA-c6b-6DodKA0gK8j2AZpD2T1SzlS-_Opd4PE";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeToPushNotifications() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("Push messaging is not supported by this browser.");
    return;
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    let subscription = await reg.pushManager.getSubscription();

    if (!subscription) {
      console.log("Subscribing to push notifications...");
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
      });
    }

    // Send the subscription to the backend
    await API.post("/push/subscribe", subscription);
    console.log("Push subscription sent to server.");
  } catch (error) {
    console.error("Error subscribing to push notifications:", error);
  }
}

// Call this on logout — removes THIS browser's subscription from the backend
// so this device stops receiving push notifications after sign-out
export async function unsubscribePush() {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.getSubscription();

    if (subscription) {
      // Tell backend to remove this endpoint from MongoDB
      await API.delete("/push/unsubscribe", {
        data: { endpoint: subscription.endpoint }
      });

      // Also unsubscribe at the browser level
      await subscription.unsubscribe();
      console.log("Push subscription removed on logout.");
    }
  } catch (error) {
    // Non-fatal — logout should still proceed even if this fails
    console.warn("Could not remove push subscription on logout:", error);
  }
}
