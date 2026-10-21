import * as THREE from 'three'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'

const POLE_HALF_LENGTH = 4.2
const CIRCLE_SEGMENTS = 200

// Yield: the simplest member of the pole family. A bare pole with a single
// circular track around it — finely dotted — carrying simple black dots in
// orbit. No circles, no center mass.
export function createYield() {
  const params = [
    { key: 'lineWidth', label: 'Line weight', min: 0.5, max: 8, step: 0.1, value: 1.5, unit: 'px' },
    { key: 'trackRadius', label: 'Track size', min: 0.5, max: 4, step: 0.01, value: 4 },
    { key: 'count', label: 'Dots', min: 1, max: 24, step: 1, value: 12 },
    { key: 'dotRadius', label: 'Dot size', min: 0.02, max: 0.4, step: 0.005, value: 0.1 },
    { key: 'dash', label: 'Dash', min: 0.01, max: 0.3, step: 0.005, value: 0.06 },
    { key: 'speed', label: 'Speed', min: 0, max: 2, step: 0.01, value: 0.3 },
    { key: 'tilt', label: 'Tilt', min: -90, max: 90, step: 1, value: 45, unit: '°' },
  ]

  const state = Object.fromEntries(params.map((p) => [p.key, p.value]))

  const group = new THREE.Group()
  group.rotation.z = -THREE.MathUtils.degToRad(state.tilt)

  const lineMaterial = new LineMaterial({ color: 0x000000, linewidth: state.lineWidth })
  const dashMaterial = new LineMaterial({
    color: 0x000000,
    linewidth: state.lineWidth,
    dashed: true,
    dashSize: state.dash * 0.5,
    gapSize: state.dash,
  })
  const dotMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 })
  const sphereGeometry = new THREE.SphereGeometry(1, 24, 12)

  // Static pole
  const poleGeometry = new LineGeometry()
  poleGeometry.setPositions([0, -POLE_HALF_LENGTH, 0, 0, POLE_HALF_LENGTH, 0])
  group.add(new Line2(poleGeometry, lineMaterial))

  // Finely dotted track, horizontal, centered on the pole
  const track = new Line2(new LineGeometry(), dashMaterial)
  group.add(track)

  function buildTrack() {
    const positions = []
    for (let s = 0; s <= CIRCLE_SEGMENTS; s++) {
      const t = (s / CIRCLE_SEGMENTS) * Math.PI * 2
      positions.push(
        Math.cos(t) * state.trackRadius,
        0,
        Math.sin(t) * state.trackRadius
      )
    }
    track.geometry.dispose()
    track.geometry = new LineGeometry()
    track.geometry.setPositions(positions)
    track.computeLineDistances()
  }
  buildTrack()

  // Orbiting dots
  const dotsGroup = new THREE.Group()
  group.add(dotsGroup)

  function buildDots() {
    for (const child of [...dotsGroup.children]) dotsGroup.remove(child)
    const count = Math.round(state.count)
    for (let i = 0; i < count; i++) {
      const dot = new THREE.Mesh(sphereGeometry, dotMaterial)
      dot.scale.setScalar(Math.max(state.dotRadius, 1e-4))
      dotsGroup.add(dot)
    }
    placeDots()
  }

  let angle = 0
  function placeDots() {
    const count = dotsGroup.children.length
    dotsGroup.children.forEach((dot, i) => {
      const a = angle + (i / count) * Math.PI * 2
      dot.position.set(
        Math.cos(a) * state.trackRadius,
        0,
        Math.sin(a) * state.trackRadius
      )
    })
  }

  buildDots()

  return {
    name: '19 — Yield',
    group,
    params,

    set(key, value) {
      state[key] = value
      if (key === 'lineWidth') {
        lineMaterial.linewidth = value
        dashMaterial.linewidth = value
      } else if (key === 'dash') {
        dashMaterial.dashSize = value * 0.5
        dashMaterial.gapSize = value
      } else if (key === 'tilt') {
        group.rotation.z = -THREE.MathUtils.degToRad(value)
      } else if (key === 'dotRadius') {
        for (const dot of dotsGroup.children) dot.scale.setScalar(Math.max(value, 1e-4))
      } else if (key === 'trackRadius') {
        buildTrack()
        placeDots()
      } else if (key === 'count') {
        buildDots()
      }
    },

    setResolution(width, height) {
      lineMaterial.resolution.set(width, height)
      dashMaterial.resolution.set(width, height)
    },

    update(dt) {
      angle += state.speed * dt
      placeDots()
    },
  }
}
