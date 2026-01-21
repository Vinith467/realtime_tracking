import React, { useState, useEffect } from 'react';
import { Layout, Menu, DatePicker, Select, Card, Spin, Typography, Table, Button, Alert } from 'antd';
import { UserOutlined, DashboardOutlined, CalendarOutlined } from '@ant-design/icons';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import dayjs from 'dayjs';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

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

const { Sider, Content } = Layout;
const { Option } = Select;
const { Title } = Typography;

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
  const R = 6371; // Radius of the earth in km
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
  // Separate loading for users list
  const [usersLoading, setUsersLoading] = useState(true);
  const [stats, setStats] = useState({ distance: '0.00', avgSpeed: '0.0', maxSpeed: '0.0', duration: '0s' });
  const [currentView, setCurrentView] = useState('1');

  const [dbError, setDbError] = useState(null);

  // Fetch users from Firestore with real-time updates
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
        const fetchedUsers = [];
        snapshot.forEach((doc) => {
            fetchedUsers.push({ id: doc.id, ...doc.data() });
        });
        console.log("Updated users list:", fetchedUsers);
        setUsers(fetchedUsers);
        setDbError(null);
        setUsersLoading(false);
    }, (error) => {
        console.error("Error fetching users:", error);
        setDbError(error.message);
        setUsersLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  // Auto-select first user if none selected
  useEffect(() => {
      if (users.length > 0 && !selectedUser) {
          setSelectedUser(users[0].id);
      }
  }, [users, selectedUser]);



  // Subscribe to tracking data in real-time
  useEffect(() => {
    // Only fetch tracking data if we are in the tracking view and have a user selected
    if (currentView !== '1') return;
    if (!selectedUser || !selectedDate) return;
    
    setLoading(true);
    const startOfDay = selectedDate.startOf('day').toDate();
    const endOfDay = selectedDate.endOf('day').toDate();

    // Query tracking data for the selected user
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
            // Validate essential data existence
            if (data.location?.lat && data.location?.lng && data.timestamp?.toDate) {
                 const t = data.timestamp.toDate();
                 // Client-side date filtering
                 if (t >= startOfDay && t <= endOfDay) {
                     rawData.push(data);
                 }
            }
        });

        // Sort by timestamp to ensure the path is drawn correctly headers
        rawData.sort((a, b) => {
            const tA = a.timestamp.toDate().getTime();
            const tB = b.timestamp.toDate().getTime();
            return tA - tB;
        });

        // Process sorted data into points and stats
        rawData.forEach((data, index) => {
           points.push([data.location.lat, data.location.lng]);
           
           const speedKmh = (data.speed || 0) * 3.6; // Convert m/s to km/h
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
           const diffSecs = Math.floor((diffMs % 60000) / 1000);
           
           let durStr = '';
           if (diffHours > 0) durStr += `${diffHours}h `;
           if (diffMins > 0) durStr += `${diffMins}m `;
           durStr += `${diffSecs}s`;
           
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
    }, (error) => {
        console.error("Error fetching live tracks:", error);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedUser, selectedDate, currentView]);

  // Columns for User Management Table
  const userColumns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text) => <Typography.Text strong>{text || 'Unknown'}</Typography.Text>
    },
    {
      title: 'User ID',
      dataIndex: 'id',
      key: 'id',
      render: (text) => <Typography.Text type="secondary">{text}</Typography.Text>
    },
    {
      title: 'Last Active',
      dataIndex: 'lastActive',
      key: 'lastActive',
      render: (val) => val?.toDate ? dayjs(val.toDate()).format('YYYY-MM-DD HH:mm:ss') : 'N/A'
    }
  ];

  return (
    <Layout style={{ height: '100vh' }}>
      <Sider width={250} theme="light" style={{ borderRight: '1px solid #f0f0f0' }}>
        <div style={{ height: '64px', margin: '16px', display: 'flex', alignItems: 'center' }}>
            <Title level={4} style={{ margin: 0 }}>Admin Panel</Title>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[currentView]}
          onClick={({ key }) => setCurrentView(key)}
          items={[
            { key: '1', icon: <DashboardOutlined />, label: 'Live Tracking / History' },
            { key: '2', icon: <UserOutlined />, label: 'Users Management' },
          ]}
        />
        <div style={{ padding: '16px' }}>
             {/* Admin Controls */}
        </div>
      </Sider>
      <Layout>
        {dbError && (
            <Alert 
                message="Database Connection Error" 
                description={dbError} 
                type="error" 
                showIcon 
                style={{ margin: '16px 16px 0' }}
            />
        )}
        {currentView === '1' && (
            <div style={{ padding: '16px', background: '#fff', display: 'flex', gap: '16px', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', zIndex: 10 }}>
                <Select 
                    value={selectedUser} 
                    style={{ width: 200 }} 
                    onChange={setSelectedUser}
                    placeholder="Select User"
                    notFoundContent="No users found"
                >
                    {users.map(u => <Option key={u.id} value={u.id}>{u.name || u.id}</Option>)}
                </Select>
                <DatePicker 
                    defaultValue={selectedDate} 
                    onChange={setSelectedDate}
                    allowClear={false} 
                />
                
                <div style={{ display: 'flex', gap: '20px', marginLeft: 'auto' }}>
                    <div style={{ textAlign: 'center' }}>
                        <Typography.Text type="secondary" style={{ fontSize: '12px' }}>Distance</Typography.Text>
                        <div style={{ fontWeight: 'bold' }}>{stats.distance} km</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <Typography.Text type="secondary" style={{ fontSize: '12px' }}>Avg Speed</Typography.Text>
                        <div style={{ fontWeight: 'bold' }}>{stats.avgSpeed} km/h</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <Typography.Text type="secondary" style={{ fontSize: '12px' }}>Max Speed</Typography.Text>
                        <div style={{ fontWeight: 'bold' }}>{stats.maxSpeed} km/h</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <Typography.Text type="secondary" style={{ fontSize: '12px' }}>Duration</Typography.Text>
                        <div style={{ fontWeight: 'bold' }}>{stats.duration}</div>
                    </div>
                </div>
            </div>
        )}

        <Content style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
            {currentView === '1' ? (
                <MapContainer center={[12.9716, 77.5946]} zoom={12} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    />
                    {trackingPoints.length > 0 && (
                        <>
                            <Polyline positions={trackingPoints} color="blue" weight={4} />
                            <Marker position={trackingPoints[0]}>
                                 <Popup>Start</Popup>
                            </Marker>
                            <Marker position={trackingPoints[trackingPoints.length - 1]}>
                                 <Popup>End</Popup>
                            </Marker>
                            <FitBounds path={trackingPoints} />
                        </>
                    )}
                </MapContainer>
            ) : (
                <div style={{ padding: '24px', overflow: 'auto', height: '100%' }}>
                   <Card title="Registered Users" bordered={false}>
                       <Title level={5} style={{ marginBottom: 16 }}>Total Users: {users.length}</Title>
                       <Table 
                            loading={usersLoading}
                            columns={userColumns} 
                            dataSource={users} 
                            rowKey="id" 
                            pagination={{ pageSize: 10 }}
                       />
                   </Card>
                </div>
            )}
        </Content>
      </Layout>
    </Layout>
  );
};

export default AdminDashboard;
