const express = require("express");
const crypto = require("crypto");
const pool = require("../db");

const router = express.Router();

const MAX_EVENTS_PER_REQUEST = 100;

function cleanText(value, maxLength = 2000) {
  if (value === null || value === undefined) return null;

  const text = String(value).trim();
  if (!text) return null;

  return text.slice(0, maxLength);
}

function cleanNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    return null;
  }

  return number;
}

function cleanBoolean(value) {
  if (typeof value === "boolean") return value;
  return null;
}

function cleanDate(value) {
  if (!value) return new Date();

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return new Date();
  }

  return date;
}

function isValidKey(value) {
  return (
    typeof value === "string" &&
    value.trim().length >= 8 &&
    value.trim().length <= 120
  );
}

function normalizeStartMode(value) {
  const allowed = ["new", "restart", "resume", "unknown"];

  return allowed.includes(value) ? value : null;
}

function normalizeEvent(rawEvent) {
  const eventType = cleanText(rawEvent?.event_type, 60);

  if (!eventType) {
    return null;
  }

  const watchedFrom = cleanNumber(rawEvent.watched_from_second);
  const watchedTo = cleanNumber(rawEvent.watched_to_second);

  const validRange =
    watchedFrom !== null &&
    watchedTo !== null &&
    watchedTo > watchedFrom;

  return {
    eventKey:
      cleanText(rawEvent.event_key, 120) ||
      crypto.randomUUID(),

    eventType,

    currentSecond:
      cleanNumber(rawEvent.current_second),

    previousSecond:
      cleanNumber(rawEvent.previous_second),

    maxReachedSecond:
      cleanNumber(rawEvent.max_reached_second),

    watchedSecondsDelta:
      cleanNumber(rawEvent.watched_seconds_delta),

    watchedFromSecond:
      validRange ? watchedFrom : null,

    watchedToSecond:
      validRange ? watchedTo : null,

    playbackRate:
      cleanNumber(rawEvent.playback_rate),

    muted:
      cleanBoolean(rawEvent.muted),

    fullscreen:
      cleanBoolean(rawEvent.fullscreen),

    seekDetected:
      rawEvent.seek_detected === true,

    eventData:
      rawEvent.event_data &&
      typeof rawEvent.event_data === "object" &&
      !Array.isArray(rawEvent.event_data)
        ? rawEvent.event_data
        : {},

    occurredAt:
      cleanDate(rawEvent.occurred_at),
  };
}

/**
 * POST /api/analytics/session
 *
 * Reconhece/cria o visitante e abre uma sessão.
 */
