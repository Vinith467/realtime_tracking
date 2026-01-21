import React, { useState, useEffect, useRef } from 'react';
import { message } from 'antd';
import { 
  WifiOutlined, 
  EnvironmentOutlined, 
  DatabaseOutlined, 
  ReloadOutlined, 
  PoweroffOutlined,
  ClockCircleOutlined,
  UserOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  LoadingOutlined
} from '@ant-design/icons';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, setDoc, doc, limit, updateDoc } from 'firebase/firestore';
import dayjs from 'dayjs';
import './RiderHome.css';

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
  const [currentSessionStart, setCurrentSessionStart] = useState(null);
  const [activeDuration, setActiveDuration] = useState('00:00');

  // Refs
  const watchIdRef = useRef(null);
  const sessionDocIdRef = useRef(null);
  const timerRef = useRef(null);
  
  // New Refs for Tracking Improvements
  const lastPositionTimeRef = useRef(0);
  const trackingIntervalRef = useRef(null);
  const wakeLockRef = useRef(null);

  // --- Tracking Helpers ---

  const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
        try {
            wakeLockRef.current = await navigator.wakeLock.request('screen');
            console.log("Wake Lock active");
        } catch (err) {
            console.warn("Wake Lock rejected:", err);
        }
    }
  };
  
  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
        try {
            await wakeLockRef.current.release();
            wakeLockRef.current = null;
            console.log("Wake Lock released");
        } catch (e) { /* ignore */ }
    }
  };

  const startTracking = (sessionId, sessionDocId, userId) => {
    // 1. Clear existing if any
    stopTracking();

    // 2. Start Watcher
    // maximumAge: 0 forces fresh GPS data. timeout 15s.
    const options = { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 };
    
    // Define success callback
    const success = (pos) => {
      const { latitude, longitude, speed, accuracy } = pos.coords;
      lastPositionTimeRef.current = Date.now();
      
      // Fire and forget write
      try {
        addDoc(collection(db, "tracking_data"), {
          sessionId: sessionId,
          sessionDocId: sessionDocId,
          userId: userId,
          location: { lat: latitude, lng: longitude },
          speed: speed,
          accuracy: accuracy,
          timestamp: serverTimestamp()
        });
      } catch (err) { /* quiet fail */ }
    };

    // Define error callback
    const error = (err) => {
      console.error("GPS Watch Error:", err);
      if (err.code === 1) {
         message.error("GPS Permissions Denied");
      }
      // If other error, we rely on the heartbeat to retry
    };

    const watchId = navigator.geolocation.watchPosition(success, error, options);
    watchIdRef.current = watchId;

    // 3. Start Heartbeat (Fallback)
    // Checks every 30s. If no update in last 30s, force getPosition
    trackingIntervalRef.current = setInterval(() => {
       const now = Date.now();
       if (now - lastPositionTimeRef.current > 30000) {
           console.log("Heartbeat: Force active position fetch");
           navigator.geolocation.getCurrentPosition(success, error, options);
       }
    }, 30000);
  };

  const stopTracking = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
        trackingIntervalRef.current = null;
    }
  };

  // --- Effects ---

  // 1. Initial System Check
  useEffect(() => {
    runDiagnostics();
    const interval = setInterval(() => {
        setDiagnostics(prev => ({ ...prev, network: navigator.onLine ? 'ok' : 'error' }));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // 2. Wake Lock Visibility Handler
  useEffect(() => {
      const handleVisChange = async () => {
          if (document.visibilityState === 'visible' && status === 'online') {
              await requestWakeLock();
          }
      };
      document.addEventListener('visibilitychange', handleVisChange);
      return () => document.removeEventListener('visibilitychange', handleVisChange);
  }, [status]);

  // 3. Timer for active session
  useEffect(() => {
    if (status === 'online' && currentSessionStart) {
        timerRef.current = setInterval(() => {
            const now = dayjs();
            const start = dayjs(currentSessionStart);
            const diffMins = now.diff(start, 'minute');
            const h = Math.floor(diffMins / 60);
            const m = diffMins % 60;
            setActiveDuration(`${h}h ${m}m`);
        }, 60000); 
        
        const now = dayjs();
        const start = dayjs(currentSessionStart);
        const diffMins = now.diff(start, 'minute');
        const h = Math.floor(diffMins / 60);
        const m = diffMins % 60;
        setActiveDuration(`${h}h ${m}m`);
    } else {
        clearInterval(timerRef.current);
        setActiveDuration('00:00');
    }
    return () => clearInterval(timerRef.current);
  }, [status, currentSessionStart]);

  // 4. Load History
  useEffect(() => {
    if (userName && diagnostics.database === 'ok') {
        fetchHistory();
    }
  }, [userName, diagnostics.database, status]);

  // --- Functions ---

  const runDiagnostics = async () => {
    setDiagnostics({ network: 'checking', database: 'checking', gps: 'checking' });
    
    // Check 1: Network
    const isOnline = navigator.onLine;
    setDiagnostics(prev => ({ ...prev, network: isOnline ? 'ok' : 'error' }));

    // Check 2: Database
    try {
        await getDocs(query(collection(db, "users"), limit(1)));
        setDiagnostics(prev => ({ ...prev, database: 'ok' }));
    } catch (e) {
        console.error("Diagnostic DB fail:", e);
        setDiagnostics(prev => ({ ...prev, database: 'error' }));
    }

    // Check 3: GPS
    if (!navigator.geolocation) {
        setDiagnostics(prev => ({ ...prev, gps: 'error' }));
    } else {
        navigator.geolocation.getCurrentPosition(
            () => setDiagnostics(prev => ({ ...prev, gps: 'ok' })),
            (err) => {
                console.error("GPS Fail:", err);
                setDiagnostics(prev => ({ ...prev, gps: 'error' }));
                if (err.code === 1) message.error("GPS Permissions Missing");
            }
        );
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
        const userId = userName.toLowerCase().replace(/\s+/g, '_');
        const q = query(
            collection(db, "tracking_sessions"), 
            where("userId", "==", userId),
            limit(10)
        );
        const snapshot = await getDocs(q);
        const historyData = snapshot.docs.map(doc => {
            const data = doc.data();
            const start = data.startTime ? dayjs(data.startTime.toDate()) : dayjs();
            const end = data.endTime ? dayjs(data.endTime.toDate()) : null;
            
            let durationStr = data.duration || 'Incomplete';
            
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
                status: data.status,
                duration: durationStr
            };
        });
        
        historyData.sort((a, b) => b.start.valueOf() - a.start.valueOf());
        setHistory(historyData);
    } catch (e) {
        console.error("History fetch error:", e);
    } finally {
        setHistoryLoading(false);
    }
  };

  const handleToggle = async () => {
    setErrorMessage(null);
    const isGoingOnline = status !== 'online';

    // Validation
    const validName = userName.trim();
    if (!validName) {
        message.warning("Please enter your name first!");
        return;
    }
    
    if (localStorage.getItem('rider_name') !== validName) {
        localStorage.setItem('rider_name', validName);
    }
    const userId = validName.toLowerCase().replace(/\s+/g, '_');

    if (isGoingOnline) {
        // --- START TRACKING ---
        setLoading(true);
        setStatus('checking');

        // Quick Re-check
        if (diagnostics.gps === 'error' || diagnostics.database === 'error') {
             await runDiagnostics();
             if (diagnostics.gps === 'error') {
                 message.error("GPS Error: Please enable location services.");
                 setLoading(false);
                 setStatus('offline');
                 return;
             }
        }

        // Request Wake Lock
        await requestWakeLock();

        try {
            // A. Register User
            await setDoc(doc(db, "users", userId), {
                name: validName,
                lastActive: serverTimestamp(),
                type: 'rider_v2'
            }, { merge: true });

            // B. Create Session
            const sessionRef = await addDoc(collection(db, "tracking_sessions"), {
                userId: userId,
                userName: validName,
                startTime: serverTimestamp(),
                status: 'active'
            });
            sessionDocIdRef.current = sessionRef.id;
            setCurrentSessionStart(new Date());

            // C. Start Watch
            const sessionId = `sess_${Date.now()}`;
            startTracking(sessionId, sessionRef.id, userId);
            
            setStatus('online');
            message.success("You are now ON DUTY");

        } catch (e) {
            console.error("Start Error:", e);
            setErrorMessage(e.message);
            setStatus('error');
            releaseWakeLock();
        } finally {
            setLoading(false);
        }

    } else {
        // --- STOP TRACKING ---
        setLoading(true);
        stopTracking();

        if (sessionDocIdRef.current) {
             try {
                 await updateDoc(doc(db, "tracking_sessions", sessionDocIdRef.current), {
                     endTime: serverTimestamp(),
                     status: 'completed'
                 });
             } catch (e) {
                 console.error("Error closing session:", e);
             }
             sessionDocIdRef.current = null;
        }
        
        setCurrentSessionStart(null);
        setStatus('offline');
        message.info("You are now OFF DUTY");
        setLoading(false);
        releaseWakeLock();
        
        setTimeout(fetchHistory, 1500);
    }
  };

  return (
    <div className="rider-container">
        {/* Header */}
        <header className="header-section">
            <div className="header-top">
                <div className="app-title">Rider App</div>
                <div className={`status-badge ${status}`}>
                    <div className="status-indicator"></div>
                    {status === 'online' ? 'Online' : 'Offline'}
                </div>
            </div>
            
            <div className="rider-input-group">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.8)', marginBottom: '4px', fontSize: '0.85rem' }}>
                    <UserOutlined /> RIDER NAME
                </div>
                {status === 'online' ? (
                    <h2 className="rider-name-display">{userName}</h2>
                ) : (
                    <input 
                        className="rider-name-input"
                        placeholder="Enter your name..."
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                    />
                )}
            </div>
        </header>

        {/* Main Controls */}
        <div className="control-card">
            {errorMessage && (
                <div style={{ width: '100%', padding: '10px', background: '#fef2f2', color: '#ef4444', borderRadius: '8px', fontSize: '0.9rem', textAlign: 'center' }}>
                    {errorMessage}
                </div>
            )}

            <div className="toggle-container">
                <button 
                    className={`duty-button ${status === 'online' ? 'stop' : 'start'}`}
                    onClick={handleToggle}
                    disabled={loading}
                >
                    {loading ? (
                        <>
                            <LoadingOutlined spin /> {status === 'online' ? 'Stopping...' : 'Starting...'}
                        </>
                    ) : (
                        <>
                            <PoweroffOutlined /> 
                            {status === 'online' ? 'END SHIFT' : 'START SHIFT'}
                        </>
                    )}
                </button>
            </div>

            <div className="diagnostics-row">
                <DiagnosticItem label="Net" status={diagnostics.network} icon={<WifiOutlined />} />
                <DiagnosticItem label="GPS" status={diagnostics.gps} icon={<EnvironmentOutlined />} />
                <DiagnosticItem label="DB" status={diagnostics.database} icon={<DatabaseOutlined />} />
            </div>
        </div>

        {/* Stats Row (only when online) */}
        {status === 'online' && (
            <div className="stats-grid">
                <div className="stat-card">
                    <span className="stat-label">Duration</span>
                    <span className="stat-value">{activeDuration}</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label">Session Status</span>
                    <span className="stat-value" style={{ color: '#10b981', fontSize: '1.2rem' }}>Active</span>
                </div>
            </div>
        )}

        {/* Recent History */}
        <div className="history-section">
            <div className="section-title">
                Recent Shifts
                <button className="refresh-btn" onClick={fetchHistory} disabled={historyLoading}>
                    <ReloadOutlined spin={historyLoading} />
                </button>
            </div>

            <div className="history-list">
                {history.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                        No recent history
                    </div>
                ) : (
                    history.map(item => (
                        <div key={item.id} className={`history-card ${item.duration === 'Incomplete' ? 'incomplete' : 'completed'}`}>
                            <div className="history-info">
                                <h4>{item.start.format('MMMM D')}</h4>
                                <p>{item.start.format('h:mm A')}</p>
                            </div>
                            <div className="duration-pill">
                                {item.duration}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    </div>
  );
};

// Sub-component for clean code
const DiagnosticItem = ({ label, status, icon }) => {
    let iconClass = 'diag-icon';
    if (status === 'ok') iconClass += ' ok';
    if (status === 'error') iconClass += ' error';
    if (status === 'checking') iconClass += ' checking';

    return (
        <div className="diag-item">
            <div className={iconClass}>
                {status === 'checking' ? <LoadingOutlined /> : icon}
            </div>
            <span>{label}</span>
        </div>
    );
};

export default RiderHome;