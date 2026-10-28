"use client";

import React, { useState, useEffect, useRef } from "react";
import { Play, Pause, RotateCcw, Clock, Volume2, VolumeX } from "lucide-react";

interface PitchTimerProps {
  initialSeconds?: number;
}

export default function PitchTimer({ initialSeconds = 300 }: PitchTimerProps) {
  const [targetSeconds, setTargetSeconds] = useState(initialSeconds);
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);
  const [inputMinutes, setInputMinutes] = useState(String(Math.round(initialSeconds / 60) || 5));
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<"pitch" | "qa">("pitch");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Synthesized web audio chime
  const playChime = (frequency: number = 880, duration: number = 0.25) => {
    if (!soundEnabled || typeof window === "undefined") return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // AudioContext policy fallback
    }
  };

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            // Alarm on expiration
            playChime(440, 0.6);
            setIsRunning(false);
            return 0;
          }
          // Warning chime at 60s
          if (prev === 61) {
            playChime(660, 0.3);
          }
          return prev - 1;
        });
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, soundEnabled]);

  const toggleRun = () => setIsRunning(!isRunning);

  const resetTimer = (newSeconds: number = targetSeconds) => {
    setIsRunning(false);
    setSecondsLeft(newSeconds);
  };

  const handleApplyMinutes = (customMins?: number) => {
    const mins = customMins !== undefined ? customMins : parseFloat(inputMinutes);
    if (!isNaN(mins) && mins > 0) {
      const calculatedSeconds = Math.round(mins * 60);
      setTargetSeconds(calculatedSeconds);
      resetTimer(calculatedSeconds);
      if (customMins !== undefined) {
        setInputMinutes(String(customMins));
      }
    }
  };

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const formatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const isWarning = secondsLeft <= 60 && secondsLeft > 0;
  const isExpired = secondsLeft === 0;

  return (
    <div className="glass-panel p-4 border border-border-color bg-surface-color/80 flex flex-col md:flex-row items-center justify-between gap-4 rounded">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div
          className={`p-2.5 rounded border transition-colors self-start sm:self-center ${
            isExpired
              ? "bg-status-error/20 border-status-error text-status-error animate-pulse"
              : isWarning
              ? "bg-accent-primary/20 border-accent-primary text-accent-primary"
              : "bg-surface-color-light border-border-color text-accent-secondary"
          }`}
        >
          <Clock size={20} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-tech text-[10px] uppercase tracking-[1.5px] text-text-secondary font-bold">
              Pitch Timekeeper
            </span>
            <span
              className={`font-tech text-[9px] uppercase px-1.5 py-0.2 rounded border font-bold ${
                mode === "pitch"
                  ? "border-accent-secondary/50 text-accent-secondary bg-accent-secondary/10"
                  : "border-accent-tertiary/50 text-accent-tertiary bg-accent-tertiary/10"
              }`}
            >
              {mode === "pitch" ? "Pitching" : "Q & A"}
            </span>
          </div>

          {/* Minute Input & Preset Buttons */}
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            {/* Custom Minutes Input */}
            <div className="flex items-center gap-1.5 bg-surface-color border border-border-color px-2 py-1 rounded">
              <span className="font-tech text-[11px] text-text-secondary uppercase font-bold">
                Time:
              </span>
              <input
                type="number"
                min="0.5"
                max="180"
                step="0.5"
                value={inputMinutes}
                onChange={(e) => setInputMinutes(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleApplyMinutes();
                }}
                className="w-14 bg-surface-color-light border border-border-color/80 text-text-primary font-mono font-bold text-xs text-center py-0.5 focus:border-accent-primary outline-none rounded"
                placeholder="min"
              />
              <span className="font-tech text-[10px] text-text-secondary font-bold">
                min
              </span>
              <button
                type="button"
                onClick={() => handleApplyMinutes()}
                className="px-2 py-0.5 bg-accent-primary hover:bg-accent-primary/80 text-black font-tech font-bold text-[10px] uppercase rounded transition-colors ml-0.5"
              >
                Set
              </button>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1">
              {[3, 5, 7, 10].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode("pitch");
                    handleApplyMinutes(m);
                  }}
                  className={`font-tech text-[10px] uppercase px-2 py-0.5 border rounded transition-colors ${
                    targetSeconds === m * 60 && mode === "pitch"
                      ? "border-accent-secondary bg-accent-secondary/20 text-text-primary font-bold"
                      : "border-border-color text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {m}m
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setMode("qa");
                  handleApplyMinutes(2);
                }}
                className={`font-tech text-[10px] uppercase px-2 py-0.5 border rounded transition-colors ${
                  targetSeconds === 120 && mode === "qa"
                    ? "border-accent-tertiary bg-accent-tertiary/20 text-text-primary font-bold"
                    : "border-border-color text-text-secondary hover:text-text-primary"
                }`}
              >
                2m Q&A
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Clock & Controls */}
      <div className="flex items-center gap-4">
        <div
          className={`font-mono text-3xl font-black tracking-widest px-3 py-1 border rounded bg-surface-color ${
            isExpired
              ? "text-status-error border-status-error animate-pulse shadow-lg shadow-status-error/20"
              : isWarning
              ? "text-accent-primary border-accent-primary shadow-lg shadow-accent-primary/20"
              : "text-text-primary border-border-color"
          }`}
        >
          {formatted}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleRun}
            className={`p-2 font-tech font-bold uppercase text-xs border rounded transition-colors flex items-center gap-1.5 ${
              isRunning
                ? "bg-accent-primary/20 border-accent-primary text-accent-primary hover:bg-accent-primary/30"
                : "bg-accent-secondary border-accent-secondary text-white hover:bg-accent-secondary/80"
            }`}
          >
            {isRunning ? <Pause size={15} /> : <Play size={15} />}
            <span className="hidden sm:inline">{isRunning ? "Pause" : "Start"}</span>
          </button>

          <button
            onClick={() => resetTimer()}
            className="p-2 border border-border-color text-text-secondary hover:text-text-primary hover:border-text-secondary rounded bg-surface-color-light transition-colors"
            title="Reset timer"
          >
            <RotateCcw size={15} />
          </button>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 border rounded transition-colors ${
              soundEnabled
                ? "border-accent-primary/40 text-accent-primary bg-accent-primary/10"
                : "border-border-color text-text-secondary bg-surface-color"
            }`}
            title={soundEnabled ? "Sound alarms enabled" : "Muted"}
          >
            {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>
        </div>
      </div>
    </div>
  );
}
