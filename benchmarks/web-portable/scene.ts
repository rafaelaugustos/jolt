import type { WebMotionScope } from '../../src/web/public.js'
/** Actual WebGL uniforms. The application owns this renderer, Jolt owns playback. */
export function portableScene(canvas: HTMLCanvasElement, scope: WebMotionScope) {
  const gl = canvas.getContext('webgl', { antialias: true, preserveDrawingBuffer: true })
  if (!gl) return undefined
  const shader = (kind: number, source: string) => {
    const value = gl.createShader(kind)!
    gl.shaderSource(value, source)
    gl.compileShader(value)
    if (!gl.getShaderParameter(value, gl.COMPILE_STATUS))
      throw new Error(gl.getShaderInfoLog(value) ?? 'Shader compile failed')
    return value
  }
  const vertex = shader(
    gl.VERTEX_SHADER,
    'attribute vec2 point;varying vec2 uv;void main(){uv=(point+1.0)*0.5;gl_Position=vec4(point,0.0,1.0);}',
  )
  const fragment = shader(
    gl.FRAGMENT_SHADER,
    `precision mediump float;varying vec2 uv;uniform float glow0;uniform float glow1;uniform float glow2;
void main(){vec3 color=vec3(0.086,0.153,0.235);for(int i=0;i<3;i++){vec2 p=vec2((uv.x-(float(i)+0.5)/3.0)*6.0,(uv.y-0.5)*2.0);float edge=1.0-smoothstep(0.48,0.52,length(p));float light=i==0?glow0:i==1?glow1:glow2;color=mix(color,mix(vec3(0.08,0.17,0.25),vec3(0.39,0.89,0.76),light),edge);}gl_FragColor=vec4(color,1.0);}`,
  )
  const program = gl.createProgram()!
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(program) ?? 'Shader link failed')
  const buffer = gl.createBuffer()!
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  )
  gl.useProgram(program)
  const location = gl.getAttribLocation(program, 'point')
  gl.enableVertexAttribArray(location)
  gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0)
  const targets = [0, 1, 2].map((i) => ({
    location: gl.getUniformLocation(program, `glow${i}`)!,
  }))
  let disposed = false,
    frame: number | undefined,
    frames = 0
  const draw = () => {
    if (disposed || gl.isContextLost()) return
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    frames++
  }
  const loop = () => {
    frame = undefined
    draw()
    if (!disposed) frame = requestAnimationFrame(loop)
  }
  const render = (active: boolean) => {
    if (frame !== undefined) cancelAnimationFrame(frame)
    frame = active && !disposed ? requestAnimationFrame(loop) : undefined
  }
  const definition = {
    name: 'demo/glow',
    units: ['intensity'],
    read: (target: object) =>
      Number(gl.getUniform(program, (target as (typeof targets)[number]).location)),
    write: (target: object, value: number) => {
      gl.useProgram(program)
      gl.uniform1f((target as (typeof targets)[number]).location, value)
    },
    alive: () => !disposed && !gl.isContextLost(),
    encode: (value: number) => [value],
    decode: (value: readonly number[]) => value[0]!,
  }
  const properties = targets.map((target) => scope.property(target, definition))
  properties.forEach((property) => property.set(0.1))
  draw()
  scope.add(() => {
    disposed = true
    render(false)
    gl.deleteBuffer(buffer)
    gl.deleteProgram(program)
    gl.deleteShader(vertex)
    gl.deleteShader(fragment)
  })
  return {
    properties,
    draw,
    render,
    get frames() {
      return frames
    },
  }
}
