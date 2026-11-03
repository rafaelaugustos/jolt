import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

void main() => runApp(const MaterialApp(debugShowCheckedModeBanner: false, home: Comparison()));

class Comparison extends StatefulWidget {
  const Comparison({super.key});
  @override
  State<Comparison> createState() => _ComparisonState();
}

class _ComparisonState extends State<Comparison> with SingleTickerProviderStateMixin {
  late final AnimationController phase = AnimationController(vsync: this, duration: const Duration(milliseconds: 1000));
  static const channel = MethodChannel('dev.jolt.comparison');
  void blockRuntime() {
    final clock = Stopwatch()..start();
    while (clock.elapsedMilliseconds < 300) { /* deliberate benchmark workload */ }
  }
  @override
  void dispose() { phase.dispose(); super.dispose(); }
  Widget action(String label, String id, VoidCallback callback) => Padding(
    padding: const EdgeInsets.only(top: 8),
    child: Semantics(identifier: id, child: SizedBox(height: 48, width: double.infinity, child: ElevatedButton(style: ElevatedButton.styleFrom(backgroundColor: const Color(0xff254c3c), foregroundColor: const Color(0xffeff5da), elevation: 0, animationDuration: Duration.zero, splashFactory: NoSplash.splashFactory, overlayColor: Colors.transparent), onPressed: callback, child: Text(label)))),
  );
  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xff102922),
    body: SafeArea(child: Padding(padding: const EdgeInsets.all(24), child: Column(children: [
      const Text('Flutter · linear ping-pong', style: TextStyle(color: Color(0xffeff5da), fontSize: 22)),
      const SizedBox(height: 24),
      SizedBox(width: 288, height: 120, child: Align(alignment: Alignment.centerLeft, child: AnimatedBuilder(
        animation: phase,
        child: const SizedBox(width: 48, height: 48, child: ColoredBox(color: Color(0xffd6e7b5))),
        builder: (context, child) => Transform.translate(offset: Offset(phase.value * 240, 0), child: Opacity(opacity: 1 - phase.value * 0.6, child: child)),
      ))),
      action('Start', 'comparison-start', () { phase.value = 0; phase.repeat(reverse: true); }),
      action('Stop', 'comparison-stop', () => phase.stop(canceled: false)),
      action('Block app runtime · 300 ms', 'comparison-runtime-block', blockRuntime),
      action('Block UI thread · 300 ms', 'comparison-ui-block', () { channel.invokeMethod<void>('blockUi'); }),
      const Padding(padding: EdgeInsets.only(top: 16), child: Text('Benchmark configuration: motion enabled. Dart UI-isolate work and platform UI-thread work are separate labelled probes.', style: TextStyle(color: Color(0xffc9d7bc), fontSize: 12))),
    ]))),
  );
}
