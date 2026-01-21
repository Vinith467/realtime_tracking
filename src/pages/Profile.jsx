import React from 'react';
import { Layout, Avatar, List, Button, Typography } from 'antd';
import { UserOutlined, SettingOutlined, LogoutOutlined } from '@ant-design/icons';

const { Content } = Layout;
const { Title } = Typography;

const Profile = () => {
  return (
    <Layout style={{ height: '100%', padding: '20px', background: '#fff' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '30px', marginTop: '40px' }}>
            <Avatar size={80} icon={<UserOutlined />} style={{ marginBottom: '16px', background: '#1890ff' }} />
            <Title level={4}>John Doe</Title>
            <Typography.Text type="secondary">+91 98765 43210</Typography.Text>
        </div>

        <List
            itemLayout="horizontal"
            dataSource={[
                { title: 'Settings', icon: <SettingOutlined /> },
                { title: 'Help & Support', icon: <UserOutlined /> },
                { title: 'Log Out', icon: <LogoutOutlined />, danger: true }
            ]}
            renderItem={item => (
                <List.Item onClick={() => {}}>
                    <List.Item.Meta
                        avatar={<Avatar icon={item.icon} style={{ background: 'transparent', color: item.danger ? 'red' : '#000' }} />}
                        title={<span style={{ color: item.danger ? 'red' : 'inherit' }}>{item.title}</span>}
                    />
                </List.Item>
            )}
        />
    </Layout>
  );
};

export default Profile;
