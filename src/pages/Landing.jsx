import React from 'react';
import { Button, Typography, Space, Card } from 'antd';
import { UserOutlined, TeamOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      justifyContent: 'center', 
      alignItems: 'center', 
      background: '#f0f2f5',
      padding: '20px'
    }}>
      <Title level={2} style={{ marginBottom: '40px' }}>Cycle Tracker</Title>
      
      <Space direction="vertical" size="large" style={{ width: '100%', maxWidth: '300px' }}>
        <Card 
          hoverable 
          style={{ textAlign: 'center', cursor: 'pointer' }}
          onClick={() => navigate('/rider')}
        >
          <UserOutlined style={{ fontSize: '40px', color: '#1890ff', marginBottom: '16px' }} />
          <Title level={4}>Rider App</Title>
          <Text type="secondary">Toggle duty & track rides</Text>
        </Card>

        <Card 
          hoverable 
          style={{ textAlign: 'center', cursor: 'pointer' }}
          onClick={() => navigate('/admin')}
        >
          <TeamOutlined style={{ fontSize: '40px', color: '#52c41a', marginBottom: '16px' }} />
          <Title level={4}>Admin Dashboard</Title>
          <Text type="secondary">Monitor users & timelines</Text>
        </Card>
      </Space>
    </div>
  );
};

export default Landing;
