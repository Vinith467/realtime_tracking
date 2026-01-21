import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
// Ant Design (Desktop) doesn't have a great bottom tab bar for mobile.
// I should construct one using separate buttons or a fixed footer row.
// Or just use antd Layout.Footer with a Flex box.

import { HomeOutlined, HistoryOutlined, UserOutlined, SettingOutlined } from '@ant-design/icons';
import { Layout, Menu } from 'antd';

const { Footer } = Layout;

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuStyle = {
    display: 'flex',
    justifyContent: 'space-around',
    borderTop: '1px solid #e8e8e8',
    position: 'fixed',
    bottom: 0,
    width: '100%',
    zIndex: 1000,
    padding: '8px 0',
    background: '#ffffff',
    boxShadow: '0 -2px 8px rgba(0,0,0,0.05)'
  };
  
  const itemStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    cursor: 'pointer',
    color: '#8c8c8c',
    fontSize: '12px'
  };

  const activeStyle = {
    ...itemStyle,
    color: '#1890ff', // Ant Design Blue
    fontWeight: 500
  };

  const tabs = [
    { key: '/', icon: <HomeOutlined style={{ fontSize: '20px', marginBottom: '4px' }} />, label: 'Home' },
    { key: '/timeline', icon: <HistoryOutlined style={{ fontSize: '20px', marginBottom: '4px' }} />, label: 'Timeline' },
    { key: '/profile', icon: <UserOutlined style={{ fontSize: '20px', marginBottom: '4px' }} />, label: 'Profile' },
  ];

  return (
    <div style={menuStyle}>
      {tabs.map((tab) => {
        const isActive = location.pathname === tab.key;
        return (
          <div 
            key={tab.key} 
            style={isActive ? activeStyle : itemStyle}
            onClick={() => navigate(tab.key)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </div>
        );
      })}
    </div>
  );
};

export default BottomNav;
