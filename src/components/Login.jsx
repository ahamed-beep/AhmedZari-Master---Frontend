import React, { useState } from 'react'
import { Form, Input, Button, Alert, Typography, Grid } from 'antd'
import {
  UserOutlined,
  LockOutlined,
  ArrowRightOutlined,
  ThunderboltFilled,
  AccountBookOutlined,
  LineChartOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import { load } from '../db.js'
import { api, setToken, ApiError } from '../api.js'
import { brand, loginGradient } from '../theme.js'

const { useBreakpoint } = Grid

const FEATURES = [
  { icon: <ThunderboltFilled />, text: 'Tez checkout — seconds mein bill banayein' },
  { icon: <AccountBookOutlined />, text: 'Customer ledger & udhaar tracking' },
  { icon: <LineChartOutlined />, text: 'Live sales & profit reports' },
]

export default function Login({ onLogin }) {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const settings = load('settings', {})
  const shopName = settings.shopName || 'AgroPoint'

  const screens = useBreakpoint()
  const isMobile = !screens.md

  async function handleSubmit({ username, password }) {
    setLoading(true)
    setError('')
    try {
      // Server-side login (bcrypt) → JWT for subsequent requests.
      const { token, user } = await api.login(username, password)
      setToken(token)
      await onLogin(user) // onLogin server se data sync karta hai
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Username ya password galat hai')
      } else {
        setError('Server se connect nahi ho saka — backend chal raha hai?')
      }
      setLoading(false)
    }
  }

  // ---- Branding (logo + wordmark), reused in both layouts ----
  const brandMark = (compact = false) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div
        style={{
          width: compact ? 44 : 52, height: compact ? 44 : 52, borderRadius: 16, flexShrink: 0,
          background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.22)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: compact ? 24 : 28, backdropFilter: 'blur(4px)',
        }}
      >
        🌿
      </div>
      <div style={{ minWidth: 0 }}>
        <Typography.Text style={{ color: '#fff', fontWeight: 700, fontSize: 19, display: 'block', lineHeight: 1.15 }} ellipsis>
          {shopName}
        </Typography.Text>
        <Typography.Text style={{ color: 'rgba(255,255,255,0.62)', fontSize: 12.5, letterSpacing: 0.4 }}>
          POINT OF SALE
        </Typography.Text>
      </div>
    </div>
  )

  // ---- The sign-in form, shared across layouts ----
  const formBlock = (
    <div style={{ width: '100%', maxWidth: 360, margin: '0 auto' }}>
      <Typography.Title level={2} style={{ margin: 0, fontWeight: 700 }}>
        Welcome back
      </Typography.Title>
      <Typography.Text type="secondary" style={{ fontSize: 15 }}>
        Apne account mein sign in karein
      </Typography.Text>

      {error && (
        <Alert type="error" showIcon message={error} style={{ margin: '20px 0 4px', borderRadius: 10 }} />
      )}

      <Form layout="vertical" onFinish={handleSubmit} requiredMark={false} disabled={loading} style={{ marginTop: 24 }}>
        <Form.Item name="username" rules={[{ required: true, message: 'Username daalein' }]}>
          <Input
            size="large"
            variant="filled"
            prefix={<UserOutlined style={{ color: brand.muted }} />}
            placeholder="Username"
            autoFocus
            autoComplete="username"
          />
        </Form.Item>
        <Form.Item name="password" rules={[{ required: true, message: 'Password daalein' }]} style={{ marginBottom: 20 }}>
          <Input.Password
            size="large"
            variant="filled"
            prefix={<LockOutlined style={{ color: brand.muted }} />}
            placeholder="Password"
            autoComplete="current-password"
          />
        </Form.Item>
        <Button
          type="primary" htmlType="submit" size="large" block loading={loading}
          icon={!loading ? <ArrowRightOutlined /> : undefined} iconPosition="end"
        >
          Sign in
        </Button>
      </Form>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 22, color: brand.muted }}>
        <SafetyCertificateOutlined style={{ fontSize: 14 }} />
        <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
          Secure session — sirf aap ke logout par khatam hoti hai
        </Typography.Text>
      </div>
    </div>
  )

  // ---- The branded emerald panel (soft decorative glow + value props) ----
  const brandPanel = (
    <div
      style={{
        position: 'relative', overflow: 'hidden', color: '#fff', background: loginGradient,
        ...(isMobile
          ? { padding: '30px 28px 34px' }
          : { flex: '0 0 46%', padding: '48px 44px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }),
      }}
    >
      {/* decorative glows */}
      <div style={{ position: 'absolute', top: -90, right: -60, width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', filter: 'blur(6px)' }} />
      <div style={{ position: 'absolute', bottom: -80, left: -70, width: 260, height: 260, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />

      <div style={{ position: 'relative', zIndex: 1 }}>{brandMark(isMobile)}</div>

      {!isMobile && (
        <div style={{ position: 'relative', zIndex: 1 }}>
          <Typography.Title level={2} style={{ color: '#fff', fontWeight: 700, lineHeight: 1.25, marginBottom: 12 }}>
            Apni dukaan, ek hi jagah se chalayein.
          </Typography.Title>
          <Typography.Paragraph style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15, marginBottom: 28 }}>
            Sales, stock aur customer ledger — sab kuch fast aur simple.
          </Typography.Paragraph>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {FEATURES.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                <span
                  style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: 'rgba(255,255,255,0.14)', display: 'inline-flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#fff',
                  }}
                >
                  {f.icon}
                </span>
                <Typography.Text style={{ color: 'rgba(255,255,255,0.92)', fontSize: 14.5 }}>{f.text}</Typography.Text>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isMobile && (
        <Typography.Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, position: 'relative', zIndex: 1 }}>
          © {shopName} POS
        </Typography.Text>
      )}
    </div>
  )

  return (
    <div
      style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: isMobile ? 16 : 28,
        background:
          'radial-gradient(1000px 520px at 100% 0%, #E4F0E8, transparent 60%), linear-gradient(160deg, #F5F8F6 0%, #E8F1EB 100%)',
      }}
    >
      <div
        style={{
          width: '100%', maxWidth: isMobile ? 440 : 980,
          display: 'flex', flexDirection: isMobile ? 'column' : 'row',
          background: '#fff', borderRadius: 24, overflow: 'hidden',
          boxShadow: '0 30px 80px rgba(11,61,40,0.20)',
          minHeight: isMobile ? 'auto' : 580,
        }}
      >
        {brandPanel}
        <div
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
            padding: isMobile ? '30px 22px 34px' : '56px 52px',
          }}
        >
          {formBlock}
        </div>
      </div>
    </div>
  )
}
