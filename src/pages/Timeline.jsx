import React, { useState } from 'react';
import { Layout, DatePicker, List, Avatar, Typography, Divider, Select } from 'antd';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import { EnvironmentOutlined, ClockCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Content } = Layout;
const { Title, Text } = Typography;

const Timeline = () => {
  const [selectedDate, setSelectedDate] = useState(dayjs());
  
  // Dummy data representing a "Cycle" day
  const timelineEvents = [
    {
      type: 'place',
      title: 'Home',
      time: '08:00 AM',
      location: [12.9716, 77.5946],
      duration: '1 hr'
    },
    {
      type: 'move',
      mode: 'Cycling',
      distance: '4.2 km',
      time: '09:00 AM - 09:30 AM',
      path: [
        [12.9716, 77.5946],
        [12.9725, 77.5950],
        [12.9735, 77.5960],
        [12.9750, 77.5980],
        [12.9780, 77.6000],
        [12.9800, 77.6050]
      ]
    },
    {
      type: 'place',
      title: 'Office',
      time: '09:30 AM',
      location: [12.9800, 77.6050],
      duration: '4 hr'
    }
  ];

  return (
    <Layout style={{ height: '100%', paddingBottom: '60px', position: 'relative' }}>
        {/* Floating Date Picker */}
        <div style={{ 
            position: 'absolute', 
            top: 20, 
            left: '50%', 
            transform: 'translateX(-50%)', 
            zIndex: 1000,
            width: '90%',
            maxWidth: '400px',
            background: 'white',
            padding: '8px',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            display: 'flex',
            justifyContent: 'center'
        }}>
            <DatePicker 
                defaultValue={dayjs()} 
                onChange={setSelectedDate} 
                style={{ width: '100%', border: 'none' }}
                allowClear={false}
                format="MMMM D, YYYY"
            />
        </div>

        {/* Map Area */}
        <div style={{ height: '60%', width: '100%' }}>
            <MapContainer center={[12.9750, 77.6000]} zoom={14} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }} zoomControl={false}>
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                />
                
                {timelineEvents.map((event, idx) => {
                    if (event.type === 'move') {
                        return <Polyline key={idx} positions={event.path} color="#1890ff" weight={5} opacity={0.7} />;
                    }
                    if (event.type === 'place') {
                         return (
                            <Marker key={idx} position={event.location}>
                                <Popup>{event.title}</Popup>
                            </Marker>
                         );
                    }
                    return null;
                })}
            </MapContainer>
        </div>

        {/* Timeline List */}
        <div style={{ 
            height: '40%', 
            background: 'white', 
            borderTopLeftRadius: '20px', 
            borderTopRightRadius: '20px', 
            padding: '20px',
            overflowY: 'auto',
            boxShadow: '0 -4px 12px rgba(0,0,0,0.05)',
            marginTop: '-20px', // Overlap map slightly
            zIndex: 500,
            position: 'relative'
        }}>
            <div style={{ width: '40px', height: '4px', background: '#e8e8e8', borderRadius: '2px', margin: '0 auto 16px' }} />
            
            <List
                itemLayout="horizontal"
                dataSource={timelineEvents}
                renderItem={item => (
                    <List.Item>
                        <List.Item.Meta
                            avatar={
                                item.type === 'place' ? (
                                    <Avatar style={{ backgroundColor: '#fff', color: '#f5222d', border: '1px solid #ffccc7' }} icon={<EnvironmentOutlined />} />
                                ) : (
                                    <div style={{ width: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                         <div style={{ width: '2px', height: '100%', background: '#1890ff', opacity: 0.3 }}></div>
                                    </div>
                                )
                            }
                            title={<Text strong>{item.type === 'place' ? item.title : `Cycling • ${item.distance}`}</Text>}
                            description={
                                <div>
                                    <ClockCircleOutlined style={{ marginRight: '4px', fontSize: '12px' }} />
                                    {item.time}
                                </div>
                            }
                        />
                    </List.Item>
                )}
            />
        </div>
    </Layout>
  );
};

export default Timeline;
