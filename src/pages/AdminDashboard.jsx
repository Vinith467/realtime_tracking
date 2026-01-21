import React, { useState, useEffect } from 'react';
import { Menu, DatePicker, Select, Card, Typography, Table, Alert, Button } from 'antd';
import { 
    UserOutlined, 
    DashboardOutlined, 
    MenuOutlined,
    CloseOutlined
} from '@ant-design/icons';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import dayjs from 'dayjs';
import { db } from '../firebase';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './AdminDashboard.css';

// Icons fix
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const { Option } = Select;
const { Title, Text } = Typography;

function FitBounds({ path }) {
  const map = useMap();
  useEffect(() => {
    if (path.length > 0) {
      map.fitBounds(path);
    }
  }, [path, map]);
  return null;
}

// Haversine formula to calculate distance in km
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const deg2rad = (deg) => {
  return deg * (Math.PI / 180);
};

const AdminDashboard = () => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [trackingPoints, setTrackingPoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(true);
  const [stats, setStats] = useState({ distance: '0.00', avgSpeed: '0.0', maxSpeed: '0.0', duration: '0s' });
  const [currentView, setCurrentView] = useState('1');
  const [dbError, setDbError] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Responsive: Close menu on view switch if mobile
  const handleViewChange = (key) => {
      setCurrentView(key);
      if (window.innerWidth <= 768) {
          setIsMobileMenuOpen(false);
      }
  };

  // Fetch users
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
        const fetchedUsers = [];
        snapshot.forEach((doc) => {
            fetchedUsers.push({ id: doc.id, ...doc.data() });
        });
        setUsers(fetchedUsers);
        setUsersLoading(false);
    }, (error) => {
        console.error("Error fetching users:", error);
        setDbError(error.message);
        setUsersLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Auto-select
  useEffect(() => {
      if (users.length > 0 && !selectedUser) {
          setSelectedUser(users[0].id);
      }
  }, [users, selectedUser]);

  // Track Data
  useEffect(() => {
    if (currentView !== '1') return;
    if (!selectedUser || !selectedDate) return;
    
    setLoading(true);
    const startOfDay = selectedDate.startOf('day').toDate();
    const endOfDay = selectedDate.endOf('day').toDate();

    const q = query(
      collection(db, "tracking_data"),
      where("userId", "==", selectedUser)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const points = [];
        let totalDist = 0;
        let totalSpeed = 0;
        let maxSpd = 0;
        let count = 0;
        const rawData = [];

        snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.location?.lat && data.location?.lng && data.timestamp?.toDate) {
                 const t = data.timestamp.toDate();
                 if (t >= startOfDay && t <= endOfDay) {
                     rawData.push(data);
                 }
            }
        });

        rawData.sort((a, b) => a.timestamp.toDate().getTime() - b.timestamp.toDate().getTime());

        rawData.forEach((data, index) => {
           points.push([data.location.lat, data.location.lng]);
           const speedKmh = (data.speed || 0) * 3.6;
           totalSpeed += speedKmh;
           if (speedKmh > maxSpd) maxSpd = speedKmh;
           count++;

           if (index > 0) {
               const prev = rawData[index - 1];
               totalDist += calculateDistance(
                   prev.location.lat, prev.location.lng,
                   data.location.lat, data.location.lng
               );
           }
        });
        
        if (rawData.length > 0) {
           const startTime = rawData[0].timestamp.toDate();
           const endTime = rawData[rawData.length - 1].timestamp.toDate();
           const diffMs = endTime - startTime;
           const diffHours = Math.floor(diffMs / 3600000);
           const diffMins = Math.floor((diffMs % 3600000) / 60000);
           
           let durStr = '';
           if (diffHours > 0) durStr += `${diffHours}h `;
           durStr += `${diffMins}m`;
           if (diffHours === 0 && diffMins === 0) durStr = '< 1m';
           
           setStats({
                distance: totalDist.toFixed(2),
                avgSpeed: count > 0 ? (totalSpeed / count).toFixed(1) : '0.0',
                maxSpeed: maxSpd.toFixed(1),
                duration: durStr
           });
        } else {
            setStats({ distance: '0.00', avgSpeed: '0.0', maxSpeed: '0.0', duration: '0s' });
        }
        setTrackingPoints(points);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedUser, selectedDate, currentView]);

  const userColumns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text) => <Text strong>{text || 'Unknown'}</Text>
    },
    {
      title: 'User ID',
      dataIndex: 'id',
      key: 'id',
      responsive: ['md'], // Hide on small mobile
      render: (text) => <Text type="secondary">{text}</Text>
    },
    {
      title: 'Last Active',
      dataIndex: 'lastActive',
      key: 'lastActive',
      render: (val) => val?.toDate ? dayjs(val.toDate()).format('MM-DD HH:mm') : 'N/A'
    }
  ];

  return (
    <div className={`admin-layout ${isMobileMenuOpen ? 'sidebar-open' : ''}`}>
      
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
          <div className="admin-overlay" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      {/* Sidebar */}
      <div className={`admin-sider ${isMobileMenuOpen ? 'mobile-visible' : 'mobile-hidden'}`}>
        <div className="sider-header">
           <span style={{ flex: 1 }}>Control Panel</span>
           {isMobileMenuOpen && (
               <Button type="text" icon={<CloseOutlined />} onClick={() => setIsMobileMenuOpen(false)} />
           )}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[currentView]}
          onClick={({ key }) => handleViewChange(key)}
          style={{ borderRight: 0 }}
          items={[
            { key: '1', icon: <DashboardOutlined />, label: 'Tracking' },
            { key: '2', icon: <UserOutlined />, label: 'Users' },
          ]}
        />
      </div>

      {/* Main Content */}
      <div className="admin-main">
        {dbError && (
             <Alert message="Error" description={dbError} type="error" banner closable />
        )}

        {/* Top Controls Bar (Only Visible for Tracking View) */}
        {currentView === '1' && (
            <div className="controls-bar">
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <button className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)}>
                        <MenuOutlined />
                    </button>
                    <div className="controls-inputs">
                        <Select 
                            value={selectedUser} 
                            onChange={setSelectedUser}
                            placeholder="Rider"
                            className="w-full"
                        >
                            {users.map(u => <Option key={u.id} value={u.id}>{u.name || u.id}</Option>)}
                        </Select>
                        <DatePicker 
                            value={selectedDate} 
                            onChange={setSelectedDate}
                            allowClear={false} 
                            style={{ minWidth: 120 }}
                        />
                    </div>
                </div>

                {/* Stats */}
                <div className="stats-container">
                    <div className="stat-item">
                        <span className="stat-label">Dist</span>
                        <span className="stat-value">{stats.distance} <small>km</small></span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">Avg</span>
                        <span className="stat-value">{stats.avgSpeed} <small>km/h</small></span>
                    </div>
                     <div className="stat-item">
                        <span className="stat-label">Max</span>
                        <span className="stat-value">{stats.maxSpeed} <small>km/h</small></span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">Time</span>
                        <span className="stat-value">{stats.duration}</span>
                    </div>
                </div>
            </div>
        )}

        {/* Header for Users View */}
        {currentView === '2' && (
             <div className="controls-bar">
                 <div style={{ display: 'flex', alignItems: 'center' }}>
                    <button className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)}>
                        <MenuOutlined />
                    </button>
                    <Title level={4} style={{ margin: 0 }}>User Management</Title>
                 </div>
             </div>
        )}

        {/* View Content */}
        {currentView === '1' ? (
            <div className="map-wrapper">
                <MapContainer center={[12.9716, 77.5946]} zoom={12} style={{ height: '100%', width: '100%' }}>
                    <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                    {trackingPoints.length > 0 && (
                        <>
                            <Polyline positions={trackingPoints} color="#1890ff" weight={5} opacity={0.8} />
                            <Marker position={trackingPoints[0]}>
                                 <Popup>Start</Popup>
                            </Marker>
                            <Marker position={trackingPoints[trackingPoints.length - 1]}>
                                 <Popup>Current/End</Popup>
                            </Marker>
                            <FitBounds path={trackingPoints} />
                        </>
                    )}
                </MapContainer>
            </div>
        ) : (
            <div className="users-view-container">
                <Card bordered={false} bodyStyle={{ padding: '0' }} style={{ background: 'transparent', boxShadow: 'none' }}>
                    <Table 
                        loading={usersLoading}
                        columns={userColumns} 
                        dataSource={users} 
                        rowKey="id" 
                        pagination={{ pageSize: 10 }}
                        scroll={{ x: true }} // Horizontal scroll on mobile
                        size="middle"
                    />
                </Card>
            </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
