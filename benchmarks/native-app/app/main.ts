import { runReaderAcceptance } from '../../acceptance-closure/native-reader'
declare const __JOLT_READER_ACCEPTANCE__: boolean
import { runMotionContracts } from '../../motion-contracts/native'
declare const __JOLT_MOTION_CONTRACTS__: boolean
import { runValuesScrollLists } from '../../values-scroll-lists/native'
declare const __JOLT_VALUES_LAB__: boolean
import { runNativeCI } from '../../native-ci'

if (__JOLT_READER_ACCEPTANCE__) runReaderAcceptance()
else if (__JOLT_COLLECTIONS_SCROLL__) runCollectionsScroll()
else if (__JOLT_MOTION_CONTRACTS__) runMotionContracts()
else if (__JOLT_VALUES_LAB__) runValuesScrollLists()
else runNativeCI()
import { runCollectionsScroll } from '../../collections-scroll/native'
declare const __JOLT_COLLECTIONS_SCROLL__: boolean
