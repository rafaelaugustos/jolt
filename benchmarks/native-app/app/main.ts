import { runValuesScrollLists } from '../../values-scroll-lists/native'
declare const __JOLT_VALUES_LAB__: boolean
import { runNativeCI } from '../../native-ci'

if (__JOLT_VALUES_LAB__) runValuesScrollLists()
else runNativeCI()
