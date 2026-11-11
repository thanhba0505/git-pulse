"use client";

import React, { useEffect, useRef } from "react";

interface Star {
  x: number;
  y: number;
  originX: number;
  originY: number;
  radius: number;
  alpha: number;
  speed: number;
  hue: number;
  twinkleSpeed: number;
  twinkleOffset: number;
}

interface Meteor {
  x: number;
  y: number;
  length: number;
  speed: number;
  alpha: number;
  color: string;
}

export function StarfieldCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Check prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const mouse = {
      x: null as number | null,
      y: null as number | null,
      radius: 160,
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    const handleMouseLeave = () => {
      mouse.x = null;
      mouse.y = null;
    };

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("resize", handleResize);

    // Initialize Stars
    const starCount = Math.min(140, Math.floor((width * height) / 10000));
    const stars: Star[] = Array.from({ length: starCount }, () => {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const hueChoice = Math.random();
      const hue =
        hueChoice > 0.65
          ? 190
          : hueChoice > 0.4
            ? 260
            : hueChoice > 0.25
              ? 155
              : 210;

      return {
        x,
        y,
        originX: x,
        originY: y,
        radius: Math.random() * 1.6 + 0.6,
        alpha: Math.random() * 0.7 + 0.3,
        speed: Math.random() * 0.25 + 0.08,
        hue,
        twinkleSpeed: Math.random() * 0.03 + 0.01,
        twinkleOffset: Math.random() * Math.PI * 2,
      };
    });

    // Meteors
    const meteors: Meteor[] = [];
    let lastMeteorTime = Date.now();

    const spawnMeteor = () => {
      meteors.push({
        x: Math.random() * width,
        y: Math.random() * (height * 0.4),
        length: Math.random() * 80 + 50,
        speed: Math.random() * 8 + 6,
        alpha: 1,
        color: Math.random() > 0.5 ? "#22d3ee" : "#a78bfa",
      });
    };

    // Nebula Background Canvas rendering
    const renderNebula = (time: number) => {
      // Soft drifting glowing plasma orbs
      const cosTime = Math.cos(time * 0.0005);
      const sinTime = Math.sin(time * 0.0004);

      // Cyan nebula upper-left
      const gradCyan = ctx.createRadialGradient(
        width * 0.2 + cosTime * 40,
        height * 0.25 + sinTime * 30,
        10,
        width * 0.2,
        height * 0.25,
        width * 0.45,
      );
      gradCyan.addColorStop(0, "rgba(6, 182, 212, 0.08)");
      gradCyan.addColorStop(0.5, "rgba(6, 182, 212, 0.03)");
      gradCyan.addColorStop(1, "rgba(3, 7, 18, 0)");

      ctx.fillStyle = gradCyan;
      ctx.fillRect(0, 0, width, height);

      // Violet nebula center-right
      const gradViolet = ctx.createRadialGradient(
        width * 0.75 - sinTime * 50,
        height * 0.55 + cosTime * 40,
        10,
        width * 0.75,
        height * 0.55,
        width * 0.4,
      );
      gradViolet.addColorStop(0, "rgba(139, 92, 246, 0.07)");
      gradViolet.addColorStop(0.5, "rgba(139, 92, 246, 0.02)");
      gradViolet.addColorStop(1, "rgba(3, 7, 18, 0)");

      ctx.fillStyle = gradViolet;
      ctx.fillRect(0, 0, width, height);
    };

    // Main render loop
    let tick = 0;
    const render = () => {
      ctx.clearRect(0, 0, width, height);
      tick += 1;

      // 1. Draw Nebula Aurora
      renderNebula(tick);

      // 2. Spawn Meteors occasionally (every ~4-6 seconds)
      const now = Date.now();
      if (
        !prefersReducedMotion &&
        now - lastMeteorTime > 4500 &&
        Math.random() > 0.6
      ) {
        spawnMeteor();
        lastMeteorTime = now;
      }

      // 3. Update & Draw Meteors
      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        if (!m) continue;

        m.x += m.speed;
        m.y += m.speed * 0.7;
        m.alpha -= 0.012;

        if (m.alpha <= 0) {
          meteors.splice(i, 1);
          continue;
        }

        const grad = ctx.createLinearGradient(
          m.x,
          m.y,
          m.x - m.length * 0.8,
          m.y - m.length * 0.56,
        );
        grad.addColorStop(0, `rgba(255, 255, 255, ${m.alpha})`);
        grad.addColorStop(0.2, m.color);
        grad.addColorStop(1, "rgba(3, 7, 18, 0)");

        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(m.x - m.length * 0.8, m.y - m.length * 0.56);
        ctx.stroke();
      }

      // 4. Update & Draw Stars & Constellations
      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];
        if (!star) continue;

        if (!prefersReducedMotion) {
          star.y -= star.speed;
          if (star.y < 0) {
            star.y = height;
            star.x = Math.random() * width;
          }
        }

        // Mouse displacement & dynamic constellation line to cursor
        if (mouse.x !== null && mouse.y !== null && !prefersReducedMotion) {
          const dxMouse = star.x - mouse.x;
          const dyMouse = star.y - mouse.y;
          const distMouse = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse);

          if (distMouse < mouse.radius) {
            // Constellation beam to cursor
            const beamAlpha = (1 - distMouse / mouse.radius) * 0.45;
            ctx.beginPath();
            ctx.moveTo(star.x, star.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.strokeStyle = `rgba(34, 211, 238, ${beamAlpha})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();

            // Gentle gravity push
            const force = (1 - distMouse / mouse.radius) * 0.8;
            star.x += (dxMouse / distMouse) * force;
            star.y += (dyMouse / distMouse) * force;
          }
        }

        // Inter-star constellation mesh
        if (!prefersReducedMotion) {
          for (let j = i + 1; j < stars.length; j++) {
            const other = stars[j];
            if (!other) continue;
            const dx = star.x - other.x;
            const dy = star.y - other.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 85) {
              const lineAlpha = (1 - dist / 85) * 0.12;
              ctx.beginPath();
              ctx.moveTo(star.x, star.y);
              ctx.lineTo(other.x, other.y);
              ctx.strokeStyle = `rgba(6, 182, 212, ${lineAlpha})`;
              ctx.lineWidth = 0.5;
              ctx.stroke();
            }
          }
        }

        // Draw the glowing Star Dot
        const currentAlpha =
          star.alpha *
          (0.8 + 0.2 * Math.sin(tick * star.twinkleSpeed + star.twinkleOffset));

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${star.hue}, 90%, 80%, ${currentAlpha})`;
        ctx.shadowBlur = 6;
        ctx.shadowColor = `hsla(${star.hue}, 90%, 75%, 0.9)`;
        ctx.fill();
      }

      if (!prefersReducedMotion) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    // Kick off animation
    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 opacity-80"
      aria-hidden="true"
    />
  );
}
