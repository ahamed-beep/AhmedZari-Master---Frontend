import React, { useEffect, useRef, useState } from 'react'
import { Modal, Alert, Typography } from 'antd'
import { BrowserMultiFormatReader } from '@zxing/library'

export default function BarcodeScanner({ onDetected, onClose }) {
  const videoRef = useRef(null)
  const readerRef = useRef(null)
  const [error, setError] = useState('')
  const [notFoundMsg, setNotFoundMsg] = useState('')

  useEffect(() => {
    const reader = new BrowserMultiFormatReader()
    readerRef.current = reader

    reader
      .decodeFromVideoDevice(undefined, videoRef.current, (result) => {
        if (result) {
          const code = result.getText()
          const matched = onDetected(code)
          if (!matched) setNotFoundMsg(`Code "${code}" does not match any product`)
        }
      })
      .catch((e) => setError('Camera access failed: ' + e.message))

    return () => {
      try {
        reader.reset()
      } catch (e) {
        /* ignore */
      }
    }
  }, [onDetected])

  return (
    <Modal open title="📷 Scan Barcode" onCancel={onClose} footer={null} destroyOnHidden>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{ width: '100%', borderRadius: 10, background: '#000' }}
      />
      {error && <Alert type="error" showIcon message={error} style={{ marginTop: 10 }} />}
      {notFoundMsg && <Alert type="warning" showIcon message={notFoundMsg} style={{ marginTop: 10 }} />}
      <Typography.Paragraph type="secondary" style={{ marginTop: 10, marginBottom: 0 }}>
        Point the camera at the product barcode.
      </Typography.Paragraph>
    </Modal>
  )
}
