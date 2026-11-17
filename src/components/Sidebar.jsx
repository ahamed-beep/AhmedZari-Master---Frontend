import React from 'react'
import { Menu, Avatar, Button, Tag, Typography } from 'antd'
import {
  ShoppingCartOutlined,
  AppstoreOutlined,
  TeamOutlined,
  AccountBookOutlined,
  HistoryOutlined,
  BarChartOutlined,
  SettingOutlined,
  LogoutOutlined,
} from '@ant-design/icons'
import { brand, siderGradient } from '../theme.js'

const NAV_ITEMS = [
  { key: 'sale', label: 'Sale', icon: <ShoppingCartOutlined />, adminOnly: false },
  { key: 'products', label: 'Products', icon: <AppstoreOutlined />, adminOnly: false },
  { key: 'employees', label: 'Employees', icon: <TeamOutlined />, adminOnly: true },
  { key: 'ledger', label: 'Ledger', icon: <AccountBookOutlined />, adminOnly: false },
  { key: 'history', label: 'Sales History', icon: <HistoryOutlined />, adminOnly: false },
  { key: 'reports', label: 'Reports', icon: <BarChartOutlined />, adminOnly: true },
  { key: 'settings', label: 'Settings', icon: <SettingOutlined />, adminOnly: true },
]

function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || 'U'
}

// Full-height nav column, reused inside the desktop Sider and the mobile Drawer.
export default function SideNav({ page, setPage, user, onLogout, settings }) {
  const shopName = (settings && settings.shopName) || 'AgroPoint'
  const items = NAV_ITEMS.filter((i) => !i.adminOnly || user.role === 'admin').map((i) => ({
    key: i.key,
    icon: i.icon,
    label: i.label,
  }))

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: siderGradient,
      }}
    >
      {/* Brand */}
      <div style={{ padding: '22px 20px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: 'rgba(255,255,255,0.14)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: 22,
          }}
        >
          🌿
        </div>
        <div style={{ minWidth: 0 }}>
          <Typography.Text
            style={{ color: '#fff', fontWeight: 700, fontSize: 16, display: 'block', lineHeight: 1.2 }}
            ellipsis
          >
            {shopName}
          </Typography.Text>
          <Typography.Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>
            POS System
          </Typography.Text>
        </div>
      </div>

      {/* Nav */}
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[page]}
        onClick={({ key }) => setPage(key)}
        items={items}
        style={{ background: 'transparent', borderInlineEnd: 'none', flex: 1, paddingTop: 6 }}
      />

      {/* User + logout */}
      <div
        style={{
          padding: 16, margin: 12, borderRadius: 12,
          background: 'rgba(255,255,255,0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Avatar style={{ background: brand.primary, fontWeight: 700, flexShrink: 0 }}>
            {initials(user.name)}
          </Avatar>
          <div style={{ minWidth: 0 }}>
            <Typography.Text style={{ color: '#fff', fontWeight: 600, display: 'block' }} ellipsis>
              {user.name}
            </Typography.Text>
            <Tag color={user.role === 'admin' ? 'gold' : 'green'} style={{ marginTop: 2 }}>
              {user.role === 'admin' ? 'Admin' : 'Employee'}
            </Tag>
          </div>
        </div>
        <Button icon={<LogoutOutlined />} onClick={onLogout} block ghost>
          Logout
        </Button>
      </div>
    </div>
  )
}
