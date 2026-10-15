import { ref } from 'nativescript-vue'
export const transcript =
  'Hello, I need to find an invoice for October 2024. There was also a calculation for the iScanner.'
export const documents = [
  { title: 'Strategy-oct-2024.doc', icon: 'doc.text', color: '#cba5ed' },
  { title: 'Strategy-Pitch-Final.xls', icon: 'tablecells', color: '#9fcee5' },
]
export const waveform = [
  8, 13, 7, 21, 15, 24, 11, 17, 8, 22, 27, 14, 19, 8, 13, 24, 18, 9, 16, 22, 11, 7, 15,
  20, 10, 17, 8, 12,
]
// Demo messages stay available when switching between voice and chat, until the app exits.
export const sentMessages = ref<string[]>([])
