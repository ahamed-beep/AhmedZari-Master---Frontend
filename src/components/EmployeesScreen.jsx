import React, { useState } from 'react'
import { Card, Table, Button, Input, Modal, Form, Select, Tag, Space, Popconfirm, App } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, UserAddOutlined } from '@ant-design/icons'
import { save, uid } from '../db.js'
import { api } from '../api.js'

export default function EmployeesScreen({ employees, setEmployees }) {
  const { message } = App.useApp()
  const [editing, setEditing] = useState(null) // null=closed, {}=new, {...}=edit
  const [form] = Form.useForm()

  function openNew() {
    form.resetFields()
    form.setFieldsValue({ name: '', username: '', password: '', role: 'employee' })
    setEditing({})
  }
  function openEdit(emp) {
    form.resetFields()
    // Password backend se nahi aata — khali chhorne par purana barqarar rehta hai.
    form.setFieldsValue({ ...emp, password: '' })
    setEditing(emp)
  }

  function handleSave(values) {
    const isEdit = !!(editing && editing.id)
    const data = {
      name: (values.name || '').trim(),
      username: (values.username || '').trim(),
      password: values.password || '',
      role: values.role || 'employee',
    }
    if (employees.some((x) => x.username === data.username && x.id !== (editing && editing.id))) {
      message.error('This username is already taken')
      return
    }
    const id = isEdit ? editing.id : uid()
    const item = { id, ...data }
    const { password, ...safe } = item
    const updated = isEdit
      ? employees.map((e) => (e.id === id ? { ...e, ...safe } : e))
      : [...employees, safe]
    setEmployees(updated)
    save('employees', updated)
    setEditing(null)
    const req = isEdit ? api.updateEmployee(id, item) : api.createEmployee(item)
    req.then(() => message.success('User saved')).catch((err) => message.error('Save failed: ' + err.message))
  }

  function handleDelete(id) {
    const updated = employees.filter((e) => e.id !== id)
    setEmployees(updated)
    save('employees', updated)
    api.deleteEmployee(id).then(() => message.success('User deleted')).catch((err) => message.error('Delete failed: ' + err.message))
  }

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name', render: (v) => <b>{v}</b> },
    { title: 'Username', dataIndex: 'username', key: 'username' },
    {
      title: 'Role', dataIndex: 'role', key: 'role',
      render: (r) => <Tag color={r === 'admin' ? 'gold' : 'green'}>{r === 'admin' ? 'Admin' : 'Employee'}</Tag>,
    },
    {
      title: 'Actions', key: 'actions', align: 'right', width: 140,
      render: (_, e) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(e)} />
          {employees.length > 1 && (
            <Popconfirm title="Delete this user?" okText="Delete" okButtonProps={{ danger: true }} onConfirm={() => handleDelete(e.id)}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  const isEdit = !!(editing && editing.id)

  return (
    <Card
      variant="outlined"
      title="Employees & Admins"
      extra={<Button type="primary" icon={<PlusOutlined />} onClick={openNew}>Add User</Button>}
    >
      <Table
        rowKey="id"
        columns={columns}
        dataSource={employees}
        size="middle"
        pagination={{ pageSize: 12, hideOnSinglePage: true, showSizeChanger: false }}
      />

      <Modal
        open={editing !== null}
        title={isEdit ? 'Edit User' : 'New User'}
        onCancel={() => setEditing(null)}
        onOk={() => form.submit()}
        okText="Save"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleSave} requiredMark="optional" style={{ marginTop: 12 }}>
          <Form.Item name="name" label="Full name" rules={[{ required: true, message: 'Enter a name' }]}>
            <Input prefix={<UserAddOutlined />} placeholder="Full name" />
          </Form.Item>
          <Form.Item name="username" label="Username" rules={[{ required: true, message: 'Enter a username' }]}>
            <Input placeholder="Username" autoComplete="off" />
          </Form.Item>
          <Form.Item
            name="password"
            label={isEdit ? 'Password (blank = unchanged)' : 'Password'}
            rules={isEdit ? [] : [{ required: true, message: 'Enter a password' }]}
          >
            <Input.Password placeholder={isEdit ? 'Leave blank to keep current' : 'Password'} autoComplete="new-password" />
          </Form.Item>
          <Form.Item name="role" label="Role">
            <Select
              options={[
                { value: 'employee', label: 'Employee' },
                { value: 'admin', label: 'Admin' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
