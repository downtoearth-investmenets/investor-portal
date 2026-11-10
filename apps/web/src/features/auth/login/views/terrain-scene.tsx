'use client';

import { useEffect, useRef } from 'react';
import {
  LAND_TRACTS,
  sampleTractElevation,
  type LandTract,
  type ProbeReadout,
  type RenderMode
} from '../model/terrain.model';

interface TerrainSceneProps {
  tractIndex: number;
  tract: LandTract;
  renderMode: RenderMode;
  autoOrbit: boolean;
  resetToken: number;
  onProbeChange: (probe: ProbeReadout | null) => void;
  onManualOrbit?: () => void;
}

interface RippleWave {
  u: number;
  v: number;
  radius: number;
  strength: number;
}

const GRID_SIZE = 27;
const BASE_DEPTH = -0.22;
const ELEVATION_SCALE = 0.72;
const PARCEL_BOUND = 0.68;

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function TerrainScene({
  tractIndex,
  tract,
  renderMode,
  autoOrbit,
  resetToken,
  onProbeChange,
  onManualOrbit
}: TerrainSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const propsRef = useRef({ tractIndex, tract, renderMode, autoOrbit, onProbeChange, onManualOrbit });
  propsRef.current = { tractIndex, tract, renderMode, autoOrbit, onProbeChange, onManualOrbit };

  const targetGridsRef = useRef<Float32Array[] | null>(null);
  if (!targetGridsRef.current) {
    targetGridsRef.current = LAND_TRACTS.map((_, tIdx) => {
      const arr = new Float32Array(GRID_SIZE * GRID_SIZE);
      for (let i = 0; i < GRID_SIZE; i++) {
        const u = (i / (GRID_SIZE - 1)) * 2 - 1;
        for (let j = 0; j < GRID_SIZE; j++) {
          const v = (j / (GRID_SIZE - 1)) * 2 - 1;
          arr[i * GRID_SIZE + j] = sampleTractElevation(tIdx, u, v);
        }
      }
      return arr;
    });
  }

  const stateRef = useRef({
    yaw: -0.72,
    targetYaw: -0.72,
    pitch: 0.50,
    targetPitch: 0.50,
    hoverX: 0,
    hoverY: 0,
    pointerCanvasX: -9999,
    pointerCanvasY: -9999,
    isPointerInside: false,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    pointerMovedDist: 0,
    probeU: -0.18,
    probeV: 0.12,
    probeActive: false,
    ripples: [{ u: 0, v: 0, radius: 0.05, strength: 1 }] as RippleWave[],
    currentHeights: new Float32Array(targetGridsRef.current[0]!)
  });

  useEffect(() => {
    stateRef.current.ripples.push({ u: 0, v: 0, radius: 0.02, strength: 1.0 });
  }, [tractIndex]);

  useEffect(() => {
    if (resetToken === 0) return;
    stateRef.current.targetYaw = -0.72;
    stateRef.current.targetPitch = 0.50;
    stateRef.current.ripples.push({ u: 0, v: 0, radius: 0.02, strength: 0.85 });
  }, [resetToken]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameId = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let lastProbeNotify = 0;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const totalVerts = GRID_SIZE * GRID_SIZE;
    const projX = new Float32Array(totalVerts);
    const projY = new Float32Array(totalVerts);
    const projZ = new Float32Array(totalVerts);
    const worldZ = new Float32Array(totalVerts);

    const render = (now: number) => {
      const st = stateRef.current;
      const { tractIndex: activeIdx, tract: activeTract, renderMode: mode, autoOrbit: orbiting } = propsRef.current;
      const targetGrid = targetGridsRef.current![activeIdx] ?? targetGridsRef.current![0]!;
      const [accR, accG, accB] = hexToRgb(activeTract.accentHex);

      if (orbiting && !st.isDragging && !reducedMotion.matches) {
        st.targetYaw += 0.0022;
      }

      const reduce = reducedMotion.matches;
      const parallax = st.isPointerInside && !st.isDragging && !reduce;
      const effectiveTargetYaw = st.targetYaw + (parallax ? st.hoverX * 0.14 : 0);
      const effectiveTargetPitch = Math.max(
        0.34,
        Math.min(0.72, st.targetPitch + (parallax ? st.hoverY * 0.07 : 0))
      );

      st.yaw += (effectiveTargetYaw - st.yaw) * (reduce ? 1 : 0.1);
      st.pitch += (effectiveTargetPitch - st.pitch) * (reduce ? 1 : 0.1);

      if (reduce) st.ripples.length = 0;
      for (let r = st.ripples.length - 1; r >= 0; r--) {
        const wave = st.ripples[r]!;
        wave.radius += 0.032;
        wave.strength *= 0.955;
        if (wave.strength < 0.02 || wave.radius > 2.2) {
          st.ripples.splice(r, 1);
        }
      }

      const heights = st.currentHeights;
      for (let i = 0; i < GRID_SIZE; i++) {
        const u = (i / (GRID_SIZE - 1)) * 2 - 1;
        for (let j = 0; j < GRID_SIZE; j++) {
          const v = (j / (GRID_SIZE - 1)) * 2 - 1;
          const idx = i * GRID_SIZE + j;
          const targetH = targetGrid[idx]!;
          heights[idx] += (targetH - heights[idx]!) * (reduce ? 1 : 0.12);

          let waveBoost = 0;
          for (let r = 0; r < st.ripples.length; r++) {
            const wave = st.ripples[r]!;
            const dist = Math.hypot(u - wave.u, v - wave.v);
            const band = Math.exp(-((dist - wave.radius) ** 2) * 38);
            waveBoost += band * wave.strength * 0.11;
          }
          worldZ[idx] = heights[idx]! * ELEVATION_SCALE + waveBoost;
        }
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const cx = width * 0.5;
      const cy = height * 0.58;
      const scale = Math.min(width * 0.36, height * 0.56);

      const cosY = Math.cos(st.yaw);
      const sinY = Math.sin(st.yaw);
      const cosP = Math.cos(st.pitch);
      const sinP = Math.sin(st.pitch);

      const projectPoint = (u: number, v: number, z: number): [number, number, number] => {
        const rx = u * cosY - v * sinY;
        const ry = u * sinY + v * cosY;
        const sx = cx + rx * scale;
        const sy = cy + (ry * sinP - (z - 0.12) * cosP) * scale;
        const depth = ry * cosP + z * sinP;
        return [sx, sy, depth];
      };

      let bestDist2 = Infinity;
      let bestI = Math.floor(GRID_SIZE / 2);
      let bestJ = Math.floor(GRID_SIZE / 2);

      for (let i = 0; i < GRID_SIZE; i++) {
        const u = (i / (GRID_SIZE - 1)) * 2 - 1;
        for (let j = 0; j < GRID_SIZE; j++) {
          const v = (j / (GRID_SIZE - 1)) * 2 - 1;
          const idx = i * GRID_SIZE + j;
          const z = worldZ[idx]!;
          const [sx, sy, depth] = projectPoint(u, v, z);
          projX[idx] = sx;
          projY[idx] = sy;
          projZ[idx] = depth;

          if (st.isPointerInside) {
            const dx = sx - st.pointerCanvasX;
            const dy = sy - st.pointerCanvasY;
            const d2 = dx * dx + dy * dy;
            if (d2 < bestDist2) {
              bestDist2 = d2;
              bestI = i;
              bestJ = j;
            }
          }
        }
      }

      if (st.isPointerInside && bestDist2 < 6400) {
        const targetU = (bestI / (GRID_SIZE - 1)) * 2 - 1;
        const targetV = (bestJ / (GRID_SIZE - 1)) * 2 - 1;
        st.probeU += (targetU - st.probeU) * (reduce ? 1 : 0.22);
        st.probeV += (targetV - st.probeV) * (reduce ? 1 : 0.22);
        st.probeActive = true;

        if (now - lastProbeNotify > 65) {
          lastProbeNotify = now;
          const centerH = heights[bestI * GRID_SIZE + bestJ]!;
          const rightH = heights[Math.min(GRID_SIZE - 1, bestI + 1) * GRID_SIZE + bestJ]!;
          const upH = heights[bestI * GRID_SIZE + Math.min(GRID_SIZE - 1, bestJ + 1)]!;
          const grad = Math.hypot(rightH - centerH, upH - centerH) * (GRID_SIZE * 0.45);
          const slopeDeg = Math.min(44, Math.round(Math.atan(grad) * (180 / Math.PI)));
          const elevationFt = Math.round(activeTract.baseElevationFt + centerH * activeTract.reliefFt);
          propsRef.current.onProbeChange({
            elevationFt,
            slopeDeg,
            normX: Number(((st.probeU + 1) * 0.5).toFixed(2)),
            normY: Number(((st.probeV + 1) * 0.5).toFixed(2))
          });
        }
      } else if (st.probeActive) {
        st.probeActive = false;
        propsRef.current.onProbeChange(null);
      }

      const glow = ctx.createRadialGradient(cx, cy, scale * 0.08, cx, cy, scale * 1.45);
      glow.addColorStop(0, 'rgba(' + accR + ', ' + accG + ', ' + accB + ', 0.14)');
      glow.addColorStop(0.55, 'rgba(105, 162, 165, 0.07)');
      glow.addColorStop(1, 'rgba(16, 28, 23, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      const ringRadius = 1.34;
      ctx.beginPath();
      for (let a = 0; a <= 72; a++) {
        const theta = (a / 72) * Math.PI * 2;
        const [rx, ry] = projectPoint(Math.cos(theta) * ringRadius, Math.sin(theta) * ringRadius, BASE_DEPTH);
        if (a === 0) ctx.moveTo(rx, ry);
        else ctx.lineTo(rx, ry);
      }
      ctx.strokeStyle = 'rgba(182, 212, 214, 0.14)';
      ctx.lineWidth = 1;
      ctx.stroke();

      const cardinals = [
        { angle: 0, label: 'E' },
        { angle: Math.PI * 0.5, label: 'N' },
        { angle: Math.PI, label: 'W' },
        { angle: Math.PI * 1.5, label: 'S' }
      ];
      for (let t = 0; t < 36; t++) {
        const theta = (t / 36) * Math.PI * 2;
        const inner = t % 9 === 0 ? ringRadius - 0.08 : ringRadius - 0.04;
        const [x0, y0] = projectPoint(Math.cos(theta) * inner, Math.sin(theta) * inner, BASE_DEPTH);
        const [x1, y1] = projectPoint(Math.cos(theta) * ringRadius, Math.sin(theta) * ringRadius, BASE_DEPTH);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.strokeStyle = t % 9 === 0 ? 'rgba(255, 202, 119, 0.42)' : 'rgba(182, 212, 214, 0.15)';
        ctx.lineWidth = t % 9 === 0 ? 1.4 : 0.8;
        ctx.stroke();
      }
      ctx.font = '600 10px Poppins, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const c of cardinals) {
        const [lx, ly] = projectPoint(
          Math.cos(c.angle) * (ringRadius + 0.11),
          Math.sin(c.angle) * (ringRadius + 0.11),
          BASE_DEPTH
        );
        ctx.fillStyle = c.label === 'N' ? 'rgba(' + accR + ', ' + accG + ', ' + accB + ', 0.85)' : 'rgba(182, 212, 214, 0.42)';
        ctx.fillText(c.label, lx, ly);
      }
      ctx.restore();

      const quadCount = (GRID_SIZE - 1) * (GRID_SIZE - 1);
      const quads = new Array<{ i: number; j: number; depth: number }>(quadCount);
      let qPtr = 0;
      for (let i = 0; i < GRID_SIZE - 1; i++) {
        for (let j = 0; j < GRID_SIZE - 1; j++) {
          const idx00 = i * GRID_SIZE + j;
          const idx10 = (i + 1) * GRID_SIZE + j;
          const idx11 = (i + 1) * GRID_SIZE + (j + 1);
          const idx01 = i * GRID_SIZE + (j + 1);
          const avgDepth = (projZ[idx00]! + projZ[idx10]! + projZ[idx11]! + projZ[idx01]!) * 0.25;
          quads[qPtr++] = { i, j, depth: avgDepth };
        }
      }
      quads.sort((a, b) => a.depth - b.depth);

      const lightX = -0.45 + st.hoverX * 0.35;
      const lightY = -0.38 + st.hoverY * 0.25;
      const lightZ = 0.82;
      const lightLen = Math.hypot(lightX, lightY, lightZ);
      const lx = lightX / lightLen;
      const ly = lightY / lightLen;
      const lz = lightZ / lightLen;

      const cellStep = 2 / (GRID_SIZE - 1);

      for (let q = 0; q < quadCount; q++) {
        const { i, j } = quads[q]!;
        const idx00 = i * GRID_SIZE + j;
        const idx10 = (i + 1) * GRID_SIZE + j;
        const idx11 = (i + 1) * GRID_SIZE + (j + 1);
        const idx01 = i * GRID_SIZE + (j + 1);

        const x00 = projX[idx00]!, y00 = projY[idx00]!;
        const x10 = projX[idx10]!, y10 = projY[idx10]!;
        const x11 = projX[idx11]!, y11 = projY[idx11]!;
        const x01 = projX[idx01]!, y01 = projY[idx01]!;

        const h00 = heights[idx00]!;
        const h10 = heights[idx10]!;
        const h11 = heights[idx11]!;
        const h01 = heights[idx01]!;
        const hAvg = (h00 + h10 + h11 + h01) * 0.25;

        const dzdu = ((h10 - h00) + (h11 - h01)) * 0.5 * ELEVATION_SCALE / cellStep;
        const dzdv = ((h01 - h00) + (h11 - h10)) * 0.5 * ELEVATION_SCALE / cellStep;
        const nLen = Math.hypot(-dzdu, -dzdv, 1);
        const ndotl = Math.max(0, ((-dzdu * lx) + (-dzdv * ly) + lz) / nLen);

        const uMid = ((i + 0.5) / (GRID_SIZE - 1)) * 2 - 1;
        const vMid = ((j + 0.5) / (GRID_SIZE - 1)) * 2 - 1;
        const insideParcel = Math.abs(uMid) <= PARCEL_BOUND && Math.abs(vMid) <= PARCEL_BOUND;

        ctx.beginPath();
        ctx.moveTo(x00, y00);
        ctx.lineTo(x10, y10);
        ctx.lineTo(x11, y11);
        ctx.lineTo(x01, y01);
        ctx.closePath();

        if (mode === 'relief') {
          const elevMix = Math.min(1, Math.max(0, (hAvg - 0.08) / 0.82));
          const shade = 0.35 + ndotl * 0.65;
          const baseR = 18 + elevMix * 36 + (insideParcel ? 10 : 0);
          const baseG = 38 + elevMix * 68 + (insideParcel ? 16 : 0);
          const baseB = 33 + elevMix * 64 + (insideParcel ? 12 : 0);

          const peakGlow = Math.pow(elevMix, 2.3) * 0.46;
          const r = Math.min(255, Math.round(baseR * shade * (1 - peakGlow) + accR * peakGlow));
          const g = Math.min(255, Math.round(baseG * shade * (1 - peakGlow) + accG * peakGlow));
          const b = Math.min(255, Math.round(baseB * shade * (1 - peakGlow) + accB * peakGlow));

          ctx.fillStyle = 'rgb(' + r + ', ' + g + ', ' + b + ')';
          ctx.fill();

          const isContourBand = Math.floor(h00 * 12) !== Math.floor(h11 * 12);
          ctx.strokeStyle = isContourBand
            ? 'rgba(' + accR + ', ' + accG + ', ' + accB + ', ' + (insideParcel ? 0.52 : 0.25) + ')'
            : insideParcel
              ? 'rgba(182, 212, 214, 0.16)'
              : 'rgba(105, 162, 165, 0.08)';
          ctx.lineWidth = isContourBand ? 1.05 : 0.55;
          ctx.stroke();
        } else if (mode === 'contours') {
          const elevMix = Math.min(1, Math.max(0, hAvg));
          const isBand = Math.floor(h00 * 16) !== Math.floor(h11 * 16) || Math.floor(h10 * 16) !== Math.floor(h01 * 16);
          ctx.fillStyle = insideParcel
            ? 'rgba(22, 44, 36, ' + (0.72 + elevMix * 0.2) + ')'
            : 'rgba(15, 28, 23, ' + (0.65 + elevMix * 0.15) + ')';
          ctx.fill();
          ctx.strokeStyle = isBand
            ? 'rgba(' + accR + ', ' + accG + ', ' + accB + ', ' + (0.45 + elevMix * 0.5) + ')'
            : 'rgba(105, 162, 165, 0.1)';
          ctx.lineWidth = isBand ? 1.35 : 0.45;
          ctx.stroke();
        } else {
          const elevMix = Math.min(1, Math.max(0, hAvg));
          ctx.fillStyle = insideParcel ? 'rgba(18, 37, 30, 0.52)' : 'rgba(13, 24, 20, 0.42)';
          ctx.fill();
          ctx.strokeStyle = insideParcel
            ? 'rgba(' + accR + ', ' + accG + ', ' + accB + ', ' + (0.28 + elevMix * 0.48) + ')'
            : 'rgba(105, 162, 165, 0.18)';
          ctx.lineWidth = insideParcel ? 0.9 : 0.55;
          ctx.stroke();
        }
      }

      const drawCutawayWall = (edgeCoords: [number, number][], shadeFactor: number) => {
        for (let k = 0; k < edgeCoords.length - 1; k++) {
          const [i0, j0] = edgeCoords[k]!;
          const [i1, j1] = edgeCoords[k + 1]!;
          const idx0 = i0 * GRID_SIZE + j0;
          const idx1 = i1 * GRID_SIZE + j1;
          const u0 = (i0 / (GRID_SIZE - 1)) * 2 - 1;
          const v0 = (j0 / (GRID_SIZE - 1)) * 2 - 1;
          const u1 = (i1 / (GRID_SIZE - 1)) * 2 - 1;
          const v1 = (j1 / (GRID_SIZE - 1)) * 2 - 1;

          const tx0 = projX[idx0]!, ty0 = projY[idx0]!;
          const tx1 = projX[idx1]!, ty1 = projY[idx1]!;
          const [bx0, by0] = projectPoint(u0, v0, BASE_DEPTH);
          const [bx1, by1] = projectPoint(u1, v1, BASE_DEPTH);

          ctx.beginPath();
          ctx.moveTo(tx0, ty0);
          ctx.lineTo(tx1, ty1);
          ctx.lineTo(bx1, by1);
          ctx.lineTo(bx0, by0);
          ctx.closePath();

          const r = Math.round(16 * shadeFactor);
          const g = Math.round(34 * shadeFactor);
          const b = Math.round(29 * shadeFactor);
          ctx.fillStyle = 'rgba(' + r + ', ' + g + ', ' + b + ', 0.92)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(105, 162, 165, 0.22)';
          ctx.lineWidth = 0.65;
          ctx.stroke();

          const [mx0, my0] = projectPoint(u0, v0, BASE_DEPTH * 0.45 + worldZ[idx0]! * 0.35);
          const [mx1, my1] = projectPoint(u1, v1, BASE_DEPTH * 0.45 + worldZ[idx1]! * 0.35);
          ctx.beginPath();
          ctx.moveTo(mx0, my0);
          ctx.lineTo(mx1, my1);
          ctx.strokeStyle = 'rgba(' + accR + ', ' + accG + ', ' + accB + ', 0.28)';
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      };

      const uFaceIndex = sinY >= 0 ? GRID_SIZE - 1 : 0;
      const vFaceIndex = cosY >= 0 ? GRID_SIZE - 1 : 0;

      const uEdge: [number, number][] = [];
      const vEdge: [number, number][] = [];
      for (let k = 0; k < GRID_SIZE; k++) {
        uEdge.push([uFaceIndex, k]);
        vEdge.push([k, vFaceIndex]);
      }
      drawCutawayWall(uEdge, 0.88);
      drawCutawayWall(vEdge, 1.08);

      const sampleSurfaceZ = (u: number, v: number) => {
        const fi = Math.max(0, Math.min(GRID_SIZE - 1, ((u + 1) * 0.5) * (GRID_SIZE - 1)));
        const fj = Math.max(0, Math.min(GRID_SIZE - 1, ((v + 1) * 0.5) * (GRID_SIZE - 1)));
        const i0 = Math.min(GRID_SIZE - 2, Math.floor(fi));
        const j0 = Math.min(GRID_SIZE - 2, Math.floor(fj));
        const du = fi - i0;
        const dv = fj - j0;
        const z00 = worldZ[i0 * GRID_SIZE + j0]!;
        const z10 = worldZ[(i0 + 1) * GRID_SIZE + j0]!;
        const z01 = worldZ[i0 * GRID_SIZE + (j0 + 1)]!;
        const z11 = worldZ[(i0 + 1) * GRID_SIZE + (j0 + 1)]!;
        return (z00 * (1 - du) + z10 * du) * (1 - dv) + (z01 * (1 - du) + z11 * du) * dv;
      };

      ctx.save();
      ctx.beginPath();
      const perimeterSteps = 20;
      const corners: [number, number][] = [
        [-PARCEL_BOUND, -PARCEL_BOUND],
        [PARCEL_BOUND, -PARCEL_BOUND],
        [PARCEL_BOUND, PARCEL_BOUND],
        [-PARCEL_BOUND, PARCEL_BOUND]
      ];
      for (let edge = 0; edge < 4; edge++) {
        const [uStart, vStart] = corners[edge]!;
        const [uEnd, vEnd] = corners[(edge + 1) % 4]!;
        // Translucent vertical parcel boundary curtain
        ctx.beginPath();
        for (let s = 0; s <= perimeterSteps; s++) {
          const t = s / perimeterSteps;
          const u = uStart + (uEnd - uStart) * t;
          const v = vStart + (vEnd - vStart) * t;
          const z = sampleSurfaceZ(u, v);
          const [px, py] = projectPoint(u, v, z);
          if (s === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        for (let s = perimeterSteps; s >= 0; s--) {
          const t = s / perimeterSteps;
          const u = uStart + (uEnd - uStart) * t;
          const v = vStart + (vEnd - vStart) * t;
          const z = sampleSurfaceZ(u, v) + 0.085;
          const [px, py] = projectPoint(u, v, z);
          ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(' + accR + ', ' + accG + ', ' + accB + ', 0.07)';
        ctx.fill();
      }

      ctx.beginPath();
      for (let edge = 0; edge < 4; edge++) {
        const [uStart, vStart] = corners[edge]!;
        const [uEnd, vEnd] = corners[(edge + 1) % 4]!;
        for (let s = 0; s <= perimeterSteps; s++) {
          const t = s / perimeterSteps;
          const u = uStart + (uEnd - uStart) * t;
          const v = vStart + (vEnd - vStart) * t;
          const z = sampleSurfaceZ(u, v) + 0.018;
          const [px, py] = projectPoint(u, v, z);
          if (edge === 0 && s === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(' + accR + ', ' + accG + ', ' + accB + ', 0.9)';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      const monumentLabels = ['NW', 'NE', 'SE', 'SW'];
      corners.forEach(([cu, cv], idx) => {
        const cz = sampleSurfaceZ(cu, cv);
        const [bx, by] = projectPoint(cu, cv, cz);
        const [tx, ty] = projectPoint(cu, cv, cz + 0.14);

        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(tx, ty);
        ctx.strokeStyle = 'rgba(' + accR + ', ' + accG + ', ' + accB + ', 0.75)';
        ctx.lineWidth = 1.25;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(tx, ty, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = activeTract.accentHex;
        ctx.fill();

        ctx.font = '600 9px Poppins, system-ui, sans-serif';
        ctx.fillStyle = 'rgba(238, 245, 245, 0.78)';
        ctx.textAlign = 'center';
        ctx.fillText(monumentLabels[idx]!, tx, ty - 8);
      });
      ctx.restore();

      if (st.probeActive) {
        const pz = sampleSurfaceZ(st.probeU, st.probeV);
        const [sx, sy] = projectPoint(st.probeU, st.probeV, pz + 0.015);
        const [topX, topY] = projectPoint(st.probeU, st.probeV, pz + 0.24);

        ctx.beginPath();
        ctx.arc(sx, sy, 8, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(' + accR + ', ' + accG + ', ' + accB + ', 0.85)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(sx, sy, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(topX, topY);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(topX, topY, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = activeTract.accentHex;
        ctx.fill();
      }

      ctx.restore();
      frameId = requestAnimationFrame(render);
    };

    frameId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-label={'Interactive 3D topographic parcel model for ' + tract.name}
      className="absolute inset-0 h-full w-full cursor-grab touch-pan-y select-none active:cursor-grabbing lg:touch-none"
      onPointerEnter={event => {
        const rect = event.currentTarget.getBoundingClientRect();
        stateRef.current.isPointerInside = true;
        stateRef.current.pointerCanvasX = event.clientX - rect.left;
        stateRef.current.pointerCanvasY = event.clientY - rect.top;
      }}
      onPointerDown={event => {
        if (!event.isPrimary || event.button !== 0) return;
        const st = stateRef.current;
        st.isDragging = true;
        st.dragStartX = event.clientX;
        st.dragStartY = event.clientY;
        st.pointerMovedDist = 0;
        event.currentTarget.setPointerCapture(event.pointerId);
        propsRef.current.onManualOrbit?.();
      }}
      onPointerMove={event => {
        const rect = event.currentTarget.getBoundingClientRect();
        const st = stateRef.current;
        const localX = event.clientX - rect.left;
        const localY = event.clientY - rect.top;
        st.isPointerInside = true;
        st.pointerCanvasX = localX;
        st.pointerCanvasY = localY;
        st.hoverX = ((localX / Math.max(1, rect.width)) - 0.5) * 2;
        st.hoverY = ((localY / Math.max(1, rect.height)) - 0.5) * 2;

        if (st.isDragging) {
          const dx = event.clientX - st.dragStartX;
          const dy = event.clientY - st.dragStartY;
          st.pointerMovedDist += Math.hypot(dx, dy);
          st.targetYaw += dx * 0.0085;
          st.targetPitch = Math.max(0.34, Math.min(0.72, st.targetPitch + dy * 0.0045));
          st.dragStartX = event.clientX;
          st.dragStartY = event.clientY;
        }
      }}
      onPointerUp={event => {
        const st = stateRef.current;
        if (st.isDragging && st.pointerMovedDist < 6) {
          st.ripples.push({
            u: st.probeActive ? st.probeU : 0,
            v: st.probeActive ? st.probeV : 0,
            radius: 0.02,
            strength: 1.05
          });
        }
        st.isDragging = false;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerLeave={() => {
        stateRef.current.isPointerInside = false;
        stateRef.current.isDragging = false;
        stateRef.current.hoverX = 0;
        stateRef.current.hoverY = 0;
      }}
      onLostPointerCapture={() => { stateRef.current.isDragging = false; }}
    />
  );
}