router.post("/session", async (req, res) => {
  const client = await pool.connect();

  try {
    const body = req.body || {};

    const visitorKey = cleanText(body.visitor_key, 120);
    const sessionKey = cleanText(body.session_key, 120);
    const vslId = cleanText(body.vsl_id, 120);
    const videoId = cleanText(body.video_id, 160);

    if (
      !isValidKey(visitorKey) ||
      !isValidKey(sessionKey) ||
      !vslId ||
      !videoId
    ) {
      return res.status(400).json({
        ok: false,
        error: "invalid_session_payload",
      });
    }

    await client.query("BEGIN");

    const visitorResult = await client.query(
      `
      INSERT INTO analytics_visitors (
        visitor_key,
        first_seen_at,
        last_seen_at
      )
      VALUES ($1, NOW(), NOW())

      ON CONFLICT (visitor_key)
      DO UPDATE SET
        last_seen_at = NOW()

      RETURNING id, visitor_key
      `,
      [visitorKey]
    );

    const visitor = visitorResult.rows[0];

    const sessionResult = await client.query(
      `
      INSERT INTO analytics_sessions (
        session_key,
        visitor_id,

        product_id,
        vsl_id,
        video_id,

        page_url,
        page_path,
        referrer,

        utm_source,
        utm_medium,
        utm_campaign,
        utm_content,
        utm_term,
        utm_id,

        fbclid,
        campaign_id,
        adset_id,
        ad_id,

        campaign_name,
        adset_name,
        ad_name,

        user_agent,
        screen_width,
        screen_height,
        viewport_width,
        viewport_height,
        language,
        timezone,

        started_video_at_second,
        playback_start_mode,

        started_at,
        last_activity_at
      )
      VALUES (
        $1, $2,

        $3, $4, $5,

        $6, $7, $8,

        $9, $10, $11, $12, $13, $14,

        $15, $16, $17, $18,

        $19, $20, $21,

        $22, $23, $24, $25, $26, $27, $28,

        $29, $30,

        NOW(), NOW()
      )

      ON CONFLICT (session_key)
      DO UPDATE SET
        last_activity_at = NOW(),

        page_url = COALESCE(
          EXCLUDED.page_url,
          analytics_sessions.page_url
        ),

        page_path = COALESCE(
          EXCLUDED.page_path,
          analytics_sessions.page_path
        ),

        referrer = COALESCE(
          EXCLUDED.referrer,
          analytics_sessions.referrer
        ),

        utm_source = COALESCE(
          EXCLUDED.utm_source,
          analytics_sessions.utm_source
        ),

        utm_medium = COALESCE(
          EXCLUDED.utm_medium,
          analytics_sessions.utm_medium
        ),

        utm_campaign = COALESCE(
          EXCLUDED.utm_campaign,
          analytics_sessions.utm_campaign
        ),

        utm_content = COALESCE(
          EXCLUDED.utm_content,
          analytics_sessions.utm_content
        ),

        utm_term = COALESCE(
          EXCLUDED.utm_term,
          analytics_sessions.utm_term
        ),

        utm_id = COALESCE(
          EXCLUDED.utm_id,
          analytics_sessions.utm_id
        ),

        fbclid = COALESCE(
          EXCLUDED.fbclid,
          analytics_sessions.fbclid
        ),

        campaign_id = COALESCE(
          EXCLUDED.campaign_id,
          analytics_sessions.campaign_id
        ),

        adset_id = COALESCE(
          EXCLUDED.adset_id,
          analytics_sessions.adset_id
        ),

        ad_id = COALESCE(
          EXCLUDED.ad_id,
          analytics_sessions.ad_id
        ),

        campaign_name = COALESCE(
          EXCLUDED.campaign_name,
          analytics_sessions.campaign_name
        ),

        adset_name = COALESCE(
          EXCLUDED.adset_name,
          analytics_sessions.adset_name
        ),

        ad_name = COALESCE(
          EXCLUDED.ad_name,
          analytics_sessions.ad_name
        )

      RETURNING
        id,
        session_key,
        visitor_id,
        started_at
      `,
      [
        sessionKey,
        visitor.id,

        cleanText(body.product_id, 120),
        vslId,
        videoId,

        cleanText(body.page_url, 5000),
        cleanText(body.page_path, 2000),
        cleanText(body.referrer, 5000),

        cleanText(body.utm_source, 1000),
        cleanText(body.utm_medium, 1000),
        cleanText(body.utm_campaign, 2000),
        cleanText(body.utm_content, 2000),
        cleanText(body.utm_term, 2000),
        cleanText(body.utm_id, 2000),

        cleanText(body.fbclid, 3000),
        cleanText(body.campaign_id, 1000),
        cleanText(body.adset_id, 1000),
        cleanText(body.ad_id, 1000),

        cleanText(body.campaign_name, 2000),
        cleanText(body.adset_name, 2000),
        cleanText(body.ad_name, 2000),

        cleanText(req.get("user-agent"), 5000),
        Number.isInteger(body.screen_width)
          ? body.screen_width
          : null,
        Number.isInteger(body.screen_height)
          ? body.screen_height
          : null,
        Number.isInteger(body.viewport_width)
          ? body.viewport_width
          : null,
        Number.isInteger(body.viewport_height)
          ? body.viewport_height
          : null,
        cleanText(body.language, 30),
        cleanText(body.timezone, 80),

        cleanNumber(body.started_video_at_second),
        normalizeStartMode(body.playback_start_mode),
      ]
    );

    await client.query("COMMIT");

    const session = sessionResult.rows[0];

    return res.status(201).json({
      ok: true,
      visitor_id: visitor.id,
      session_id: session.id,
      visitor_key: visitorKey,
      session_key: sessionKey,
      started_at: session.started_at,
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("[analytics/session] error:", error);

    return res.status(500).json({
      ok: false,
      error: "analytics_session_error",
    });
  } finally {
    client.release();
  }
});

/**
 * POST /api/analytics/events
 *
 * Recebe um evento ou um lote de eventos.
 *
 * Formatos aceitos:
 *
 * {
 *   session_key: "...",
 *   events: [...]
 * }
 *
 * ou:
 *
 * {
 *   session_key: "...",
 *   event_type: "play",
 *   ...
 * }
 */
router.post("/events", async (req, res) => {
  const client = await pool.connect();

  try {
    const body = req.body || {};
    const sessionKey = cleanText(body.session_key, 120);

    if (!isValidKey(sessionKey)) {
      return res.status(400).json({
        ok: false,
        error: "invalid_session_key",
      });
    }

    const rawEvents = Array.isArray(body.events)
      ? body.events
      : [body];

    if (
      rawEvents.length === 0 ||
      rawEvents.length > MAX_EVENTS_PER_REQUEST
    ) {
      return res.status(400).json({
        ok: false,
        error: "invalid_events_count",
      });
    }

    const events = rawEvents
      .map(normalizeEvent)
      .filter(Boolean);

    if (events.length === 0) {
      return res.status(400).json({
        ok: false,
        error: "no_valid_events",
      });
    }

    await client.query("BEGIN");

    const sessionResult = await client.query(
      `
      SELECT
        id,
        visitor_id,
        product_id,
        vsl_id,
        video_id
      FROM analytics_sessions
      WHERE session_key = $1
      LIMIT 1
      FOR UPDATE
      `,
      [sessionKey]
    );

    if (sessionResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        ok: false,
        error: "session_not_found",
      });
    }

    const session = sessionResult.rows[0];

    let insertedEvents = 0;
    let insertedRanges = 0;

    let latestCurrentSecond = null;
    let greatestMaxSecond = null;
    let totalWatchDelta = 0;

    let sawPlay = false;
    let sawPitch = false;
    let sawCheckout = false;
    let sawSessionEnd = false;

    let firstPlaySecond = null;

    for (const event of events) {
      const insertEventResult = await client.query(
        `
        INSERT INTO analytics_events (
          event_key,

          visitor_id,
          session_id,

          product_id,
          vsl_id,
          video_id,

          event_type,

          current_second,
          previous_second,
          max_reached_second,
          watched_seconds_delta,

          watched_from_second,
          watched_to_second,

          playback_rate,
          muted,
          fullscreen,
          seek_detected,

          event_data,
          occurred_at
        )
        VALUES (
          $1,

          $2, $3,

          $4, $5, $6,

          $7,

          $8, $9, $10, $11,

          $12, $13,

          $14, $15, $16, $17,

          $18::jsonb,
          $19
        )

        ON CONFLICT (event_key)
        DO NOTHING

        RETURNING id
        `,
        [
          event.eventKey,

          session.visitor_id,
          session.id,

          session.product_id,
          session.vsl_id,
          session.video_id,

          event.eventType,

          event.currentSecond,
          event.previousSecond,
          event.maxReachedSecond,
          event.watchedSecondsDelta,

          event.watchedFromSecond,
          event.watchedToSecond,

          event.playbackRate,
          event.muted,
          event.fullscreen,
          event.seekDetected,

          JSON.stringify(event.eventData),
          event.occurredAt,
        ]
      );

      const wasInserted =
        insertEventResult.rows.length > 0;

      if (!wasInserted) {
        continue;
      }

      insertedEvents += 1;

      if (
        event.watchedFromSecond !== null &&
        event.watchedToSecond !== null
      ) {
        await client.query(
          `
          INSERT INTO analytics_watch_ranges (
            visitor_id,
            session_id,

            product_id,
            vsl_id,
            video_id,

            start_second,
            end_second
          )
          VALUES (
            $1, $2,

            $3, $4, $5,

            $6, $7
          )
          `,
          [
            session.visitor_id,
            session.id,

            session.product_id,
            session.vsl_id,
            session.video_id,

            event.watchedFromSecond,
            event.watchedToSecond,
          ]
        );

        insertedRanges += 1;
      }

      if (event.currentSecond !== null) {
        latestCurrentSecond =
          event.currentSecond;
      }

      const possibleMax =
        event.maxReachedSecond ??
        event.currentSecond;

      if (
        possibleMax !== null &&
        (
          greatestMaxSecond === null ||
          possibleMax > greatestMaxSecond
        )
      ) {
        greatestMaxSecond = possibleMax;
      }

      if (event.watchedSecondsDelta !== null) {
        totalWatchDelta +=
          event.watchedSecondsDelta;
      }

      if (event.eventType === "play") {
        sawPlay = true;

        if (
          firstPlaySecond === null &&
          event.currentSecond !== null
        ) {
          firstPlaySecond =
            event.currentSecond;
        }
      }

      if (event.eventType === "pitch_reached") {
        sawPitch = true;
      }

      if (
        event.eventType === "checkout_click" ||
        event.eventType === "checkout_open"
      ) {
        sawCheckout = true;
      }

      if (
        event.eventType === "session_end" ||
        event.eventType === "page_exit"
      ) {
        sawSessionEnd = true;
      }
    }

    if (insertedEvents > 0) {
      await client.query(
        `
        UPDATE analytics_sessions
        SET
          last_activity_at = NOW(),

          current_second = COALESCE(
            $2,
            current_second
          ),

          max_reached_second = GREATEST(
            max_reached_second,
            COALESCE($3, max_reached_second)
          ),

          total_watch_seconds =
            total_watch_seconds + $4,

          play_started =
            play_started OR $5,

          pitch_reached =
            pitch_reached OR $6,

          checkout_clicked =
            checkout_clicked OR $7,

          first_play_at = CASE
            WHEN first_play_at IS NULL AND $5
              THEN NOW()
            ELSE first_play_at
          END,

          pitch_reached_at = CASE
            WHEN pitch_reached_at IS NULL AND $6
              THEN NOW()
            ELSE pitch_reached_at
          END,

          checkout_clicked_at = CASE
            WHEN checkout_clicked_at IS NULL AND $7
              THEN NOW()
            ELSE checkout_clicked_at
          END,

          started_video_at_second = COALESCE(
            started_video_at_second,
            $8
          ),

          ended_at = CASE
            WHEN $9 THEN NOW()
            ELSE ended_at
          END

        WHERE id = $1
        `,
        [
          session.id,
          latestCurrentSecond,
          greatestMaxSecond,
          totalWatchDelta,
          sawPlay,
          sawPitch,
          sawCheckout,
          firstPlaySecond,
          sawSessionEnd,
        ]
      );

      await client.query(
        `
        UPDATE analytics_visitors
        SET last_seen_at = NOW()
        WHERE id = $1
        `,
        [session.visitor_id]
      );
    }

    await client.query("COMMIT");

    return res.json({
      ok: true,
      received: events.length,
      inserted_events: insertedEvents,
      inserted_ranges: insertedRanges,
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("[analytics/events] error:", error);

    return res.status(500).json({
      ok: false,
      error: "analytics_events_error",
    });
  } finally {
    client.release();
  }
});

module.exports = router;