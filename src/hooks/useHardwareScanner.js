import { useEffect, useRef } from 'react'

// Most USB/HID barcode scanners "type" the code very fast (a few ms between
// characters) and then send an Enter key. Humans typing on a keyboard are
// almost always slower than this. We use that timing gap to tell a real
// barcode scan apart from normal typing, so the cashier/admin never has to
// click anything - they just point the scanner and pull the trigger and the
// product shows up automatically, anywhere in the app this hook is active.
const MAX_GAP_MS = 40 // max ms allowed between two characters of a scan
const MIN_CODE_LEN = 3

export default function useHardwareScanner(onScan, enabled = true) {
  const bufferRef = useRef('')
  const lastTimeRef = useRef(0)

  useEffect(() => {
    if (!enabled) return

    function handleKeyDown(e) {
      // Ignore modifier-only / navigation keys
      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return

      const now = Date.now()
      const gap = now - lastTimeRef.current
      lastTimeRef.current = now

      if (e.key === 'Enter') {
        const code = bufferRef.current.trim()
        bufferRef.current = ''
        if (code.length >= MIN_CODE_LEN) {
          onScan(code)
        }
        return
      }

      if (e.key.length === 1) {
        // If the previous character came in slower than a scanner would
        // type, this is a fresh sequence (likely human typing) - restart
        // the buffer instead of mixing it with old characters.
        if (gap > MAX_GAP_MS) {
          bufferRef.current = ''
        }
        bufferRef.current += e.key
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [onScan, enabled])
}
