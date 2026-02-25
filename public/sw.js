self.addEventListener("fetch", (event) => {
  if (event.request.url.includes("/_next/static/")) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          const clone = response.clone();
          caches.open("static-v1").then((cache) => cache.put(event.request, clone));
          return response;
        });
      })
    );
  }
});

self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title =
    typeof payload.title === "string" && payload.title.trim()
      ? payload.title.trim()
      : "Brosens Family Foundation";
  const body =
    typeof payload.body === "string" && payload.body.trim()
      ? payload.body.trim()
      : "You have a new update.";
  const data = payload.data && typeof payload.data === "object" ? payload.data : {};
  const linkPath =
    typeof data.linkPath === "string" && data.linkPath.startsWith("/") ? data.linkPath : "/";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: {
        ...data,
        linkPath
      },
      tag: typeof payload.tag === "string" ? payload.tag : undefined
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const linkPath =
    typeof event.notification?.data?.linkPath === "string" &&
    event.notification.data.linkPath.startsWith("/")
      ? event.notification.data.linkPath
      : "/";
  const targetUrl = `${self.location.origin}${linkPath}`;

  event.waitUntil(
    self.clients
      .matchAll({
        type: "window",
        includeUncontrolled: true
      })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.startsWith(self.location.origin)) {
            return client.focus().then(() => client.navigate(targetUrl));
          }
        }

        return self.clients.openWindow(targetUrl);
      })
  );
});
