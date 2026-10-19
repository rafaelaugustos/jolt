require 'fileutils'
require 'xcodeproj'
directory = File.expand_path(ARGV.fetch(0))
FileUtils.mkdir_p(directory)
project = Xcodeproj::Project.new(File.join(directory, 'InteractionTests.xcodeproj'))
target = project.new_target(:ui_test_bundle, 'InteractionTests', :ios, '18.0')
target.add_file_references([project.main_group.new_file(File.expand_path('interaction-ios-ui.swift', __dir__))])
target.build_configurations.each do |config|
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'dev.jolt.interaction-uitests'
  config.build_settings['GENERATE_INFOPLIST_FILE'] = 'YES'
  config.build_settings['SWIFT_VERSION'] = '5.0'
  config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
  config.build_settings['TARGETED_DEVICE_FAMILY'] = '1,2'
end
project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(target)
scheme.add_test_target(target)
scheme.save_as(project.path, 'InteractionTests')
