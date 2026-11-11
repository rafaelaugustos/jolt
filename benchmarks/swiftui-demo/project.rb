require 'pathname'
require 'xcodeproj'
root = File.expand_path(__dir__)
project = Xcodeproj::Project.new(File.join(root, 'JoltSwiftUIDemo.xcodeproj'))
reference = project.new(Xcodeproj::Project::Object::XCLocalSwiftPackageReference)
package = File.expand_path(ENV.fetch('JOLT_SWIFT_PACKAGE', File.join(root, '../..')))
reference.relative_path = Pathname.new(package).relative_path_from(Pathname.new(root)).to_s
project.root_object.package_references << reference
sources = %w[App.swift UITests.swift Expansion.swift Advanced.swift Characters.swift Panels.swift Activity.swift].map { |name| project.main_group.new_file(name) }
[[:ios, '17.0', 'JoltSwiftUIDemo'], [:osx, '14.0', 'JoltSwiftUIMac']].each do |platform, version, name|
  app = project.new_target(:application, name, platform, version)
  tests = project.new_target(:ui_test_bundle, name + 'UITests', platform, version)
  app.add_file_references([sources[0], sources[2], sources[3], sources[4], sources[5], sources[6]])
  tests.add_file_references([sources[1]])
  tests.add_dependency(app)
  product = project.new(Xcodeproj::Project::Object::XCSwiftPackageProductDependency)
  product.product_name = 'JoltSwiftUI'
  product.package = reference
  app.package_product_dependencies << product
  build_file = project.new(Xcodeproj::Project::Object::PBXBuildFile)
  build_file.product_ref = product
  app.frameworks_build_phase.files << build_file
  [app, tests].each do |target|
    target.build_configurations.each do |config|
      config.build_settings.merge!({
        'SWIFT_VERSION' => '6.0', 'GENERATE_INFOPLIST_FILE' => 'YES',
        'CODE_SIGNING_ALLOWED' => platform == :osx ? 'YES' : 'NO',
        'CODE_SIGN_IDENTITY' => '-',
        'PRODUCT_BUNDLE_IDENTIFIER' => "dev.jolt.#{target.name.downcase}",
      })
      if platform == :ios
        config.build_settings.merge!({
          'TARGETED_DEVICE_FAMILY' => '1,2',
          'INFOPLIST_KEY_UILaunchScreen_Generation' => 'YES',
          'INFOPLIST_KEY_UIApplicationSceneManifest_Generation' => 'YES',
        })
      end
      config.build_settings['TEST_TARGET_NAME'] = app.name if target == tests
    end
  end
  scheme = Xcodeproj::XCScheme.new
  scheme.add_build_target(app)
  scheme.add_test_target(tests)
  scheme.set_launch_target(app)
  scheme.save_as(project.path, name, true)
end
project.save
puts project.path
