import React from 'react'
import { Card, Form, Input, Button, Typography, App } from 'antd'
import { ShopOutlined, SaveOutlined } from '@ant-design/icons'
import { save } from '../db.js'
import { api } from '../api.js'

export default function SettingsScreen({ settings, setSettings }) {
  const { message } = App.useApp()
  const [form] = Form.useForm()

  function handleSave(values) {
    const next = { ...settings, ...values }
    setSettings(next)
    save('settings', next)
    api.saveSettings(next)
      .then(() => message.success('Settings saved'))
      .catch((err) => message.error('Settings server par save nahi hui: ' + err.message))
  }

  return (
    <Card variant="outlined" style={{ maxWidth: 560, margin: '0 auto' }} title={<span><ShopOutlined /> Shop Information</span>}>
      <Typography.Paragraph type="secondary">These details appear on printed bills.</Typography.Paragraph>
      <Form form={form} layout="vertical" initialValues={settings} onFinish={handleSave} requiredMark={false}>
        <Form.Item name="shopName" label="Shop name">
          <Input placeholder="Shop name" />
        </Form.Item>
        <Form.Item name="address" label="Address">
          <Input placeholder="Address" />
        </Form.Item>
        <Form.Item name="phone" label="Phone number">
          <Input placeholder="Phone number" />
        </Form.Item>
        <Form.Item name="footer" label="Bill footer message">
          <Input placeholder="Thank you for shopping with us!" />
        </Form.Item>
        <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>Save Settings</Button>
      </Form>
    </Card>
  )
}
