import React, { useState, useEffect, useRef } from 'react';
import { Layout, Switch, Typography, List, Card, message, Alert, Steps, Button, Spin } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, WifiOutlined, EnvironmentOutlined, DatabaseOutlined, ReloadOutlined } from '@ant-design/icons';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, setDoc, doc, limit, updateDoc } from 'firebase/firestore';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const RiderHome = () => {
  // State
  const [status, setStatus] = useState('offline'); // offline, checking, online, error
  const [userName, setUserName] = useState(localStorage.getItem('rider_name') || '');
  const [loading, setLoading] = useState(false);
  const [diagnostics, setDiagnostics] = useState({
    network: 'pending',
    database: 'pending',
    gps: 'pending'
  });
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [historyError, setHistoryError] = useState(null);

  // Refs
  const watchIdRef = useRef(null);
  const sessionDocIdRef = useRef(null);

  // 1. Initial System Check
  useEffect(() => {
    runDiagnostics();
  }, []);

  const runDiagnostics = async () => {
    setDiagnostics({ network: 'checking', database: 'checking', gps: 'checking' });
    
    // Check 1: Network (Basic)
    const isOnline = navigator.onLine;
    setDiagnostics(prev => ({ ...prev, network: isOnline ? 'ok' : 'error' }));

    // Check 2: Database (Ping)
    try {
        await getDocs(query(collection(db, "users"), limit(1)));
        setDiagnostics(prev => ({ ...prev, database: 'ok' }));
    } catch (e) {
        console.error("Diagnostic DB fail:", e);
        setDiagnostics(prev => ({ ...prev, database: 'error' }));
        setErrorMessage(`Database Error: ${e.message}`);
    }

    // Check 3: GPS Permission
    if (!navigator.geolocation) {
        setDiagnostics(prev => ({ ...prev, gps: 'error' }));
    } else {
        navigator.geolocation.getCurrentPosition(
            () => setDiagnostics(prev => ({ ...prev, gps: 'ok' })),
            (err) => {
                console.error("GPS Fail:", err);
                setDiagnostics(prev => ({ ...prev, gps: 'error' }));
                if (err.code === 1) message.error("GPS Permission Denied");
            }
        );
    }
  };

  // 2. Load History
  useEffect(() => {
    if (userName && diagnostics.database === 'ok') {
        fetchHistory();
    }
  }, [userName, diagnostics.database, status]);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
        const userId = userName.toLowerCase().replace(/\s+/g, '_');
        const q = query(
            collection(db, "tracking_sessions"), 
            where("userId", "==", userId),
            limit(20)
        );
        const snapshot = await getDocs(q);
        const historyData = snapshot.docs.map(doc => {
            const data = doc.data();
            const start = data.startTime ? dayjs(data.startTime.toDate()) : dayjs();
            const end = data.endTime ? dayjs(data.endTime.toDate()) : null;
            
            let durationStr = data.duration || 'Incomplete';
            
            // Calculate duration dynamically if completed
            if (end && start) {
                const diffMins = end.diff(start, 'minute');
                const h = Math.floor(diffMins / 60);
                const m = diffMins % 60;
                durationStr = `${h}h ${m}m`;
                if (diffMins < 1) durationStr = '< 1m';
            } else if (data.status === 'active') {
                durationStr = 'Ongoing';
            }

            return {
                id: doc.id,
                start: start,
                end: end || dayjs(),
                duration: durationStr
            };
        });
        
        // Manual Sort: Newest First
        historyData.sort((a, b) => b.start.valueOf() - a.start.valueOf());

        setHistory(historyData);
    } catch (e) {
        console.error("History fetch error:", e);
        if (e.code !== 'failed-precondition') {
             setHistoryError(e.message);
        }
    } finally {
        setHistoryLoading(false);
    }
  };


  // 3. Toggle Logic
  const handleToggle = async (checked) => {
    setErrorMessage(null);
    const validInternal = userName.trim() || `Rider_${Math.floor(Math.random() * 1000)}`;
    if (!userName.trim()) {
        setUserName(validInternal);
        localStorage.setItem('rider_name', validInternal);
    }
    const userId = validInternal.toLowerCase().replace(/\s+/g, '_');

    if (checked) {
        // GOING ONLINE
        setLoading(true);
        setStatus('checking');

        // Check diagnostics again
        if (diagnostics.database === 'error' || diagnostics.gps === 'error') {
            await runDiagnostics(); // Retry
            if (diagnostics.database === 'error' || diagnostics.gps === 'error') {
                 message.error("Cannot start: System checks failed. See diagnostics.");
                 setLoading(false);
                 return;
            }
        }

        try {
            // A. Register User
            try {
                await setDoc(doc(db, "users", userId), {
                    name: validInternal,
                    lastActive: serverTimestamp(),
                    type: 'rider_v2'
                }, { merge: true });
                localStorage.setItem('rider_name', validInternal);
            } catch (e) {
                console.error("Error saving user:", e);
                if (e.code === 'permission-denied') {
                    throw new Error("Database Permission Denied. Check Firestore Rules.");
                } else if (e.code === 'unavailable') {
                    message.warning("Network offline. Trying to save locally.");
                } else {
                    message.warning("Could not save user profile: " + e.message);
                }
            }

            // B. Create Session
            let sessionRef;
            try {
                sessionRef = await addDoc(collection(db, "tracking_sessions"), {
                    userId: userId,
                    userName: validInternal,
                    startTime: serverTimestamp(),
                    status: 'active'
                });
                sessionDocIdRef.current = sessionRef.id;
            } catch (e) {
                console.error("Session creation failed:", e);
                // Don't throw here, allow offline tracking to potentially queue? 
                // Actually if session fails, tracking is pointless.
                throw new Error("Could not create tracking session: " + e.message);
            }

            // C. Start Watch
            const sessionId = `sess_${Date.now()}`;
            
            if (!navigator.geolocation) {
                throw new Error("Geolocation not supported by this browser.");
            }

            const watchId = navigator.geolocation.watchPosition(
                async (pos) => {
                    const { latitude, longitude, speed, accuracy } = pos.coords;
                    
                    if (sessionRef?.id) {
                        try {
                             await addDoc(collection(db, "tracking_data"), {
                                sessionId: sessionId,
                                sessionDocId: sessionRef.id,
                                userId: userId,
                                userName: validInternal,
                                location: { lat: latitude, lng: longitude },
                                speed: speed,
                                accuracy: accuracy,
                                timestamp: serverTimestamp()
                            });
                        } catch (err) {
                            console.error("Track Packet Drop:", err);
                        }
                    }
                },
                (err) => {
                    console.error("GPS Watch Error:", err);
                    message.error(`GPS Error (${err.code}): ${err.message}`);
                    setStatus('error');
                    setLoading(false);
                },
                { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
            );
            
            watchIdRef.current = watchId;
            setStatus('online');
            message.success("On Duty: Tracking Started");

        } catch (e) {
            console.error("Start Error:", e);
            setErrorMessage(e.message);
            setStatus('error');
        } finally {
            setLoading(false);
        }

    } else {
        // GOING OFFLINE
        if (watchIdRef.current) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }

        // Close session in DB
        if (sessionDocIdRef.current) {
             try {
                 const sessionDoc = doc(db, "tracking_sessions", sessionDocIdRef.current);
                 await updateDoc(sessionDoc, {
                     endTime: serverTimestamp(),
                     status: 'completed'
                 });
             } catch (e) {
                 console.error("Error closing session:", e);
             }
             sessionDocIdRef.current = null;
        }

        setStatus('offline');
        message.info("Off Duty");
        
        // Small delay to allow DB update to propagate before fetching history
        setTimeout(() => {
            fetchHistory(); 
        }, 1000);
    }
  };


  return (
    <Layout style={{ height: '100%', background: '#fff', display: 'flex', flexDirection: 'column' }}>
       
       {/* 1. Header & Diagnostics */}
       <div style={{ padding: '20px', background: status === 'online' ? '#f6ffed' : '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <Title level={4} style={{ margin: 0 }}>Rider Console</Title>
                <div style={{ display: 'flex', gap: '10px' }}>
                     <CheckIcon status={diagnostics.network} icon={<WifiOutlined />} />
                     <CheckIcon status={diagnostics.database} icon={<DatabaseOutlined />} />
                     <CheckIcon status={diagnostics.gps} icon={<EnvironmentOutlined />} />
                </div>
           </div>
           
           {errorMessage && (
               <Alert message="System Error" description={errorMessage} type="error" showIcon closable onClose={() => setErrorMessage(null)} style={{ marginBottom: '15px' }} />
           )}

           <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
               <input 
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Enter Rider Name"
                  disabled={status === 'online'}
                  style={{ 
                      padding: '10px 15px', 
                      fontSize: '16px', 
                      borderRadius: '8px', 
                      border: '1px solid #d9d9d9',
                      width: '100%',
                      maxWidth: '300px',
                      textAlign: 'center'
                  }}
               />
               
               <div style={{ position: 'relative' }}>
                   <Switch 
                      checked={status === 'online'}
                      loading={loading}
                      onChange={handleToggle}
                      style={{ transform: 'scale(1.5)', marginTop: '5px' }}
                   />
               </div>
               <Text type={status === 'online' ? 'success' : 'secondary'} strong>
                   {status === 'online' ? '● ON DUTY (TRACKING)' : '○ OFF DUTY'}
               </Text>
           </div>
       </div>

       {/* 2. History List */}
       <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <Title level={5} style={{ margin: 0 }}>Recent Sessions</Title>
                <Button size="small" icon={<ReloadOutlined />} onClick={fetchHistory} loading={historyLoading} />
            </div>
            {historyError ? (
                <Alert 
                    message="Failed to load history" 
                    description={historyError} 
                    type="error" 
                    showIcon 
                    action={
                        <Button size="small" type="primary" onClick={fetchHistory}>
                            Retry
                        </Button>
                    }
                />
            ) : (
                <List
                    loading={historyLoading}
                    dataSource={history}
                    renderItem={item => (
                        <List.Item>
                            <List.Item.Meta
                                avatar={<ClockCircleOutlined />}
                                title={item.start.format('MMM D, h:mm A')}
                                description={`Duration: ${item.duration}`}
                            />
                        </List.Item>
                    )}
                    locale={{ emptyText: "No history found" }}
                />
            )}
       </div>
    </Layout>
  );
};

// Helper for Diagnostic Icons
const CheckIcon = ({ status, icon }) => {
    let color = '#d9d9d9'; // pending
    if (status === 'ok') color = '#52c41a';
    if (status === 'error') color = '#ff4d4f';
    if (status === 'checking') color = '#1890ff';
    return (
        <span style={{ fontSize: '18px', color: color, background: '#fff', borderRadius: '50%', padding: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            {icon}
        </span>
    );
};

export default RiderHome;
