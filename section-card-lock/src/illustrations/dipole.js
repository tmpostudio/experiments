import * as THREE from 'three'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'

const CIRCLE_SEGMENTS = 160
const POLE_HALF_LENGTH = 4.2

// Each circle sits in a vertical plane through the pole axis, its center pushed
// out radially by `distance`. When distance === circleRadius every circle is
// tangent to the origin, which is the look of the source drawing.
export function createDipole() {
  const params = [
    { key: 'lineWidth', label: 'Line weight', min: 0.5, max: 8, step: 0.1, value: 1.5, unit: 'px' },
    { key: 'circleRadius', label: 'Circle size', min: 0.3, max: 2.5, step: 0.01, value: 1.44 },
    { key: 'distance', label: 'Distance from pole', min: 0, max: 3, step: 0.01, value: 3 },
    { key: 'dotRadius', label: 'Dot size', min: 0, max: 1.5, step: 0.01, value: 0.12 },
    { key: 'count', label: 'Circles', min: 2, max: 24, step: 1, value: 24 },
    { key: 'speed', label: 'Speed', min: 0, max: 2, step: 0.01, value: 0.3 },
    { key: 'tilt', label: 'Tilt', min: -90, max: 90, step: 1, value: 45, unit: '°' },
  ]

  const state = Object.fromEntries(params.map((p) => [p.key, p.value]))

  const group = new THREE.Group()
  group.rotation.z = -THREE.MathUtils.degToRad(state.tilt)

  const lineMaterial = new LineMaterial({
    color: 0x000000,
    linewidth: state.lineWidth,
  })

  // Static pole line
  const poleGeometry = new LineGeometry()
  poleGeometry.setPositions([0, -POLE_HALF_LENGTH, 0, 0, POLE_HALF_LENGTH, 0])
  const pole = new Line2(poleGeometry, lineMaterial)
  group.add(pole)

  // Static center sphere (unit radius, scaled by dotRadius)
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(1, 48, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000 })
  )
  sphere.scale.setScalar(state.dotRadius)
  group.add(sphere)

  // Rotating circles
  const circlesGroup = new THREE.Group()
  group.add(circlesGroup)

  function buildCircles() {
    for (const child of [...circlesGroup.children]) {
      child.geometry.dispose()
      circlesGroup.remove(child)
    }

    const R = state.circleRadius
    const D = state.distance
    const count = Math.round(state.count)

    for (let i = 0; i < count; i++) {
      const theta = (i / count) * Math.PI * 2
      const radial = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta))
      const positions = []
      for (let s = 0; s <= CIRCLE_SEGMENTS; s++) {
        const t = (s / CIRCLE_SEGMENTS) * Math.PI * 2
        const x = radial.x * (D + R * Math.cos(t))
        const y = R * Math.sin(t)
        const z = radial.z * (D + R * Math.cos(t))
        positions.push(x, y, z)
      }
      const geometry = new LineGeometry()
      geometry.setPositions(positions)
      circlesGroup.add(new Line2(geometry, lineMaterial))
    }
  }

  buildCircles()

  return {
    name: '01 — Earn',
    group,
    params,

    set(key, value) {
      state[key] = value
      if (key === 'lineWidth') {
        lineMaterial.linewidth = value
      } else if (key === 'tilt') {
        group.rotation.z = -THREE.MathUtils.degToRad(value)
      } else if (key === 'dotRadius') {
        sphere.visible = value > 0
        sphere.scale.setScalar(Math.max(value, 1e-4))
      } else if (key === 'circleRadius' || key === 'distance' || key === 'count') {
        buildCircles()
      }
    },

    setResolution(width, height) {
      lineMaterial.resolution.set(width, height)
    },

    update(dt) {
      circlesGroup.rotation.y += state.speed * dt
    },
  }
}
