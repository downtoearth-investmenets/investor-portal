'use client';

import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import gsap from 'gsap';
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react';
import {
  CatmullRomCurve3, MathUtils, Mesh, OrthographicCamera, PlaneGeometry, SRGBColorSpace,
  TextureLoader, TubeGeometry, Vector3
} from 'three';
import { useTerrainViewModel } from '../view-models/use-terrain.vm';
import { overviewSpan, REGIONS, TERRAIN_GRID, TERRAIN_HEIGHT, TERRAIN_TEXTURE, TERRAIN_WIDTH, terrainPoint, type Region } from '../model/terrain.model';

export interface TerrainControls {
  focus: (region: Region) => void;
  interrupt: () => void;
  pan: (dx: number, dy: number) => void;
  reset: () => void;
  zoom: (factor: number) => void;
}

interface SceneProps {
  controls: MutableRefObject<TerrainControls | null>;
  markers: MutableRefObject<(HTMLDivElement | null)[]>;
  activeRegion: Region;
  onReady: () => void;
  onFailure: () => void;
}

const TRACE_SEGMENTS = 80;
const TRACE_SIDES = 5;
const SETTLED_TILT = 0.105;
const MAP_DISTANCE = 15;

function relief(elevations: Uint16Array, x: number, y: number) {
  const last = TERRAIN_GRID - 1;
  const col = MathUtils.clamp((x / TERRAIN_WIDTH + 0.5) * last, 0, last);
  const row = MathUtils.clamp((0.5 - y / TERRAIN_HEIGHT) * last, 0, last);
  const i = Math.min(last - 1, Math.floor(col));
  const j = Math.min(last - 1, Math.floor(row));
  const start = j * TERRAIN_GRID + i;
  return MathUtils.lerp(
    MathUtils.lerp(elevations[start]!, elevations[start + 1]!, col - i),
    MathUtils.lerp(elevations[start + TERRAIN_GRID]!, elevations[start + TERRAIN_GRID + 1]!, col - i),
    row - j
  ) * 0.00018;
}

function createTerrain(elevations: Uint16Array) {
  const terrain = new PlaneGeometry(TERRAIN_WIDTH, TERRAIN_HEIGHT, TERRAIN_GRID - 1, TERRAIN_GRID - 1);
  const positions = terrain.attributes.position!;
  for (let i = 0; i < positions.count; i++) positions.setZ(i, elevations[i]! * 0.00018);
  return terrain;
}

function createTrace(elevations: Uint16Array) {
  const guide = new CatmullRomCurve3([
    [-107.55, 37.3], [-107.3, 37.65], [-107.43, 38.05], [-106.98, 38.38],
    [-106.65, 38.48], [-106.43, 38.8], [-106.15, 39.16], [-105.86, 39.32], [-105.55, 39.05]
  ].map(([lon, lat]) => {
    const { x, y } = terrainPoint(lon!, lat!);
    return new Vector3(x, y, 0);
  }));
  const points = guide.getSpacedPoints(TRACE_SEGMENTS).map(point => {
    point.z = relief(elevations, point.x, point.y) + 0.065;
    return point;
  });
  const curve = new CatmullRomCurve3(points);
  return { curve, geometry: new TubeGeometry(curve, TRACE_SEGMENTS, 0.009, TRACE_SIDES, false) };
}

