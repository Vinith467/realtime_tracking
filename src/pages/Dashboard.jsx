import React, { useState, useEffect, useRef } from 'react';
import { Layout, Card, Switch, Typography, Row, Col, Statistic, Button, List, Avatar, message } from 'antd';
import { DollarCircleOutlined, CarOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

// Fix leaflet icon issue in webpack/vite
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const { Header, Content } = Layout;
const { Title, Text } = Typography;

// Helper to update map center
function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, map.getZoom());
  }, [center, map]);
  return null;
}

const Dashboard = () => {
  const [isOnline, setIsOnline] = useState(false);
  const [currentLocation, setCurrentLocation] = useState([12.9716, 77.5946]); // Default Bangalore
  const watchIdRef = useRef(null);
  // Store a session ID so we can group points in the DB
  const [sessionId, setSessionId] = useState(null);

  useEffect(() => {
    if (isOnline) {
       // Start Tracking
       const newSessionId = `session_${Date.now()}`;
       setSessionId(newSessionId);
       message.success("You are now On Duty. Tracking started.");

       if (!navigator.geolocation) {
         message.error("Geolocation is not supported by your browser");
         setIsOnline(false);
         return;
       }

       watchIdRef.current = navigator.geolocation.watchPosition(
         async (position) => {
           const { latitude, longitude, speed, heading, accuracy } = position.coords;
           setCurrentLocation([latitude, longitude]);
           
           try {
             // Push to Firebase
             await addDoc(collection(db, "tracking_data"), {
               sessionId: newSessionId,
               userId: "user_123", // fast-coded user ID
               location: {
                 lat: latitude,
                 lng: longitude
               },
               speed: speed,
               heading: heading,
               accuracy: accuracy,
               timestamp: serverTimestamp() // Database server time
             });
             console.log("Location sent to DB:", latitude, longitude);
           } catch (error) {
             console.error("Error writing to Firebase: ", error);
             // Don't spam the user with errors if config is missing
           }
         },
         (error) => {
           console.error("Error getting location:", error);
           message.error("Unable to retrieve location.");
         },
         {
           enableHighAccuracy: true,
           maximumAge: 10000,
           timeout: 5000
         }
       );

    } else {
      // Stop Tracking
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (sessionId) {
          message.info("You are now Off Duty. Tracking stopped.");
          setSessionId(null);
      }
    }

    return () => {
      // Cleanup on unmount
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [isOnline]);

  const earningsData = {
    today: 450,
    rides: 12,
    hours: 4.5
  };

  return (
    <Layout style={{ height: '100%', paddingBottom: '60px' }}>
      <Header style={{ 
        background: isOnline ? '#52c41a' : '#262626', 
        padding: '0 16px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        transition: 'background 0.3s'
      }}>
        <Title level={4} style={{ color: '#fff', margin: 0 }}>
          {isOnline ? 'On Duty' : 'Off Duty'}
        </Title>
        <Switch 
          checkedChildren="ON" 
          unCheckedChildren="OFF" 
          checked={isOnline}
          onChange={setIsOnline} 
          style={{ transform: 'scale(1.2)' }}
        />
      </Header>

      <Content style={{ overflowY: 'auto' }}>
        {/* Earnings Summary */}
        <div style={{ padding: '16px' }}>
          <Card bordered={false} style={{ borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <Row gutter={16}>
              <Col span={8} style={{ textAlign: 'center', borderRight: '1px solid #f0f0f0' }}>
                <Statistic title="Earnings" value={earningsData.today} prefix="₹" precision={0} valueStyle={{ fontSize: '18px', fontWeight: 'bold', color: '#52c41a' }} />
              </Col>
              <Col span={8} style={{ textAlign: 'center', borderRight: '1px solid #f0f0f0' }}>
                <Statistic title="Rides" value={earningsData.rides} valueStyle={{ fontSize: '18px', fontWeight: 'bold' }} />
              </Col>
              <Col span={8} style={{ textAlign: 'center' }}>
                <Statistic title="Hrs" value={earningsData.hours} valueStyle={{ fontSize: '18px', fontWeight: 'bold' }} />
              </Col>
            </Row>
          </Card>
        </div>

        {/* Map Section */}
        <div style={{ padding: '0 16px', marginBottom: '16px' }}>
          <Text strong style={{ display: 'block', marginBottom: '8px' }}>
             {isOnline ? "Live Tracking" : "High Demand Zones"}
          </Text>
          <div style={{ height: '200px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #d9d9d9' }}>
            <MapContainer center={currentLocation} zoom={15} style={{ height: '100%', width: '100%' }} zoomControl={false}>
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              <MapUpdater center={currentLocation} />
              <Marker position={currentLocation}>
                <Popup>{isOnline ? "Your Current Location" : "Last Known Location"}</Popup>
              </Marker>
            </MapContainer>
          </div>
        </div>

        {/* Recent Activity / Incentives */}
        <div style={{ padding: '0 16px' }}>
           <Card size="small" title="Today's Incentives" extra={<a href="#">View</a>} style={{ borderRadius: '12px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text>Complete 3 more rides</Text>
                <Text strong style={{ color: '#1890ff' }}>Get ₹50</Text>
              </div>
              <div style={{ background: '#f5f5f5', height: '6px', borderRadius: '3px', marginTop: '8px', width: '100%' }}>
                <div style={{ background: '#1890ff', height: '100%', borderRadius: '3px', width: '70%' }}></div>
              </div>
           </Card>

           <Text strong>Recent Rides</Text>
           <List
            itemLayout="horizontal"
            dataSource={[
              { id: 1, time: '10:30 AM', income: '₹45', dist: '2.5 km' },
              { id: 2, time: '11:15 AM', income: '₹82', dist: '5.1 km' },
            ]}
            renderItem={item => (
              <List.Item style={{ padding: '12px 0' }}>
                <List.Item.Meta
                  avatar={<Avatar icon={<CarOutlined />} style={{ backgroundColor: '#fff', color: '#52c41a', border: '1px solid #d9d9d9' }} />}
                  title={`Drop at MG Road`}
                  description={`${item.time} • ${item.dist}`}
                />
                <Text strong>{item.income}</Text>
              </List.Item>
            )}
           />
        </div>
      </Content>
    </Layout>
  );
};

export default Dashboard;
