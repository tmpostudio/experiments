import * as THREE from 'three'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'

const CIRCLE_SEGMENTS = 120
const POOL_SIZE = 64 // max simultaneous wake rings
const UP = new THREE.Vector3(0, 1, 0)

// A dot circles a track on the ripple plane, shedding expanding rings in its
// wake. Each ring grows like a water ripple (fast, then decelerating) while
// fading out. Variation jitters every spawned ring — size, ellipticity,
// placement, lifetime — so the wake reads organic instead of mechanical.
export function createLiquidity3() {
  const params = [
    { key: 'lineWidth', label: 'Line weight', min: 0.5, max: 8, step: 0.1, value: 1, unit: 'px' },
    { key: 'trackRadius', label: 'Track size', min: 0.3, max: 3, step: 0.01, value: 3 },
    { key: 'wakeSize', label: 'Wake size', min: 0.1, max: 2.5, step: 0.01, value: 2.5 },
    { key: 'wakeLife', label: 'Wake length', min: 0.5, max: 6, step: 0.1, value: 6, unit: 's' },
    { key: 'density', label: 'Wake density', min: 1, max: 12, step: 0.5, value: 9.5 },
    { key: 'variation', label: 'Variation', min: 0, max: 1, step: 0.01, value: 0 },
    { key: 'orientation', label: 'Wake plane', type: 'toggle', labels: ['Flat', 'Upright'], value: 1 },
    { key: 'dotRadius', label: 'Dot size', min: 0, max: 0.8, step: 0.01, value: 0.15 },
    { key: 'speed', label: 'Speed', min: 0, max: 2, step: 0.01, value: 0.67 },
    { key: 'pitch', label: 'Pitch', min: -90, max: 90, step: 1, value: 0, unit: '°' },
    { key: 'tilt', label: 'Tilt', min: -90, max: 90, step: 1, value: 0, unit: '°' },
  ]

  const state = Object.fromEntries(params.map((p) => [p.key, p.value]))

  const group = new THREE.Group()
  group.rotation.x = THREE.MathUtils.degToRad(state.pitch)

  // One shared unit circle in the XZ plane; wake rings differ by transform
  const unitCircle = new LineGeometry()
  {
    const positions = []
    for (let s = 0; s <= CIRCLE_SEGMENTS; s++) {
      const t = (s / CIRCLE_SEGMENTS) * Math.PI * 2
      positions.push(Math.cos(t), 0, Math.sin(t))
    }
    unitCircle.setPositions(positions)
  }

  // Pooled rings, each with its own material so opacity can fade per ring
  const pool = []
  for (let i = 0; i < POOL_SIZE; i++) {
    const material = new LineMaterial({
      color: 0x000000,
      linewidth: state.lineWidth,
      transparent: true,
      opacity: 1,
    })
    const ring = new Line2(unitCircle, material)
    ring.visible = false
    group.add(ring)
    pool.push({
      ring,
      material,
      active: false,
      age: 0,
      life: 1,
      finalRadius: 1,
      squashX: 1,
      squashZ: 1,
    })
  }

  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(1, 48, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000 })
  )
  dot.scale.setScalar(state.dotRadius)
  group.add(dot)

  let angle = 0
  let spawnTimer = 0
  let nextInterval = 0

  const jitter = (amount) => 1 + (Math.random() - 0.5) * 2 * amount

  function spawnRing() {
    const slot =
      pool.find((s) => !s.active) ||
      pool.reduce((oldest, s) => (s.age / s.life > oldest.age / oldest.life ? s : oldest))

    const v = state.variation
    slot.active = true
    slot.age = 0
    slot.life = state.wakeLife * jitter(v * 0.3)
    slot.finalRadius = state.wakeSize * jitter(v * 0.6)
    slot.squashX = jitter(v * 0.25)
    slot.squashZ = jitter(v * 0.25)

    const wobble = state.trackRadius * v * 0.15
    slot.ring.position.set(
      Math.cos(angle) * state.trackRadius + (Math.random() - 0.5) * 2 * wobble,
      0,
      Math.sin(angle) * state.trackRadius + (Math.random() - 0.5) * 2 * wobble
    )
    if (state.orientation) {
      // Upright: ring plane perpendicular to the track — the ring's normal
      // (its local Y) points along the direction of travel, like smoke rings
      const tangent = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle))
      slot.ring.quaternion.setFromUnitVectors(UP, tangent)
    } else {
      slot.ring.quaternion.identity()
    }
    slot.ring.rotateY(Math.random() * Math.PI * 2) // spin within its own plane
    slot.ring.visible = true
  }

  return {
    name: '06 — Liquidity 3',
    group,
    params,

    set(key, value) {
      state[key] = value
      if (key === 'lineWidth') {
        for (const slot of pool) slot.material.linewidth = value
      } else if (key === 'pitch') {
        group.rotation.x = THREE.MathUtils.degToRad(value)
      } else if (key === 'tilt') {
        group.rotation.z = -THREE.MathUtils.degToRad(value)
      } else if (key === 'dotRadius') {
        dot.visible = value > 0
        dot.scale.setScalar(Math.max(value, 1e-4))
      }
    },

    setResolution(width, height) {
      for (const slot of pool) slot.material.resolution.set(width, height)
    },

    update(dt) {
      if (state.speed > 0) {
        angle = (angle + state.speed * dt) % (Math.PI * 2)
        spawnTimer += dt
        if (spawnTimer >= nextInterval) {
          spawnTimer = 0
          nextInterval = (1 / state.density) * jitter(state.variation * 0.4)
          spawnRing()
        }
      }

      dot.position.set(
        Math.cos(angle) * state.trackRadius,
        0,
        Math.sin(angle) * state.trackRadius
      )

      for (const slot of pool) {
        if (!slot.active) continue
        slot.age += dt
        const p = slot.age / slot.life
        if (p >= 1) {
          slot.active = false
          slot.ring.visible = false
          continue
        }
        // Water-ripple growth: fast at first, decelerating; fade out to zero
        const radius = 0.05 + (slot.finalRadius - 0.05) * Math.sqrt(p)
        slot.ring.scale.set(radius * slot.squashX, 1, radius * slot.squashZ)
        slot.material.opacity = Math.pow(1 - p, 1.5)
      }
    },
  }
}
