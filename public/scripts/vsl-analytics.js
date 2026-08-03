(() => {
  "use strict";

  const script = document.currentScript;

  const config = {
    videoId: script?.dataset.videoId || null,
    vslId: script?.dataset.vslId || null,
    productId: script?.dataset.productId || null,
    pitchSecond: Number(script?.dataset.pitchSecond || 0),
  };

  if (!config.videoId || !config.vslId) {
    console.warn("[vsl-analytics] configuração incompleta");
    return;
  }

  const VISITOR_KEY = "canva_analytics_visitor_id";
  const SESSION_KEY = "canva_analytics_session_id";

  function createId(prefix) {
    if (crypto?.randomUUID) {
      return `${prefix}_${crypto.randomUUID()}`;
    }

    return `${prefix}_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}`;
  }

  function getOrCreateVisitorId() {
    let id = localStorage.getItem(VISITOR_KEY);

    if (!id) {
      id = createId("visitor");
      localStorage.setItem(VISITOR_KEY, id);
    }

    return id;
  }

  function createSessionId() {
    const id = createId("session");

    sessionStorage.setItem(SESSION_KEY, id);

    return id;
  }

  function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  const visitorKey = getOrCreateVisitorId();
  const sessionKey =
    sessionStorage.getItem(SESSION_KEY) || createSessionId();

  let sessionReady = false;
  let eventQueue = [];
  let lastSecond = null;
  let maxReachedSecond = 0;
  let pitchSent = false;

  async function createSession() {
    const payload = {
      visitor_key: visitorKey,
      session_key: sessionKey,

      product_id: config.productId,
      vsl_id: config.vslId,
      video_id: config.videoId,

      page_url: window.location.href,
      page_path: window.location.pathname,
      referrer: document.referrer || null,

      utm_source: getQueryParam("utm_source"),
      utm_medium: getQueryParam("utm_medium"),
      utm_campaign: getQueryParam("utm_campaign"),
      utm_content: getQueryParam("utm_content"),
      utm_term: getQueryParam("utm_term"),
      utm_id: getQueryParam("utm_id"),

      fbclid: getQueryParam("fbclid"),

      campaign_id:
        getQueryParam("campaign_id") ||
        getQueryParam("utm_campaign"),

      adset_id:
        getQueryParam("adset_id") ||
        getQueryParam("utm_term"),

      ad_id:
        getQueryParam("ad_id") ||
        getQueryParam("utm_content"),

      screen_width: window.screen?.width || null,
      screen_height: window.screen?.height || null,
      viewport_width: window.innerWidth || null,
      viewport_height: window.innerHeight || null,

      language: navigator.language || null,

      timezone:
        Intl.DateTimeFormat()
          .resolvedOptions()
          .timeZone || null,

      playback_start_mode: "unknown",
    };

    try {
      const response = await fetch("/api/analytics/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        keepalive: true,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      sessionReady = true;
      flushEvents();
    } catch (error) {
      console.warn(
        "[vsl-analytics] falha ao criar sessão:",
        error
      );
    }
  }

  function makeEvent(type, data = {}) {
    return {
      event_key: createId("event"),
      event_type: type,
      occurred_at: new Date().toISOString(),
      ...data,
    };
  }

  function queueEvent(type, data = {}) {
    eventQueue.push(makeEvent(type, data));

    if (eventQueue.length >= 5) {
      flushEvents();
    }
  }

  async function flushEvents(useBeacon = false) {
    if (!sessionReady || eventQueue.length === 0) {
      return;
    }

    const events = eventQueue.splice(0, eventQueue.length);

    const payload = {
      session_key: sessionKey,
      events,
    };

    const body = JSON.stringify(payload);

    try {
      if (useBeacon && navigator.sendBeacon) {
        const blob = new Blob([body], {
          type: "application/json",
        });

        const sent = navigator.sendBeacon(
          "/api/analytics/events",
          blob
        );

        if (!sent) {
          eventQueue.unshift(...events);
        }

        return;
      }

      const response = await fetch("/api/analytics/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        keepalive: true,
        body,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      eventQueue.unshift(...events);

      console.warn(
        "[vsl-analytics] falha ao enviar eventos:",
        error
      );
    }
  }

  function extractSeconds(data) {
    if (!data || typeof data !== "object") return null;

    const keys = [
      "currentTime",
      "time",
      "seconds",
      "position",
      "current_time",
    ];

    for (const key of keys) {
      if (
        key in data &&
        Number.isFinite(Number(data[key]))
      ) {
        return Number(data[key]);
      }
    }

    if (
      data.payload &&
      typeof data.payload === "object"
    ) {
      for (const key of keys) {
        if (
          key in data.payload &&
          Number.isFinite(Number(data.payload[key]))
        ) {
          return Number(data.payload[key]);
        }
      }
    }

    return null;
  }

  function handleVideoTime(second) {
    if (!Number.isFinite(second) || second < 0) {
      return;
    }

    const currentSecond =
      Math.round(second * 1000) / 1000;

    const previousSecond = lastSecond;

    if (currentSecond > maxReachedSecond) {
      maxReachedSecond = currentSecond;
    }

    if (previousSecond === null) {
      lastSecond = currentSecond;

      queueEvent("video_progress", {
        current_second: currentSecond,
        max_reached_second: maxReachedSecond,
      });

      return;
    }

    const delta = currentSecond - previousSecond;

    const isNormalPlayback =
      delta > 0 &&
      delta <= 3;

    const seekDetected =
      Math.abs(delta) > 3;

    queueEvent("video_progress", {
      current_second: currentSecond,
      previous_second: previousSecond,
      max_reached_second: maxReachedSecond,

      watched_seconds_delta:
        isNormalPlayback ? delta : 0,

      watched_from_second:
        isNormalPlayback ? previousSecond : null,

      watched_to_second:
        isNormalPlayback ? currentSecond : null,

      seek_detected: seekDetected,
    });

    if (
      config.pitchSecond > 0 &&
      currentSecond >= config.pitchSecond &&
      !pitchSent
    ) {
      pitchSent = true;

      queueEvent("pitch_reached", {
        current_second: currentSecond,
        max_reached_second: maxReachedSecond,
      });
    }

    lastSecond = currentSecond;
  }

  window.addEventListener("message", (event) => {
    try {
      const data =
        typeof event.data === "string"
          ? JSON.parse(event.data)
          : event.data;

      const second = extractSeconds(data);

      if (second !== null) {
        handleVideoTime(second);
      }
    } catch (_) {}
  });

  window.addEventListener("beforeunload", () => {
    queueEvent("page_exit", {
      current_second: lastSecond,
      max_reached_second: maxReachedSecond,
    });

    flushEvents(true);
  });

  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.visibilityState === "hidden") {
        flushEvents(true);
      }
    }
  );

  setInterval(() => {
    flushEvents();
  }, 10000);

  createSession();
})();