/** A small, on-demand WebGL sculpture renderer. Jolt owns all motion values. */
export function createChromeSculpture(canvas: HTMLCanvasElement, onLost: () => void) {
  const gl = canvas.getContext('webgl', {
    alpha: true,
    antialias: true,
    premultipliedAlpha: false,
  })
  if (!gl) return undefined
  const vertex = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    uniform vec3 uRotation;
    uniform float uAspect;
    varying vec3 vNormal;
    varying vec3 vPosition;
    mat3 rx(float a) { float c=cos(a),s=sin(a);return mat3(1.,0.,0.,0.,c,s,0.,-s,c); }
    mat3 ry(float a) { float c=cos(a),s=sin(a);return mat3(c,0.,-s,0.,1.,0.,s,0.,c); }
    mat3 rz(float a) { float c=cos(a),s=sin(a);return mat3(c,s,0.,-s,c,0.,0.,0.,1.); }
    void main() {
      mat3 rotation=rz(uRotation.z)*ry(uRotation.y)*rx(uRotation.x);
      vec3 p=rotation*aPosition;
      vPosition=p;
      vNormal=rotation*aNormal;
      p.z-=5.6;
      gl_Position=vec4(p.x*2.65/uAspect,p.y*2.65,-1.004*p.z-.2004,-p.z);
    }`
  const fragment = `
    precision highp float;
    varying vec3 vNormal;
    varying vec3 vPosition;
    vec3 environment(vec3 r) {
      vec3 color=vec3(.025,.032,.028);
      float ceiling=smoothstep(.30,.46,r.y);
      color+=vec3(.7,.76,.71)*ceiling;
      float largeLight=(1.-smoothstep(.32,.48,abs(r.x+.32)))*smoothstep(.03,.14,r.y)*smoothstep(-.3,-.15,r.z);
      color+=vec3(3.3,3.4,3.15)*largeLight;
      float strip=(1.-smoothstep(.04,.11,abs(r.x+.27)))*smoothstep(-.6,.4,r.z);
      color+=vec3(2.5,2.7,2.4)*strip;
      float dark=exp(-pow((r.x-.5)*5.,2.))*smoothstep(-.4,.3,r.z);
      color*=1.-.96*dark;
      float acid=pow(max(0.,dot(r,normalize(vec3(.8,-.45,.5)))),5.);
      color+=vec3(.86,1.,.025)*acid*1.8;
      float edge=pow(max(0.,dot(r,normalize(vec3(-.4,-.7,-.5)))),12.);
      color+=vec3(.54,.62,.52)*edge;
      return color;
    }
    void main() {
      vec3 n=normalize(vNormal);
      vec3 view=normalize(vec3(0.,0.,5.6)-vPosition);
      vec3 reflected=reflect(-view,n);
      float fresnel=pow(1.-max(dot(n,view),0.),3.);
      vec3 color=environment(reflected)*(.8+fresnel*.45);
      color+=vec3(.035,.038,.025)*max(dot(n,normalize(vec3(-1.,2.,3.))),0.);
      color=pow(color/(color+vec3(.7)),vec3(.4545));
      gl_FragColor=vec4(color,1.);
    }`
  const shaders: WebGLShader[] = []
  function compile(type: number, source: string) {
    const shader = gl!.createShader(type)!
    gl!.shaderSource(shader, source)
    gl!.compileShader(shader)
    if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) {
      gl!.deleteShader(shader)
      throw new Error('Sculpture shader could not compile')
    }
    shaders.push(shader)
    return shader
  }
  const program = gl.createProgram()!
  try {
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex))
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment))
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error('Sculpture could not link')
  } catch {
    shaders.forEach((shader) => gl.deleteShader(shader))
    gl.deleteProgram(program)
    return undefined
  }
  const cross = (a: number[], b: number[]) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
  const normalize = (a: number[]) => {
    const length = Math.hypot(...a)
    return a.map((x) => x / length)
  }
  const center = (t: number) => [
    (1 + 0.36 * Math.cos(3 * t)) * Math.cos(2 * t),
    (1 + 0.36 * Math.cos(3 * t)) * Math.sin(2 * t),
    0.36 * Math.sin(3 * t),
  ]
  const vertices: number[] = [],
    indices: number[] = []
  const segments = 320,
    sides = 56
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2,
      c = center(t),
      next = center(t + 0.001)
    const tangent = normalize(next.map((v, j) => v - c[j]))
    const normal = normalize(cross(tangent, [0, 0, 1]))
    const binormal = normalize(cross(tangent, normal))
    for (let j = 0; j <= sides; j++) {
      const angle = (j / sides) * Math.PI * 2
      const n = normal.map((v, k) => v * Math.cos(angle) + binormal[k] * Math.sin(angle))
      vertices.push(...c.map((v, k) => v + n[k] * 0.295), ...n)
      if (i < segments && j < sides) {
        const a = i * (sides + 1) + j,
          b = a + sides + 1
        indices.push(a, b, a + 1, b, b + 1, a + 1)
      }
    }
  }
  const buffer = gl.createBuffer()!,
    index = gl.createBuffer()!
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW)
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index)
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW)
  gl.useProgram(program)
  for (const [name, offset] of [
    ['aPosition', 0],
    ['aNormal', 12],
  ] as const) {
    const location = gl.getAttribLocation(program, name)
    gl.enableVertexAttribArray(location)
    gl.vertexAttribPointer(location, 3, gl.FLOAT, false, 24, offset)
  }
  const rotation = gl.getUniformLocation(program, 'uRotation')
  const aspect = gl.getUniformLocation(program, 'uAspect')
  gl.enable(gl.DEPTH_TEST)
  gl.clearColor(0, 0, 0, 0)
  let disposed = false
  const lost = (event: Event) => {
    event.preventDefault()
    onLost()
  }
  canvas.addEventListener('webglcontextlost', lost)
  return {
    render(x: number, y: number, z: number) {
      if (disposed || gl.isContextLost()) return
      const size = Math.min(1.75, window.devicePixelRatio || 1)
      const width = Math.round(canvas.clientWidth * size),
        height = Math.round(canvas.clientHeight * size)
      if (!width || !height) return
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }
      gl.viewport(0, 0, width, height)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
      gl.uniform3f(rotation, x, y, z)
      gl.uniform1f(aspect, width / height)
      gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0)
    },
    dispose() {
      disposed = true
      canvas.removeEventListener('webglcontextlost', lost)
      gl.deleteBuffer(buffer)
      gl.deleteBuffer(index)
      gl.deleteProgram(program)
      shaders.forEach((shader) => gl.deleteShader(shader))
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    },
  }
}
