import React from 'react'
import { SafeAreaView, View, Text, Pressable, StyleSheet } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  runOnUI,
} from 'react-native-reanimated'

export default function App() {
  const phase = useSharedValue(0)
  const pose = useAnimatedStyle(() => ({
    transform: [{ translateX: phase.value * 240 }],
    opacity: 1 - phase.value * 0.6,
  }))
  React.useEffect(() => () => cancelAnimation(phase), [phase])
  const blockRuntime = () => {
    const end = performance.now() + 300
    while (performance.now() < end) {}
  }
  const blockUI = () =>
    runOnUI(() => {
      'worklet'
      const end = performance.now() + 300
      while (performance.now() < end) {}
    })()
  const action = (label: string, id: string, onPress: () => void) => (
    <Pressable
      testID={id}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.button}
    >
      <Text>{label}</Text>
    </Pressable>
  )
  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.content}>
        <Text style={styles.title}>Reanimated · linear ping-pong</Text>
        <View style={styles.stage}>
          <Animated.View testID="comparison-tile" style={[styles.tile, pose]} />
        </View>
        {action('Start', 'comparison-start', () => {
          cancelAnimation(phase)
          phase.value = 0
          phase.value = withRepeat(
            withTiming(1, { duration: 1000, easing: Easing.linear }),
            -1,
            true,
          )
        })}
        {action('Stop', 'comparison-stop', () => cancelAnimation(phase))}
        {action('Block app runtime · 300 ms', 'comparison-runtime-block', blockRuntime)}
        {action('Block UI thread · 300 ms', 'comparison-ui-block', blockUI)}
        <Text style={styles.note}>
          Benchmark configuration: motion enabled. App JS and UI worklet blocking are
          separate probes. No per-frame app-JS callbacks.
        </Text>
      </View>
    </SafeAreaView>
  )
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#102922' },
  content: { padding: 24 },
  title: { fontSize: 22, color: '#eff5da' },
  stage: {
    width: 288,
    height: 120,
    marginTop: 24,
    alignSelf: 'center',
    justifyContent: 'center',
  },
  tile: { width: 48, height: 48, backgroundColor: '#D6E7B5' },
  button: {
    height: 48,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d6e7b5',
    borderRadius: 8,
  },
  note: { fontSize: 12, color: '#c9d7bc', marginTop: 16 },
})
