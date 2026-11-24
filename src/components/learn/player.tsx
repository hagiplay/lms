"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { PlayCircle } from "lucide-react";

type PlayerApi = { time: number; seek: (sec: number) => void; register: (seek: (sec: number) => void) => void; setTime: (t: number) => void };
const Ctx = createContext<PlayerApi | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const seekRef = useRef<(sec: number) => void>(() => {});
  const [time, setTime] = useState(0);
  const api: PlayerApi = {
    time,
    setTime,
    seek: (sec) => {
      seekRef.current(sec);
      document.getElementById("player")?.scrollIntoView({ behavior: "smooth", block: "center" });
    },
    register: (fn) => {
      seekRef.current = fn;
    },
  };
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export const usePlayer = () => useContext(Ctx);

function beacon(itemId: string, positionSec: number, durationSec: number) {
  const body = JSON.stringify({ itemId, positionSec, durationSec });
  const blob = new Blob([body], { type: "application/json" });
  if (!navigator.sendBeacon?.("/api/progress", blob)) {
    void fetch("/api/progress", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
  }
}

/** Saves the position every 15s of playback and when the page is hidden. */
function useProgressSaver(itemId: string, durationHint: number) {
  const last = useRef({ t: 0, d: durationHint, saved: -1 });
  const update = useCallback((t: number, d?: number) => {
    last.current.t = t;
    if (d && Number.isFinite(d)) last.current.d = d;
    if (Math.abs(t - last.current.saved) >= 15) {
      last.current.saved = t;
      beacon(itemId, t, last.current.d);
    }
  }, [itemId]);
  useEffect(() => {
    const flush = () => last.current.t > 0 && beacon(itemId, last.current.t, last.current.d);
    const onVis = () => document.visibilityState === "hidden" && flush();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", flush);
    return () => {
      flush();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", flush);
    };
  }, [itemId]);
  return update;
}

export function VideoPlayer(props: { itemId: string; provider: "none" | "bunny" | "url"; src: string | null; startSec: number; durationSec: number; title: string }) {
  const player = usePlayer();
  const save = useProgressSaver(props.itemId, props.durationSec);
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // HTML5 <video>
  useEffect(() => {
    if (props.provider !== "url") return;
    const v = videoRef.current;
    if (!v) return;
    const onMeta = () => props.startSec > 5 && props.startSec < v.duration - 5 && (v.currentTime = props.startSec);
    const onTime = () => {
      player?.setTime(v.currentTime);
      save(v.currentTime, v.duration);
    };
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("timeupdate", onTime);
    player?.register((sec) => {
      v.currentTime = sec;
      void v.play();
    });
    return () => {
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("timeupdate", onTime);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.provider, props.src]);

  // Bunny iframe via the player.js postMessage protocol.
  useEffect(() => {
    if (props.provider !== "bunny") return;
    const frame = iframeRef.current;
    const post = (method: string, value?: unknown) =>
      frame?.contentWindow?.postMessage(JSON.stringify({ context: "player.js", version: "0.0.11", method, value }), "https://iframe.mediadelivery.net");
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== "https://iframe.mediadelivery.net") return;
      let data: { event?: string; value?: { seconds?: number; duration?: number } };
      try {
        data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      } catch {
        return;
      }
      if (data.event === "ready") post("addEventListener", "timeupdate");
      if (data.event === "timeupdate" && data.value?.seconds != null) {
        player?.setTime(data.value.seconds);
        save(data.value.seconds, data.value.duration);
      }
    };
    window.addEventListener("message", onMsg);
    player?.register((sec) => {
      post("setCurrentTime", sec);
      post("play");
    });
    return () => window.removeEventListener("message", onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.provider, props.src]);

  return (
    <div id="player" className="aspect-video w-full overflow-hidden rounded-[var(--radius-card)] bg-black">
      {props.provider === "bunny" && props.src ? (
        <iframe ref={iframeRef} src={props.src} title={props.title} className="size-full" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
      ) : props.provider === "url" && props.src ? (
        <video ref={videoRef} src={props.src} controls playsInline preload="metadata" className="size-full" aria-label={props.title} />
      ) : (
        <div className="hero flex size-full flex-col items-center justify-center gap-2 text-center">
          <PlayCircle aria-hidden size={56} className="opacity-80" />
          <p className="font-semibold">הסרטון של השיעור יופיע כאן</p>
          <p className="text-sm text-white/80">עוד לא חובר וידאו לשיעור הזה</p>
        </div>
      )}
    </div>
  );
}
