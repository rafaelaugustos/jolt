import JoltSwiftUI

let tween = try JoltTransition.tween(milliseconds: 200, ease: .easeOut)
let spring = JoltTransition.spring(.bouncy)
let recipe = JoltPreset.fadeInUp.recipe()
guard case .tween(200, let curve) = tween.kind, curve == [0, 0, 0.58, 1],
  case .spring = spring.kind, recipe.from.y == 24, recipe.from.opacity == 0
else { fatalError("Shared definitions are not compiled into JoltCore") }
print("JoltCore definitions:", tween.kind, spring.kind, recipe.from)
