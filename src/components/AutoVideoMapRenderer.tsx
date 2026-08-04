import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface AutoVideoMapRendererProps {
  waypoints: { lat: number; lng: number; label?: string }[];
  style: 'standard' | 'satellite' | 'dark' | 'vintage';
  duration: number; // in seconds
  onComplete: (blobUrl: string) => void;
  width?: number;
  height?: number;
}

export const AutoVideoMapRenderer: React.FC<AutoVideoMapRendererProps> = ({
  waypoints,
  style,
  duration,
  onComplete,
  width = 1920,
  height = 1080
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!mapContainerRef.current || !canvasRef.current || waypoints.length === 0) return;

    setIsGenerating(true);

    // Initialize Map
    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true // Use canvas renderer for Leaflet
    }).setView([waypoints[0].lat, waypoints[0].lng], 5);

    // Tiles
    let tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    if (style === 'dark') tileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    else if (style === 'vintage') tileUrl = 'https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg';
    
    L.tileLayer(tileUrl, { maxZoom: 18, crossOrigin: true }).addTo(map);

    const polyline = L.polyline([], { color: '#ff3333', weight: 6, dashArray: '10, 10' }).addTo(map);

    // Setup Canvas & MediaRecorder
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use L.canvas() internally but to capture it as a video stream, we have to copy the leaflet canvas to our own canvas
    const stream = canvas.captureStream(30);
    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });
    const chunks: Blob[] = [];

    mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      onComplete(url);
      setIsGenerating(false);
      map.remove();
    };

    // Animation loop
    const totalFrames = duration * 30;
    let currentFrame = 0;
    
    // Fit bounds first
    map.fitBounds(L.latLngBounds(waypoints), { padding: [100, 100] });

    mediaRecorder.start();

    const drawFrame = () => {
      if (currentFrame > totalFrames) {
        mediaRecorder.stop();
        return;
      }

      // Progress calculation
      const progress = currentFrame / totalFrames;
      
      // Interpolate route
      if (waypoints.length > 1) {
        const routePoints: L.LatLngExpression[] = [];
        const maxIndex = (waypoints.length - 1) * progress;
        
        for (let i = 0; i <= Math.floor(maxIndex); i++) {
          routePoints.push([waypoints[i].lat, waypoints[i].lng]);
        }
        
        const lastFullIndex = Math.floor(maxIndex);
        if (lastFullIndex < waypoints.length - 1) {
          const remainder = maxIndex - lastFullIndex;
          const lat = waypoints[lastFullIndex].lat + (waypoints[lastFullIndex+1].lat - waypoints[lastFullIndex].lat) * remainder;
          const lng = waypoints[lastFullIndex].lng + (waypoints[lastFullIndex+1].lng - waypoints[lastFullIndex].lng) * remainder;
          routePoints.push([lat, lng]);
        }
        
        polyline.setLatLngs(routePoints);
      }

      // Copy leaflet canvas to our canvas
      const leafletCanvases = mapContainerRef.current?.querySelectorAll('canvas');
      if (leafletCanvases && leafletCanvases.length > 0) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, height);
        
        // Draw tiles and vectors
        leafletCanvases.forEach(lc => {
          ctx.drawImage(lc, 0, 0, width, height);
        });
      }

      currentFrame++;
      requestAnimationFrame(drawFrame);
    };

    // Give tiles a moment to load before starting
    setTimeout(() => {
      drawFrame();
    }, 1000);

    return () => {
      if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
      map.remove();
    };
  }, [waypoints, style, duration]);

  return (
    <div style={{ position: 'fixed', top: '-10000px', left: '-10000px' }}>
      <div 
        ref={mapContainerRef} 
        style={{ width: `${width}px`, height: `${height}px` }}
      />
      <canvas 
        ref={canvasRef}
        width={width}
        height={height}
      />
    </div>
  );
};
