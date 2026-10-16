import { useFrame, useThree } from "@react-three/fiber";
import { gsap } from "gsap";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

const BLIPS = 16;
const TAU = Math.PI * 2;

type Props = { accent: string; friendly: string; bg: string };

// Radar visto desde arriba: anillos, barrido y puntos anónimos que se encienden cuando pasa el barrido
export function RadarScene({ accent, friendly, bg }: Props) {
  const camera = useThree((s) => s.camera);
  const sweep = useRef<THREE.Group>(null);
  const pulses = useRef<(THREE.Mesh | null)[]>([]);
  const blipMeshes = useRef<(THREE.Mesh | null)[]>([]);
  const cam = useRef({ y: 2.5, z: 19 });

  const blips = useMemo(
    () =>
      Array.from({ length: BLIPS }, (_, i) => {
        const a = Math.random() * TAU;
        const r = 1.5 + Math.random() * 5.8;
        return { x: Math.cos(a) * r, z: -Math.sin(a) * r, angle: a, hunter: i < 2 };
      }),
    [],
  );

  // Entrada de cámara con GSAP: baja desde lejos hasta la vista de radar
  useEffect(() => {
    const t = gsap.to(cam.current, { y: 9, z: 11, duration: 2.4, ease: "power3.out" });
    return () => {
      t.kill();
    };
  }, []);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    camera.position.set(Math.sin(t * 0.12) * 2.2, cam.current.y, cam.current.z);
    camera.lookAt(0, 0, 0);

    const sw = sweep.current;
    if (!sw) return;
    sw.rotation.y -= dt * 1.1;
    const leading = ((sw.rotation.y % TAU) + TAU) % TAU;

    blips.forEach((b, i) => {
      const m = blipMeshes.current[i];
      if (!m) return;
      const since = (((b.angle - leading) % TAU) + TAU) % TAU; // ángulo transcurrido desde que pasó el barrido
      const k = Math.exp(-since * 1.1);
      (m.material as THREE.MeshBasicMaterial).opacity = 0.08 + k * 0.92;
      m.scale.setScalar(0.7 + k * 0.9);
    });

    pulses.current.forEach((m, i) => {
      if (!m) return;
      const p = ((t + i * 1.6) % 4.8) / 4.8;
      m.scale.setScalar(0.3 + p * 8);
      (m.material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.55;
    });
  });

  const line = { transparent: true, depthWrite: false, side: THREE.DoubleSide } as const;

  return (
    <>
      <color attach="background" args={[bg]} />
      <fog attach="fog" args={[bg, 12, 32]} />

      <gridHelper args={[70, 70, accent, accent]} position={[0, -0.02, 0]}>
        <lineBasicMaterial attach="material" color={accent} transparent opacity={0.2} />
      </gridHelper>

      {/* Anillos fijos */}
      <group rotation={[-Math.PI / 2, 0, 0]}>
        {[2, 4, 6, 8].map((r) => (
          <mesh key={r}>
            <ringGeometry args={[r - 0.025, r + 0.025, 96]} />
            <meshBasicMaterial color={accent} opacity={0.5} {...line} />
          </mesh>
        ))}
        {/* Pulsos que se expanden */}
        {[0, 1, 2].map((i) => (
          <mesh key={i} ref={(m) => void (pulses.current[i] = m)}>
            <ringGeometry args={[0.97, 1, 96]} />
            <meshBasicMaterial color={accent} opacity={0.5} {...line} />
          </mesh>
        ))}
      </group>

      {/* Ejes en cruz */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[16, 0.02]} />
        <meshBasicMaterial color={accent} opacity={0.35} {...line} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
        <planeGeometry args={[16, 0.02]} />
        <meshBasicMaterial color={accent} opacity={0.35} {...line} />
      </mesh>

      {/* Barrido: la estela son cuñas apiladas cada vez más cortas */}
      <group ref={sweep}>
        <group rotation={[-Math.PI / 2, 0, 0]}>
          {[0.9, 0.7, 0.5, 0.32, 0.16].map((len) => (
            <mesh key={len}>
              <circleGeometry args={[8, 48, 0, len]} />
              <meshBasicMaterial color={accent} opacity={0.11} {...line} />
            </mesh>
          ))}
        </group>
        <mesh position={[4, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[8, 0.05]} />
          <meshBasicMaterial color={accent} opacity={0.9} {...line} />
        </mesh>
      </group>

      {/* Puntos anónimos; los cazadores (rojos) son más grandes */}
      {blips.map((b, i) => (
        <mesh key={i} position={[b.x, 0.08, b.z]} ref={(m) => void (blipMeshes.current[i] = m)}>
          <sphereGeometry args={[b.hunter ? 0.2 : 0.13, 12, 12]} />
          <meshBasicMaterial color={b.hunter ? accent : friendly} transparent opacity={0.1} depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}
