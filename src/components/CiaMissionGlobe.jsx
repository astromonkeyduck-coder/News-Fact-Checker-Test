import React, { useRef, useEffect, useState } from 'react';
import coveragePoints from '../data/coveragePoints';
import { getLocationCoordinates, getCityCoordinates } from '../utils/locationCoordinates';
import '../styles/ciaGlobe.css';

const CiaMissionGlobe = () => {
  const globeRef = useRef(null);
  const globeInstanceRef = useRef(null);
  const animationFrameRef = useRef(null);
  const [activeOp, setActiveOp] = useState(null);
  const [isClient, setIsClient] = useState(false);
  const [coveragePointsData, setCoveragePointsData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load posts and extract coverage points
  useEffect(() => {
    const loadCoveragePoints = async () => {
      try {
        // Try to load from posts-with-locations.json
        const response = await fetch('/posts-with-locations.json');
        if (response.ok) {
          const data = await response.json();
          const posts = data.posts || [];
          
          const points = [];
          const locationCounts = new Map();
          
          // Process each post
          for (const post of posts) {
            const locations = Array.isArray(post.locations) ? post.locations : [];
            if (locations.length === 0) continue;
            
            const postText = post.postText || '';
            const headline = postText.length > 60 ? postText.substring(0, 57) + '...' : postText;
            
            // Process each location in the post
            for (const locationName of locations) {
              if (!locationName || typeof locationName !== 'string') continue;
              
              const trimmedLocation = locationName.trim();
              const coords = getLocationCoordinates(trimmedLocation);
              if (!coords) continue;
              
              // Count posts per location for slight randomization
              const count = (locationCounts.get(trimmedLocation) || 0) + 1;
              locationCounts.set(trimmedLocation, count);
              
              // Add slight randomization to prevent exact overlap
              const isCity = getCityCoordinates(trimmedLocation) !== null;
              const spreadRadius = isCity ? 0.5 : 2;
              const angle = (count * 137.5) % 360; // Golden angle for even distribution
              const distance = isCity ? Math.min(count * 0.1, spreadRadius) : Math.min(count * 0.3, spreadRadius);
              
              const latOffset = (Math.cos(angle * Math.PI / 180) * distance);
              const lngOffset = (Math.sin(angle * Math.PI / 180) * distance / Math.cos(coords.lat * Math.PI / 180));
              
              points.push({
                id: `post-${post.postId || Date.now()}-${trimmedLocation}-${count}`,
                lat: coords.lat + latOffset,
                lng: coords.lng + lngOffset,
                location: trimmedLocation,
                headline: headline || `Coverage from ${locationName}`,
                timestamp: post.date ? new Date(post.date).toISOString() : new Date().toISOString(),
                postId: post.postId,
                postLink: post.postLink || ''
              });
            }
          }
          
          // Sort by timestamp (newest first) and limit to most recent
          points.sort((a, b) => {
            const aTime = new Date(a.timestamp).getTime();
            const bTime = new Date(b.timestamp).getTime();
            return bTime - aTime;
          });
          
          // Limit to 200 most recent points for performance
          const limitedPoints = points.slice(0, 200);
          
          setCoveragePointsData(limitedPoints);
          if (limitedPoints.length > 0) {
            setActiveOp(limitedPoints[0]);
          }
        } else {
          // Fallback to static data
          setCoveragePointsData(coveragePoints);
          if (coveragePoints.length > 0) {
            setActiveOp(coveragePoints[0]);
          }
        }
      } catch (error) {
        console.error('Failed to load coverage points:', error);
        // Fallback to static data
        setCoveragePointsData(coveragePoints);
        if (coveragePoints.length > 0) {
          setActiveOp(coveragePoints[0]);
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    loadCoveragePoints();
  }, []);

  useEffect(() => {
    // Ensure we're on the client side
    setIsClient(true);
    
    if (!globeRef.current || isLoading || coveragePointsData.length === 0) return;

    // Dynamically import Globe.gl only on client side
    import('globe.gl').then(({ default: Globe }) => {
      if (!globeRef.current) return;

      // Initialize globe
      const globe = Globe()(globeRef.current)
        .globeImageUrl('//unpkg.com/three-globe/example/img/earth-dark.jpg')
        .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
        .backgroundColor('#020617')
        .showAtmosphere(true)
        .atmosphereColor('#22d3ee')
        .atmosphereAltitude(0.28);

      // Configure points
      globe
        .pointsData(coveragePointsData)
        .pointLat(d => d.lat)
        .pointLng(d => d.lng)
        .pointLabel(d => `${d.location}\n${d.headline}`)
        .pointColor(() => '#ff3333')
        .pointRadius(0.35)
        .pointAltitude(0.02);

      // Configure controls
      const controls = globe.controls();
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.7;
      controls.enableZoom = true;
      controls.enablePan = true;

      // Handle point clicks
      globe.onPointClick((point) => {
        if (point) {
          setActiveOp(point);
        }
      });

      globeInstanceRef.current = globe;

      // Handle window resize
      const handleResize = () => {
        if (globeInstanceRef.current && globeRef.current) {
          const width = globeRef.current.clientWidth;
          const height = globeRef.current.clientHeight;
          globeInstanceRef.current.width(width);
          globeInstanceRef.current.height(height);
        }
      };

      window.addEventListener('resize', handleResize);
      handleResize(); // Initial size

      // Pulsating animation
      let t = 0;
      const baseAltitude = 0.02;
      const pulseAmplitude = 0.015;

      function animate() {
        if (!globeInstanceRef.current) return;
        
        t += 0.03;
        
        globeInstanceRef.current.pointAltitude(d => {
          const phase = (d.lat + d.lng) * 0.1;
          const scale = (Math.sin(t + phase) + 1) / 2;
          return baseAltitude + scale * pulseAmplitude;
        });

        // Optional: pulse radius slightly
        globeInstanceRef.current.pointRadius(d => {
          const phase = (d.lat + d.lng) * 0.1;
          const scale = (Math.sin(t + phase) + 1) / 2;
          return 0.35 + scale * 0.1;
        });

        animationFrameRef.current = requestAnimationFrame(animate);
      }

      animate();

      // Cleanup
      return () => {
        window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (globeInstanceRef.current) {
        globeInstanceRef.current._destructor?.();
      }
    };
  }).catch(err => {
    console.error('Failed to load Globe.gl:', err);
  });
  }, [isLoading, coveragePointsData]);

  // Format timestamp for display
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      });
    } catch {
      return timestamp;
    }
  };

  if (!isClient || isLoading) {
    return (
      <div className="cia-globe-root">
        <div className="cia-globe-canvas" ref={globeRef} />
        <div className="cia-hud-overlay">
          <div className="cia-hud-panel cia-hud-top-left">
            <div className="hud-label">GLOBAL COVERAGE // NOTEWORTHY OPS</div>
            <div className="hud-sub">LOADING • INITIALIZING</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cia-globe-root">
      <div className="cia-globe-canvas" ref={globeRef} />
      
      <div className="cia-hud-overlay">
        {/* Top-left: Mission title */}
        <div className="cia-hud-panel cia-hud-top-left">
          <div className="hud-label">GLOBAL COVERAGE // NOTEWORTHY OPS</div>
          <div className="hud-sub">LIVE FEED • RED CHANNEL</div>
        </div>

        {/* Top-right: Status panel */}
        <div className="cia-hud-panel cia-hud-top-right">
          <div className="hud-status-line">
            <strong>SYSTEM STATUS:</strong> ONLINE
            <span className="cia-live-dot"></span>
          </div>
          <div className="hud-status-line">
            <strong>ACTIVE TARGETS:</strong> {coveragePointsData.length}
          </div>
          <div className="hud-status-line">
            <strong>LATENCY:</strong> {Math.floor(Math.random() * 20 + 30)} ms
          </div>
          <div className="hud-status-line">
            <strong>LAST UPDATE:</strong> {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        {/* Active operation details */}
        {activeOp && (
          <div className="cia-hud-panel cia-active-op-panel">
            <div className="hud-label">ACTIVE OPERATION</div>
            <div className="cia-active-op-details">
              <div><strong>LOCATION:</strong> {activeOp.location}</div>
              <div><strong>COORDINATES:</strong> {activeOp.lat.toFixed(4)}°, {activeOp.lng.toFixed(4)}°</div>
              <div><strong>EVENT:</strong> {activeOp.headline}</div>
              <div><strong>TIMESTAMP:</strong> {formatTimestamp(activeOp.timestamp)}</div>
            </div>
          </div>
        )}

        {/* Bottom strip: Recent operations */}
        <div className="cia-hud-bottom-strip">
          {coveragePointsData.slice(0, 8).map((point) => (
            <div
              key={point.id}
              className={`cia-op-item ${activeOp?.id === point.id ? 'active' : ''}`}
              onClick={() => setActiveOp(point)}
            >
              <div className="cia-op-location">{point.location}</div>
              <div className="cia-op-headline">{point.headline}</div>
              <div className="cia-op-coords">
                {point.lat.toFixed(2)}°, {point.lng.toFixed(2)}°
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CiaMissionGlobe;







