import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, MeshDistortMaterial } from '@react-three/drei'
import { useRef, useMemo, Suspense } from 'react'
import * as THREE from 'three'

// Each ring: radius, node count, orbit speed, direction, node color/size
const RING_CONFIGS = [
  { radius: 1.55, count: 5,  speed: 0.16, dir:  1, color: '#6366f1', emissive: '#4f46e5', size: 0.105 },
  { radius: 2.55, count: 8,  speed: 0.10, dir: -1, color: '#8b5cf6', emissive: '#7c3aed', size: 0.078 },
  { radius: 3.40, count: 11, speed: 0.065, dir: 1, color: '#a78bfa', emissive: '#8b5cf6', size: 0.056 },
]

// Central distorted core (entry-point metaphor)
function CentralCore() {
  const ref = useRef<THREE.Mesh>(null!)
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    ref.current.rotation.y = t * 0.28
    ref.current.rotation.x = Math.sin(t * 0.14) * 0.28
  })
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.58, 64, 64]} />
      <MeshDistortMaterial
        color="#5046e4"
        emissive="#4338ca"
        emissiveIntensity={0.55}
        roughness={0.02}
        metalness={0.96}
        distort={0.44}
        speed={2.4}
      />
    </mesh>
  )
}

// Single orbiting file-node
function OrbitalNode({
  angle, radius, yOff, size, color, emissive, phase,
}: {
  angle: number; radius: number; yOff: number; size: number
  color: THREE.Color; emissive: THREE.Color; phase: number
}) {
  const ref = useRef<THREE.Mesh>(null!)
  const x = radius * Math.cos(angle)
  const z = radius * Math.sin(angle)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    ref.current.position.y = yOff + Math.sin(t * 0.85 + phase) * 0.07
    const pulse = 1 + Math.sin(t * 2.0 + phase) * 0.13
    ref.current.scale.setScalar(pulse)
    ;(ref.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
      0.55 + Math.sin(t * 1.6 + phase) * 0.32
  })

  return (
    <mesh ref={ref} position={[x, yOff, z]}>
      <sphereGeometry args={[size, 14, 14]} />
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={0.6}
        roughness={0.06}
        metalness={0.82}
      />
    </mesh>
  )
}

// A full orbiting ring group (all nodes rotate together)
function OrbitRing({ cfgIdx }: { cfgIdx: number }) {
  const cfg = RING_CONFIGS[cfgIdx]
  const groupRef = useRef<THREE.Group>(null!)

  const nodeData = useMemo(
    () =>
      Array.from({ length: cfg.count }, (_, i) => ({
        angle: (i / cfg.count) * Math.PI * 2 + cfgIdx * 0.55,
        yOff: (Math.random() - 0.5) * 0.55,
        phase: i * 0.72 + cfgIdx * 1.3,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useFrame(({ clock }) => {
    groupRef.current.rotation.y = clock.getElapsedTime() * cfg.speed * cfg.dir
  })

  const nodeColor   = useMemo(() => new THREE.Color(cfg.color),   [cfg.color])
  const emissiveClr = useMemo(() => new THREE.Color(cfg.emissive), [cfg.emissive])

  return (
    <group ref={groupRef}>
      {nodeData.map((nd, i) => (
        <OrbitalNode
          key={i}
          angle={nd.angle}
          radius={cfg.radius}
          yOff={nd.yOff}
          size={cfg.size}
          color={nodeColor}
          emissive={emissiveClr}
          phase={nd.phase}
        />
      ))}
    </group>
  )
}

// Pulsing dependency lines from center → inner ring (static angles)
function DependencyLines() {
  const groupRef = useRef<THREE.Group>(null!)
  const innerCfg = RING_CONFIGS[0]

  const lines = useMemo(() => {
    const origin = new THREE.Vector3(0, 0, 0)
    return Array.from({ length: innerCfg.count }, (_, i) => {
      const angle = (i / innerCfg.count) * Math.PI * 2 + 0.55
      return {
        from: origin,
        to: new THREE.Vector3(innerCfg.radius * Math.cos(angle), 0, innerCfg.radius * Math.sin(angle)),
        phase: i * 0.45,
      }
    })
  }, [innerCfg.count, innerCfg.radius])

  const lineObjects = useMemo(
    () =>
      lines.map(({ from, to }) => {
        const geo = new THREE.BufferGeometry().setFromPoints([from, to])
        const mat = new THREE.LineBasicMaterial({ color: '#818cf8', transparent: true, opacity: 0.14 })
        return new THREE.Line(geo, mat)
      }),
    [lines],
  )

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    groupRef.current.rotation.y = t * innerCfg.speed * innerCfg.dir
    groupRef.current.children.forEach((child, i) => {
      const mat = (child as THREE.Line).material as THREE.LineBasicMaterial
      mat.opacity = 0.10 + Math.sin(t * 0.75 + lines[i].phase) * 0.09
    })
  })

  return (
    <group ref={groupRef}>
      {lineObjects.map((obj, i) => (
        <primitive key={i} object={obj} />
      ))}
    </group>
  )
}

// Ambient star-dust particles
function AmbientDust() {
  const ref = useRef<THREE.Points>(null!)
  const COUNT = 110

  const positions = useMemo(() => {
    const pos = new Float32Array(COUNT * 3)
    for (let i = 0; i < COUNT; i++) {
      const r     = 1.6 + Math.random() * 3.2
      const theta = Math.random() * Math.PI * 2
      const phi   = Math.acos(2 * Math.random() - 1)
      pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.55
      pos[i * 3 + 2] = r * Math.cos(phi)
    }
    return pos
  }, [])

  useFrame(({ clock }) => {
    ;(ref.current.material as THREE.PointsMaterial).opacity =
      0.22 + Math.sin(clock.getElapsedTime() * 0.35) * 0.1
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={COUNT} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color="#a78bfa" size={0.028} transparent opacity={0.28} sizeAttenuation />
    </points>
  )
}

export function HeroScene() {
  return (
    <Canvas
      camera={{ position: [0, 2.2, 9.2], fov: 44 }}
      style={{ background: 'transparent' }}
      dpr={[1, 1.5]}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.18} />
        <pointLight position={[5, 6, 5]}   intensity={4.5} color="#818cf8" />
        <pointLight position={[-6, -4, -4]} intensity={2.0} color="#a78bfa" />
        <pointLight position={[0, -2, 3]}  intensity={1.5} color="#6366f1" />
        <CentralCore />
        <DependencyLines />
        <OrbitRing cfgIdx={0} />
        <OrbitRing cfgIdx={1} />
        <OrbitRing cfgIdx={2} />
        <AmbientDust />
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate
          autoRotateSpeed={0.45}
          enableDamping
          dampingFactor={0.04}
          maxPolarAngle={Math.PI * 0.64}
          minPolarAngle={Math.PI * 0.36}
        />
      </Suspense>
    </Canvas>
  )
}
