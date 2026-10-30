import AVFoundation
import CoreMediaIO
import Foundation

// Physical USB screen capture. Timestamp arrivals with the host monotonic clock:
// muxed screen-source timestamps can compress elapsed time in MovieFileOutput.
// No frames are synthesized; dropped frames retain their elapsed-time gaps.
let args = CommandLine.arguments
guard args.count == 4, let seconds = Double(args[3]), seconds > 0 else {
    fatalError("Usage: record-iphone SCREEN_NAME OUTPUT.mp4 SECONDS")
}
let destination = URL(fileURLWithPath: args[2])
guard !FileManager.default.fileExists(atPath: destination.path) else { fatalError("Output already exists") }
var address = CMIOObjectPropertyAddress(
    mSelector: CMIOObjectPropertySelector(kCMIOHardwarePropertyAllowScreenCaptureDevices),
    mScope: CMIOObjectPropertyScope(kCMIOObjectPropertyScopeGlobal),
    mElement: CMIOObjectPropertyElement(kCMIOObjectPropertyElementMain))
var previous: UInt32 = 0, size = UInt32(MemoryLayout<UInt32>.size)
guard CMIOObjectGetPropertyData(CMIOObjectID(kCMIOObjectSystemObject), &address, 0, nil, size, &size, &previous) == noErr else { fatalError("Cannot read capture discovery setting") }
var enabled: UInt32 = 1
guard CMIOObjectSetPropertyData(CMIOObjectID(kCMIOObjectSystemObject), &address, 0, nil, size, &enabled) == noErr else { fatalError("Cannot discover USB screen sources") }
func restoreDiscovery() {
    CMIOObjectSetPropertyData(CMIOObjectID(kCMIOObjectSystemObject), &address, 0, nil, size, &previous)
}
defer { restoreDiscovery() }
var phone: AVCaptureDevice?
let discoveryDeadline = Date().addingTimeInterval(15)
while phone == nil && Date() < discoveryDeadline {
    phone = AVCaptureDevice.devices().first { $0.hasMediaType(.muxed) && $0.localizedName == args[1] }
    if phone == nil { RunLoop.current.run(until: Date().addingTimeInterval(0.25)) }
}
guard let phone else { restoreDiscovery(); fatalError("Named USB screen source is unavailable") }

final class Recorder: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate {
    let queue = DispatchQueue(label: "jolt.usb.screen.capture")
    var writer: AVAssetWriter?
    var input: AVAssetWriterInput?
    var adaptor: AVAssetWriterInputPixelBufferAdaptor?
    var start: UInt64 = 0
    var frames = 0, dropped = 0
    var dimensions: (Int, Int)?
    var failure: String?
    var elapsed: Double = 0

    func captureOutput(_ output: AVCaptureOutput, didOutput sample: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard failure == nil, let pixels = CMSampleBufferGetImageBuffer(sample) else { return }
        let now = DispatchTime.now().uptimeNanoseconds
        let width = CVPixelBufferGetWidth(pixels), height = CVPixelBufferGetHeight(pixels)
        do {
            if writer == nil {
                let file = try AVAssetWriter(outputURL: destination, fileType: .mp4)
                let video = AVAssetWriterInput(mediaType: .video, outputSettings: [
                    AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: width, AVVideoHeightKey: height])
                video.expectsMediaDataInRealTime = true
                guard file.canAdd(video) else { throw NSError(domain: "JoltCapture", code: 1) }
                file.add(video)
                adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: video, sourcePixelBufferAttributes: nil)
                guard file.startWriting() else { throw file.error ?? NSError(domain: "JoltCapture", code: 2) }
                file.startSession(atSourceTime: .zero)
                writer = file; input = video; start = now; dimensions = (width, height)
                print("RECORDING host-monotonic-timestamps"); fflush(stdout)
            }
            guard dimensions!.0 == width && dimensions!.1 == height else {
                failure = "Display dimensions changed; record one orientation per clip"; return
            }
            guard input!.isReadyForMoreMediaData else { dropped += 1; return }
            elapsed = Double(now - start) / 1_000_000_000
            guard adaptor!.append(pixels, withPresentationTime: CMTime(seconds: elapsed, preferredTimescale: 1_000_000)) else {
                failure = writer!.error?.localizedDescription ?? "Cannot append screen frame"; return
            }
            frames += 1
        } catch { failure = String(describing: error) }
    }
}

let session = AVCaptureSession(), recorder = Recorder()
let source: AVCaptureDeviceInput
do { source = try AVCaptureDeviceInput(device: phone) }
catch { restoreDiscovery(); throw error }
let output = AVCaptureVideoDataOutput()
output.alwaysDiscardsLateVideoFrames = true
output.setSampleBufferDelegate(recorder, queue: recorder.queue)
guard session.canAddInput(source), session.canAddOutput(output) else { restoreDiscovery(); fatalError("Unsupported screen capture configuration") }
session.addInput(source); session.addOutput(output)
var stopped = false
let signals = [SIGINT, SIGTERM].map { number -> DispatchSourceSignal in
    signal(number, SIG_IGN)
    let source = DispatchSource.makeSignalSource(signal: number, queue: .main)
    source.setEventHandler { stopped = true }
    source.resume()
    return source
}
defer { signals.forEach { $0.cancel() } }
session.startRunning()
let deadline = Date().addingTimeInterval(seconds)
while !stopped && Date() < deadline { RunLoop.current.run(until: Date().addingTimeInterval(0.1)) }
session.stopRunning()
let finished = DispatchSemaphore(value: 0)
recorder.queue.sync {
    recorder.input?.markAsFinished()
    if let writer = recorder.writer { writer.finishWriting { finished.signal() } }
    else { recorder.failure = "No screen frames received"; finished.signal() }
}
let timedOut = finished.wait(timeout: .now() + 30) != .success
if timedOut || recorder.failure != nil || recorder.writer?.status != .completed {
    print("Capture failed: \(recorder.failure ?? recorder.writer?.error?.localizedDescription ?? "timeout")")
    restoreDiscovery()
    exit(1)
}
print("Saved \(recorder.frames) real frames, \(recorder.dropped) encoder drops, \(recorder.elapsed) seconds")