function Terrain({ elevations, controls, markers, activeRegion, onReady, onFailure }: SceneProps & { elevations: Uint16Array }) {
  const { camera, get, invalidate, gl, size } = useThree();
  const mapCamera = camera as OrthographicCamera;
  const texture = useLoader(TextureLoader, TERRAIN_TEXTURE);
  texture.colorSpace = SRGBColorSpace;
  const ground = useMemo(() => createTerrain(elevations), [elevations]);
  const trace = useMemo(() => createTrace(elevations), [elevations]);
  const amber = useRef<Mesh>(null);
  const viewport = useRef({ x: 0, y: 0, zoom: 1, tilt: 0 });
  const cameraMotion = useRef<gsap.core.Tween | null>(null);
  const reduced = useRef(false);
  const ready = useRef(false);
  const readyFrame = useRef<number>(0);
  const callbacks = useRef({ onReady, onFailure });
  callbacks.current = { onReady, onFailure };
  const projected = useMemo(() => new Vector3(), []);
  const anchors = useMemo(() => REGIONS.map(region => {
    const { x, y } = terrainPoint(region.longitude, region.latitude);
    return new Vector3(x, y, relief(elevations, x, y) + 0.075);
  }), [elevations]);

  const syncCamera = () => {
    const { width, height } = get().size;
    if (!width || !height) return;
    const view = viewport.current;
    const aspect = width / height;
    const span = overviewSpan(aspect) / view.zoom;
    mapCamera.left = -span * aspect / 2;
    mapCamera.right = span * aspect / 2;
    mapCamera.top = span / 2;
    mapCamera.bottom = -span / 2;
    mapCamera.up.set(0, 1, 0);
    mapCamera.position.set(view.x, view.y - Math.sin(view.tilt) * MAP_DISTANCE, Math.cos(view.tilt) * MAP_DISTANCE);
    mapCamera.lookAt(view.x, view.y, 0);
    mapCamera.updateProjectionMatrix();
    mapCamera.updateMatrixWorld();
    invalidate();
  };

  useFrame(() => {
    anchors.forEach((anchor, index) => {
      const marker = markers.current[index];
      if (!marker) return;
      projected.copy(anchor).project(mapCamera);
      const inset = Math.min(96, size.width * 0.16);
      marker.style.left = MathUtils.clamp((projected.x + 1) * size.width / 2, inset, size.width - inset) + 'px';
      marker.style.top = MathUtils.clamp((1 - projected.y) * size.height / 2, 112, size.height - 130) + 'px';
    });
    if (!ready.current) {
      ready.current = true;
      readyFrame.current = requestAnimationFrame(() => callbacks.current.onReady());
    }
  });

  useLayoutEffect(syncCamera, [size.width, size.height]);

  useLayoutEffect(() => {
    const view = viewport.current;
    const interrupt = () => { cameraMotion.current?.kill(); cameraMotion.current = null; };
    const move = (x: number, y: number, zoom: number) => {
      interrupt();
      if (reduced.current) {
        Object.assign(view, { x, y, zoom, tilt: SETTLED_TILT });
        syncCamera();
        return;
      }
      cameraMotion.current = gsap.to(view, { x, y, zoom, tilt: SETTLED_TILT, duration: 0.45, ease: 'power2.out', onUpdate: syncCamera });
    };
    controls.current = {
      interrupt,
      focus: region => {
        const { x, y } = terrainPoint(region.longitude, region.latitude);
        move(x * 0.19, y * 0.16, 1.12);
      },
      pan: (dx, dy) => {
        const { width, height } = get().size;
        if (!width || !height) return;
        const span = overviewSpan(width / height) / view.zoom;
        const horizontal = Math.max(0.35, (TERRAIN_WIDTH - span * width / height) / 2);
        const vertical = Math.max(0.35, (TERRAIN_HEIGHT - span) / 2);
        view.x = MathUtils.clamp(view.x - dx * span / height, -horizontal, horizontal);
        view.y = MathUtils.clamp(view.y + dy * span / height, -vertical, vertical);
        syncCamera();
      },
      zoom: factor => {
        const next = MathUtils.clamp((cameraMotion.current?.isActive() ? Number(cameraMotion.current.vars.zoom ?? view.zoom) : view.zoom) * factor, 1, 2.4);
        const { width, height } = get().size;
        if (!width || !height) return;
        const span = overviewSpan(width / height) / next;
        const horizontal = Math.max(0.35, (TERRAIN_WIDTH - span * width / height) / 2);
        const vertical = Math.max(0.35, (TERRAIN_HEIGHT - span) / 2);
        move(MathUtils.clamp(view.x, -horizontal, horizontal), MathUtils.clamp(view.y, -vertical, vertical), next);
      },
      reset: () => move(0, 0, 1)
    };

    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const progress = { value: 0 };
    const draw = () => {
      trace.geometry.setDrawRange(0, Math.floor(progress.value * TRACE_SEGMENTS) * TRACE_SIDES * 6);
      if (amber.current) {
        amber.current.visible = progress.value < 1;
        trace.curve.getPointAt(progress.value, amber.current.position);
      }
      invalidate();
    };
    let intro: gsap.core.Tween | undefined;
    const syncPreference = () => {
      reduced.current = query.matches;
      if (!query.matches) return;
      const destination = cameraMotion.current?.vars;
      interrupt();
      if (destination) Object.assign(view, { x: destination.x ?? view.x, y: destination.y ?? view.y, zoom: destination.zoom ?? view.zoom });
      intro?.kill();
      view.tilt = SETTLED_TILT;
      progress.value = 1;
      syncCamera();
      draw();
    };
    syncPreference();
    if (!query.matches) {
      view.tilt = 0;
      draw();
      cameraMotion.current = gsap.to(view, { tilt: SETTLED_TILT, duration: 0.9, ease: 'power2.out', onUpdate: syncCamera });
      intro = gsap.to(progress, { value: 1, delay: 0.18, duration: 1.2, ease: 'power1.inOut', onUpdate: draw });
    }
    query.addEventListener('change', syncPreference);
    const lostContext = (event: Event) => {
      event.preventDefault();
      callbacks.current.onFailure();
    };
    gl.domElement.addEventListener('webglcontextlost', lostContext);
    return () => {
      controls.current = null;
      interrupt();
      intro?.kill();
      query.removeEventListener('change', syncPreference);
      gl.domElement.removeEventListener('webglcontextlost', lostContext);
      cancelAnimationFrame(readyFrame.current);
      ready.current = false;
    };
  }, [controls, get, gl, invalidate, mapCamera, trace]);

  useEffect(() => {
    if (reduced.current) return;
    const node = markers.current[REGIONS.indexOf(activeRegion)]?.querySelector('[data-terrain-pin]');
    if (!node) return;
    const motion = gsap.context(() => {
      gsap.fromTo(node, { scale: 1.45 }, { scale: 1, duration: 0.38, ease: 'power2.out', clearProps: 'transform' });
    });
    return () => motion.revert();
  }, [activeRegion, markers]);

  useEffect(() => () => { ground.dispose(); trace.geometry.dispose(); }, [ground, trace]);

  return (
    <>
      <color attach="background" args={['#18352b']} />
      <mesh geometry={ground}>
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      <mesh geometry={trace.geometry}>
        <meshBasicMaterial color="#c3e0ab" toneMapped={false} />
      </mesh>
      <mesh ref={amber}>
        <sphereGeometry args={[0.027, 12, 8]} />
        <meshBasicMaterial color="#ffd18a" toneMapped={false} />
      </mesh>
    </>
  );
}

export function TerrainScene(props: SceneProps) {
  const { elevations, error } = useTerrainViewModel();
  const failure = useRef(props.onFailure);
  failure.current = props.onFailure;
  useEffect(() => {
    if (error) failure.current();
  }, [error]);
  if (!elevations) return null;

  return (
    <Canvas orthographic camera={{ near: 0.1, far: 35 }} dpr={[1, 1.5]} frameloop="demand" gl={{ alpha: false, powerPreference: 'low-power' }}>
      <Suspense fallback={null}>
        <Terrain {...props} elevations={elevations} />
      </Suspense>
    </Canvas>
  );
}
