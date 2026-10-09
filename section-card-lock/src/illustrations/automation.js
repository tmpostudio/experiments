import * as THREE from 'three'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'

const MAX_LINES = 16 // simultaneous connections
const IMPACT_MAX = 12 // simultaneous impact bursts
const IMPACT_LIFE = 0.6 // seconds for a burst to expand and decay

// Deterministic per-dot hash in [0, 1): cluster layout is stable across
// sessions and exports; only the firing pattern is live-random
const hash = (i, seed) => {
  const x = Math.sin((i + 1) * seed) * 43758.5453
  return x - Math.floor(x)
}

// A cluster of dots scattered in 3D space. Connections fire intermittently
// between random pairs: each line draws from its source dot to its target
// (0 -> 100%) so the direction is visible, then the tail retracts through —
// a pulse passing along the wire. The whole cluster slowly rotates, which
// stands in for an auto-orbiting camera.
export function createAutomation() {
  const params = [
    { key: 'lineWidth', label: 'Line weight', min: 0.5, max: 8, step: 0.1, value: 1.2, unit: 'px' },
    { key: 'count', label: 'Dots', min: 3, max: 40, step: 1, value: 40 },
    { key: 'spread', label: 'Cluster size', min: 0.5, max: 4, step: 0.01, value: 4 },
    { key: 'dotRadius', label: 'Dot size', min: 0, max: 0.4, step: 0.005, value: 0.05 },
    { key: 'firing', label: 'Firing rate', min: 0, max: 10, step: 0.1, value: 2.5, unit: '/s' },
    { key: 'drawSpeed', label: 'Draw speed', min: 0.2, max: 5, step: 0.1, value: 2.4 },
    { key: 'impact', label: 'Impact', type: 'toggle', labels: ['Off', 'On'], value: 1 },
    { key: 'rotation', label: 'Rotation', min: 0, max: 1, step: 0.01, value: 0.15 },
    { key: 'tilt', label: 'Tilt', min: -90, max: 90, step: 1, value: 0, unit: '°' },
  ]

  const state = Object.fromEntries(params.map((p) => [p.key, p.value]))

  const group = new THREE.Group()
  const cluster = new THREE.Group() // rotates; holds dots AND lines
  group.add(cluster)

  const lineMaterial = new LineMaterial({ color: 0x000000, linewidth: state.lineWidth })
  const dotMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 })
  const sphereGeometry = new THREE.SphereGeometry(1, 48, 24)

  // Dot positions: hashed random points in a ball of radius `spread`
  function dotPosition(i) {
    const theta = hash(i, 127.1) * Math.PI * 2
    const phi = Math.acos(2 * hash(i, 269.5) - 1)
    const r = state.spread * Math.cbrt(hash(i, 419.2))
    return new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta)
    )
  }

  const dotsGroup = new THREE.Group()
  cluster.add(dotsGroup)

  // Impact bursts: an outlined sphere silhouette — a camera-facing hairline
  // circle — that expands from a struck dot and decays. Each has its own
  // material so it can fade independently.
  const unitCircle = new LineGeometry()
  {
    const positions = []
    for (let i = 0; i <= 64; i++) {
      const t = (i / 64) * Math.PI * 2
      positions.push(Math.cos(t), Math.sin(t), 0)
    }
    unitCircle.setPositions(positions)
  }
  const impacts = []
  for (let i = 0; i < IMPACT_MAX; i++) {
    const material = new LineMaterial({
      color: 0x000000,
      linewidth: state.lineWidth,
      transparent: true,
      opacity: 1,
    })
    const ring = new Line2(unitCircle, material)
    ring.visible = false
    cluster.add(ring)
    impacts.push({ ring, material, active: false, age: 0 })
  }

  function spawnImpact(pos) {
    const slot = impacts.find((s) => !s.active) ||
      impacts.reduce((oldest, s) => (s.age > oldest.age ? s : oldest))
    slot.active = true
    slot.age = 0
    slot.ring.position.copy(pos)
    slot.ring.scale.setScalar(1e-4)
    slot.ring.visible = true
  }

  // Connection slots
  const slots = []
  for (let i = 0; i < MAX_LINES; i++) {
    const geometry = new LineGeometry()
    geometry.setPositions([0, 0, 0, 1, 0, 0])
    const line = new Line2(geometry, lineMaterial)
    line.visible = false
    cluster.add(line)
    slots.push({ line, geometry, active: false, a: 0, b: 0, p: 0 })
  }

  function buildDots() {
    for (const child of [...dotsGroup.children]) dotsGroup.remove(child)
    const count = Math.round(state.count)
    for (let i = 0; i < count; i++) {
      const dot = new THREE.Mesh(sphereGeometry, dotMaterial)
      dot.position.copy(dotPosition(i))
      dot.visible = state.dotRadius > 0
      dot.scale.setScalar(Math.max(state.dotRadius, 1e-4))
      dotsGroup.add(dot)
    }
    // Old connections may reference dots that no longer exist
    for (const slot of slots) {
      slot.active = false
      slot.line.visible = false
    }
  }

  buildDots()

  let fireTimer = 0
  let nextInterval = 0

  function fire() {
    const count = dotsGroup.children.length
    if (count < 2) return
    const slot = slots.find((s) => !s.active)
    if (!slot) return
    const a = Math.floor(Math.random() * count)
    let b = Math.floor(Math.random() * (count - 1))
    if (b >= a) b += 1
    slot.active = true
    slot.a = a
    slot.b = b
    slot.p = 0
    slot.hitFired = false
  }

  const A = new THREE.Vector3()
  const B = new THREE.Vector3()
  const head = new THREE.Vector3()
  const tail = new THREE.Vector3()

  return {
    name: '10 — Automation',
    group,
    params,

    set(key, value) {
      state[key] = value
      if (key === 'lineWidth') {
        lineMaterial.linewidth = value
        for (const slot of impacts) slot.material.linewidth = value
      } else if (key === 'tilt') {
        group.rotation.z = -THREE.MathUtils.degToRad(value)
      } else if (key === 'dotRadius') {
        for (const dot of dotsGroup.children) {
          dot.visible = value > 0
          dot.scale.setScalar(Math.max(value, 1e-4))
        }
      } else if (key === 'count' || key === 'spread') {
        buildDots()
      }
    },

    setResolution(width, height) {
      lineMaterial.resolution.set(width, height)
      for (const slot of impacts) slot.material.resolution.set(width, height)
    },

    update(dt, view) {
      cluster.rotation.y += state.rotation * dt

      // Intermittent firing with a little jitter on the interval
      if (state.firing > 0) {
        fireTimer += dt
        if (fireTimer >= nextInterval) {
          fireTimer = 0
          nextInterval = (1 / state.firing) * (0.7 + Math.random() * 0.6)
          fire()
        }
      }

      // Animate connections: head draws out A -> B, then tail retracts A -> B
      for (const slot of slots) {
        if (!slot.active) continue
        slot.p += state.drawSpeed * dt
        // The head just reached the target dot: the hit
        if (!slot.hitFired && slot.p >= 1) {
          slot.hitFired = true
          if (state.impact === 1) spawnImpact(dotsGroup.children[slot.b].position)
        }
        const headT = Math.min(slot.p, 1)
        const tailT = THREE.MathUtils.clamp(slot.p - 1, 0, 1)
        if (tailT >= 1) {
          slot.active = false
          slot.line.visible = false
          continue
        }
        A.copy(dotsGroup.children[slot.a].position)
        B.copy(dotsGroup.children[slot.b].position)
        tail.copy(A).lerp(B, tailT)
        head.copy(A).lerp(B, headT)
        slot.geometry.setPositions([tail.x, tail.y, tail.z, head.x, head.y, head.z])
        slot.line.visible = headT - tailT > 1e-3
      }

      // Impact bursts: expand fast, decelerate, fade out. Rings billboard to
      // the camera (compensating for the cluster's own rotation) so they read
      // as sphere silhouettes from any angle.
      const finalRadius = Math.max(state.dotRadius * 6, 0.3)
      let billboard = null
      if (view) {
        billboard = cluster.getWorldQuaternion(new THREE.Quaternion()).invert()
          .multiply(view.camera.quaternion)
      }
      for (const slot of impacts) {
        if (!slot.active) continue
        slot.age += dt
        const p = slot.age / IMPACT_LIFE
        if (p >= 1) {
          slot.active = false
          slot.ring.visible = false
          continue
        }
        slot.ring.scale.setScalar(Math.max(finalRadius * Math.sqrt(p), 1e-4))
        slot.material.opacity = Math.pow(1 - p, 1.5)
        if (billboard) slot.ring.quaternion.copy(billboard)
      }
    },
  }
}
