import XCTest
import JoltCore

final class ScalarGraphTests: XCTestCase {
  func testSharedEvaluatorVectors() throws {
    struct Fixture: Decodable {
      let name: String
      let sources: [JoltScalarReading]
      let program: [JoltScalarInstruction]
      let expected: JoltScalarReading
    }
    let data=try Data(contentsOf: Bundle.module.url(forResource: "scalar-vectors", withExtension: "json")!)
    for fixture in try JSONDecoder().decode([Fixture].self, from: data) {
      let sample=try JoltScalarProgram(fixture.program, inputs: fixture.sources.count).sample(fixture.sources)
      XCTAssertEqual(sample.value, fixture.expected.value, accuracy: 1e-9, fixture.name)
      XCTAssertEqual(sample.velocity, fixture.expected.velocity, accuracy: 1e-9, fixture.name)
    }
  }
}
