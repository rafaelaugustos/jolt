export default defineEventHandler(async () => {
  await new Promise((resolve) => setTimeout(resolve, 50))
  return { ready: true }
})
