// Vite raw-source imports keep catalog coverage independent of native Vue rendering.
declare module '*?raw' {
  const source: string
  export default source
}
