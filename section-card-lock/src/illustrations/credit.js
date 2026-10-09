import * as THREE from 'three'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'

const SAMPLES = 48
const REST = 0.5
const STAGGER = 0.14

const hash = (i) => {
  const x = Math.sin((i + 1) * 127.1) * 43758.5453
  return x - Math.floor(x)
}

// The 3D rate field. A floor grid of dots (the possibility plane); from its
// left edge a rate curve rises over every depth row, each row reaching a
// different height — together a wireframe rate surface, undulating as it
// breathes. Dotted cross-lines stitch the curves across depth at every other
// column; node dots ride the curves. Rows redraw themselves left to right in
// a staggered sweep, back row to front. Composed for a 3/4 orthographic view.
export function createCredit() {
  const params = [
    { key: 'lineWidth', label: 'Line weight', min: 0.5, max: 8, step: 0.1, value: 1, unit: 'px' },
    { key: 'cols', label: 'Grid width', min: 4, max: 20, step: 1, value: 8 },
    { key: 'rows', label: 'Depth rows', min: 3, max: 12, step: 1, value: 8 },
    { key: 'spacing', label: 'Grid spacing', min: 0.15, max: 0.7, step: 0.01, value: 0.35 },
    { key: 'height', label: 'Height', min: 0.5, max: 3, step: 0.01, value: 3 },
    { key: 'gridDot', label: 'Grid dot', min: 0, max: 0.08, step: 0.002, value: 0.01 },
    { key: 'nodeDot', label: 'Node dot', min: 0, max: 0.12, step: 0.002, value: 0.03 },
    { key: 'power', label: 'Curvature', min: 1, max: 3, step: 0.01, value: 2.46 },
    { key: 'breathe', label: 'Breathing', min: 0, max: 1, step: 0.01, value: 0 },
    { key: 'cross', label: 'Cross lines', type: 'toggle', labels: ['Off', 'On'], value: 0 },
    { key: 'lineStyle', label: 'Line style', type: 'toggle', labels: ['Dashed', 'Solid'], value: 1 },
    { key: 'dash', label: 'Dash', min: 0.02, max: 0.3, step: 0.01, value: 0.11 },
    { key: 'drawTime', label: 'Draw time', min: 0.4, max: 3, step: 0.05, value: 1.2, unit: 's' },
    { key: 'hold', label: 'Hold', min: 1, max: 10, step: 0.1, value: 4, unit: 's' },
    { key: 'speed', label: 'Speed', min: 0, max: 2, step: 0.01, value: 0.6 },
    { key: 'rotation', label: 'Auto orbit', min: 0, max: 1, step: 0.01, value: 0.33 },
    { key: 'tilt', label: 'Tilt', min: -90, max: 90, step: 1, value: 0, unit: '°' },
  ]

  const state = Object.fromEntries(params.map((p) => [p.key, p.value]))

  const group = new THREE.Group()

  const solidMaterial = new LineMaterial({ color: 0x000000, linewidth: state.lineWidth })
  const dashMaterial = new LineMaterial({
    color: 0x000000,
    linewidth: state.lineWidth,
    dashed: true,
    dashSize: state.dash * 0.45,
    gapSize: state.dash,
  })
  const dotMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 })
  const sphereGeometry = new THREE.SphereGeometry(1, 24, 12)

  // Spinner carries the auto-orbit; the outer group keeps the tilt
  const spinner = new THREE.Group()
  group.add(spinner)
  const floorGroup = new THREE.Group()
  const curveGroup = new THREE.Group()
  const crossGroup = new THREE.Group()
  const nodeGroup = new THREE.Group()
  spinner.add(floorGroup, curveGroup, crossGroup, nodeGroup)

  let curves = [] // { line, dashed, phase, exitH, z }
  let crosses = [] // { line, u }
  let nodes = [] // { mesh, row, u }

  const W = () => (state.cols - 1) * state.spacing
  const D = () => (state.rows - 1) * state.spacing

  function build() {
    for (const g of [floorGroup, curveGroup, crossGroup, nodeGroup]) {
      for (const c of [...g.children]) {
        c.geometry?.isLineSegmentsGeometry && c.geometry.dispose()
        g.remove(c)
      }
    }
    curves = []
    crosses = []
    nodes = []

    const cols = Math.round(state.cols)
    const rows = Math.round(state.rows)

    // Floor: the possibility plane (y = 0)
    for (let cx = 0; cx < cols; cx++) {
      for (let cz = 0; cz < rows; cz++) {
        const dot = new THREE.Mesh(sphereGeometry, dotMaterial)
        dot.position.set(
          -W() / 2 + cx * state.spacing,
          0,
          -D() / 2 + cz * state.spacing
        )
        floorGroup.add(dot)
      }
    }

    // One curve per depth row, rising toward the back
    for (let j = 0; j < rows; j++) {
      const geometry = new LineGeometry()
      const flat = []
      for (let s = 0; s <= SAMPLES; s++) flat.push(s, 0, 0)
      geometry.setPositions(flat)
      const line = new Line2(geometry, state.lineStyle === 0 ? dashMaterial : solidMaterial)
      curveGroup.add(line)
      const rowFrac = rows === 1 ? 1 : j / (rows - 1)
      curves.push({
        line,
        phase: j * 0.9,
        exitH: (0.35 + 0.65 * rowFrac) * (0.85 + hash(j) * 0.3),
        z: -D() / 2 + j * state.spacing,
      })

      // Every curve gets a start and end node, plus interior ones
      const nodeUs = [0, 1]
      for (let cx = 2; cx < cols - 1; cx += 2) nodeUs.push(cx / (cols - 1))
      for (const u of nodeUs) {
        const mesh = new THREE.Mesh(sphereGeometry, dotMaterial)
        nodeGroup.add(mesh)
        nodes.push({ mesh, row: j, u })
      }
    }

    // Dotted cross-depth connectors at every other column
    for (let cx = 2; cx < cols; cx += 2) {
      const geometry = new LineGeometry()
      const flat = []
      for (let j = 0; j < rows; j++) flat.push(j, 0, 0)
      geometry.setPositions(flat.length >= 6 ? flat : [0, 0, 0, 1, 0, 0])
      const line = new Line2(geometry, dashMaterial)
      crossGroup.add(line)
      crosses.push({ line, u: cx / (cols - 1) })
    }

    applyDotSizes()
  }

  function applyDotSizes() {
    for (const d of floorGroup.children) {
      d.visible = state.gridDot > 0
      d.scale.setScalar(Math.max(state.gridDot, 1e-4))
    }
    for (const n of nodes) n.mesh.scale.setScalar(Math.max(state.nodeDot, 1e-4))
  }

  build()
  crossGroup.visible = state.cross === 1

  const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)
  const clamp01 = (v) => THREE.MathUtils.clamp(v, 0, 1)

  function curveY(c, u, time) {
    const wobble = 1 + state.breathe * 0.25 * Math.sin(time * state.speed * 2 + c.phase)
    return state.height * c.exitH * wobble * Math.pow(u, state.power)
  }

  let cycleT = 0
  let time = 0

  return {
    name: '17 — Credit',
    group,
    params,

    set(key, value) {
      state[key] = value
      if (key === 'lineWidth') {
        solidMaterial.linewidth = value
        dashMaterial.linewidth = value
      } else if (key === 'dash') {
        dashMaterial.dashSize = value * 0.45
        dashMaterial.gapSize = value
      } else if (key === 'tilt') {
        group.rotation.z = -THREE.MathUtils.degToRad(value)
      } else if (key === 'gridDot' || key === 'nodeDot') {
        applyDotSizes()
      } else if (key === 'cross') {
        crossGroup.visible = value === 1
      } else if (key === 'lineStyle') {
        for (const c of curves) c.line.material = value === 0 ? dashMaterial : solidMaterial
      } else if (key === 'cols' || key === 'rows' || key === 'spacing') {
        build()
        cycleT = 0
      }
    },

    setResolution(width, height) {
      solidMaterial.resolution.set(width, height)
      dashMaterial.resolution.set(width, height)
    },

    update(dt) {
      time += dt
      cycleT += dt
      spinner.rotation.y += state.rotation * dt
      const J = curves.length
      const drawLen = STAGGER * (J - 1) + state.drawTime
      const drawStart = REST
      const holdStart = drawStart + drawLen
      const retractStart = holdStart + state.hold
      const cycle = retractStart + drawLen + 0.4
      const t = cycleT % cycle

      curves.forEach((c, j) => {
        const o = (J - 1 - j) * STAGGER // back row leads the sweep
        let head, tail
        if (t < drawStart) {
          head = 0; tail = 0
        } else if (t < holdStart) {
          head = ease(clamp01((t - drawStart - o) / state.drawTime)); tail = 0
        } else if (t < retractStart) {
          head = 1; tail = 0
        } else {
          head = 1; tail = ease(clamp01((t - retractStart - o) / state.drawTime))
        }
        c.head = head
        c.tail = tail
        const span = head - tail
        c.line.visible = span > 0.005
        if (!c.line.visible) return
        const positions = []
        for (let s = 0; s <= SAMPLES; s++) {
          const u = tail + (s / SAMPLES) * span
          positions.push(-W() / 2 + u * W(), curveY(c, u, time), c.z)
        }
        c.line.geometry.setPositions(positions)
        if (state.lineStyle === 0) c.line.computeLineDistances()
      })

      // Cross connectors appear where the sweep has passed on every row
      for (const cr of crosses) {
        const covered = curves.every((c) => (c.head ?? 0) >= cr.u && (c.tail ?? 0) <= cr.u)
        cr.line.visible = covered && state.cross === 1
        if (!cr.line.visible) continue
        const positions = []
        for (const c of curves) {
          positions.push(-W() / 2 + cr.u * W(), curveY(c, cr.u, time), c.z)
        }
        cr.line.geometry.setPositions(positions)
        cr.line.computeLineDistances()
      }

      // Nodes grow in as the drawing head approaches and shrink out as the
      // retracting tail nears — no pops at either end of the loop
      const sm = (x) => x * x * (3 - 2 * x)
      for (const n of nodes) {
        const c = curves[n.row]
        if (!c) continue
        const head = c.head ?? 0
        const tail = c.tail ?? 0
        const fIn = sm(clamp01((head - n.u + 0.1) / 0.1))
        const fOut = sm(clamp01((n.u - tail) / 0.1 + (n.u === 0 && tail === 0 ? 1 : 0)))
        const alive = sm(clamp01((head - tail) / 0.08))
        const scale = state.nodeDot * fIn * fOut * alive
        n.mesh.visible = scale > 1e-3
        if (n.mesh.visible) {
          n.mesh.scale.setScalar(scale)
          n.mesh.position.set(-W() / 2 + n.u * W(), curveY(c, n.u, time), c.z)
        }
      }
    },
  }
}
