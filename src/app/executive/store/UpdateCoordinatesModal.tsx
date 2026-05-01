'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import './UpdateCoordinatesModal.css';

interface UpdateCoordinatesModalProps {
  storeId: string;
  storeName: string;
  city: string;
  currentLat?: number | null;
  currentLng?: number | null;
  onClose: () => void;
  onSuccess: (storeId: string, latitude: number, longitude: number) => void;
}

declare global {
  interface Window {
    initUpdateCoordinatesMap?: () => void;
  }
}

const INDIA_CENTER = { lat: 20.5937, lng: 78.9629 };
const DEFAULT_ZOOM_INDIA = 5;
const DEFAULT_ZOOM_STORE = 15;

const UpdateCoordinatesModal: React.FC<UpdateCoordinatesModalProps> = ({
  storeId,
  storeName,
  city,
  currentLat,
  currentLng,
  onClose,
  onSuccess,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(
    currentLat != null && currentLng != null ? { lat: currentLat, lng: currentLng } : null
  );
  const [selectedAddress, setSelectedAddress] = useState<string>('Fetching location...');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const initMap = useCallback(() => {
    if (!mapRef.current || !window.google) return;

    const hasValidCoords =
      currentLat != null &&
      currentLng != null &&
      (Math.abs(currentLat) > 0.01 || Math.abs(currentLng) > 0.01);

    const center = hasValidCoords ? { lat: currentLat!, lng: currentLng! } : INDIA_CENTER;
    const zoom = hasValidCoords ? DEFAULT_ZOOM_STORE : DEFAULT_ZOOM_INDIA;

    const map = new window.google.maps.Map(mapRef.current, {
      center,
      zoom,
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: false,
      gestureHandling: 'greedy',
    });

    googleMapRef.current = map;
    geocoderRef.current = new window.google.maps.Geocoder();

    // Helper to perform reverse geocoding
    const updateAddress = (latLng: google.maps.LatLng) => {
      setSelectedAddress('Loading address details...');
      geocoderRef.current?.geocode({ location: latLng })
        .then((response) => {
          if (response.results[0]) {
            // Pick a suitably formatted address (usually the first one is the most specific)
            setSelectedAddress(response.results[0].formatted_address);
          } else {
            setSelectedAddress('Address not found');
          }
        })
        .catch(() => {
          setSelectedAddress('Unable to fetch address');
        });
    };

    // Seed initial coords from existing store coords
    if (currentLat != null && currentLng != null) {
      setSelectedCoords({ lat: currentLat, lng: currentLng });
      updateAddress(new window.google.maps.LatLng(currentLat, currentLng));
    }

    // Click → pan map so pin (centre) lands exactly on clicked point
    map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (e.latLng) map.panTo(e.latLng);
    });

    // After every pan / zoom the pin is already at centre — just sync coords and get address
    map.addListener('idle', () => {
      const c = map.getCenter();
      if (c) {
        setSelectedCoords({ lat: c.lat(), lng: c.lng() });
        updateAddress(c);
      }
    });

    setMapLoaded(true);

    // Initialize Autocomplete if search input exists
    if (searchInputRef.current && window.google.maps.places) {
      const autocomplete = new window.google.maps.places.Autocomplete(searchInputRef.current, {
        fields: ['geometry', 'name'],
      });
      autocomplete.bindTo('bounds', map);

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (!place.geometry || !place.geometry.location) {
          showToast('error', 'Location not found.');
          return;
        }

        if (place.geometry.viewport) {
          map.fitBounds(place.geometry.viewport);
        } else {
          map.setCenter(place.geometry.location);
          map.setZoom(17);
        }
      });
    }

  }, [currentLat, currentLng]);

  // Load Google Maps script
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set');
      setMapLoaded(false);
      return;
    }

    // If already loaded
    if (window.google && window.google.maps) {
      initMap();
      return;
    }

    const callbackName = 'initUpdateCoordinatesMap';
    window[callbackName] = () => {
      initMap();
    };

    const existingScript = document.getElementById('google-maps-ucm');
    if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'google-maps-ucm';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=${callbackName}`;
      script.async = true;
      script.defer = true;
      script.onerror = () => {
        console.error('Failed to load Google Maps script');
        showToast('error', 'Failed to load Google Maps. Please check your API key.');
      };
      document.head.appendChild(script);
    } else {
      // Script tag exists but window.google might not be ready yet
      // The callback is already registered on window[callbackName]
    }

    return () => {
      // Cleanup callback but NOT the script tag (it's shared)
      if (window[callbackName]) {
        delete window[callbackName];
      }
    };
  }, [initMap]);

  // Prevent background scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleSave = async () => {
    if (!selectedCoords) return;

    setSaving(true);
    try {
      const response = await fetch('/api/executive/store/coordinates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          storeId,
          latitude: selectedCoords.lat,
          longitude: selectedCoords.lng,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        showToast('success', '✅ Coordinates updated successfully!');
        onSuccess(storeId, selectedCoords.lat, selectedCoords.lng);
        setTimeout(() => onClose(), 1500);
      } else {
        showToast('error', `❌ ${result.error || 'Failed to update coordinates'}`);
      }
    } catch (err) {
      showToast('error', '❌ Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      showToast('error', 'Geolocation not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        googleMapRef.current?.panTo({ lat: latitude, lng: longitude });
        googleMapRef.current?.setZoom(17);
      },
      () => {
        showToast('error', 'Unable to get your location.');
      }
    );
  };

  return (
    <div className="ucm-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ucm-modal">
        {/* Header */}
        <div className="ucm-header">
          <div className="ucm-header-info">
            <span className="ucm-header-icon">📍</span>
            <div>
              <h2 className="ucm-title">Fix Store Coordinates</h2>
              <p className="ucm-subtitle">
                {storeName} — {city}
              </p>
            </div>
          </div>
          <button className="ucm-close-btn" onClick={onClose} disabled={saving}>
            ✕
          </button>
        </div>

        {/* Instructions */}
        <div className="ucm-instructions">
          <span className="ucm-instruction-icon">ℹ️</span>
          <span><strong>Pan the map</strong> to align the crosshair ✛ over the exact store location, or click anywhere on the map. Drag the pin to fine-tune.</span>
        </div>

        {/* Map */}
        <div className="ucm-map-wrapper">
          {/* Search Box */}
          <div className="ucm-search-container">
            <span className="ucm-search-icon">🔍</span>
            <input
              ref={searchInputRef}
              type="text"
              className="ucm-search-input"
              placeholder="Search for a place or address"
              autoComplete="off"
            />
          </div>

          {!apiKey && (
            <div className="ucm-map-error">
              <span className="ucm-error-icon">⚠️</span>
              <p>Google Maps API Key is missing.</p>
              <p className="ucm-error-hint">Please ensure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set in your production environment variables.</p>
            </div>
          )}

          {apiKey && !mapLoaded && (
            <div className="ucm-map-loading">
              <div className="ucm-spinner"></div>
              <span>Loading map…</span>
            </div>
          )}
          <div ref={mapRef} className="ucm-map" />
          {/* Swiggy-style red SVG pin — always fixed at map centre */}
          {mapLoaded && (
            <div className="ucm-pin-wrapper" aria-hidden="true">
              <svg
                className="ucm-pin-svg"
                width="40"
                height="56"
                viewBox="0 0 40 56"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Drop shadow filter */}
                <defs>
                  <filter id="pin-shadow" x="-30%" y="-10%" width="160%" height="160%">
                    <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="rgba(0,0,0,0.35)" />
                  </filter>
                </defs>
                {/* Pin body */}
                <path
                  d="M20 0C9 0 0 9.18 0 20.5C0 35.88 20 56 20 56C20 56 40 35.88 40 20.5C40 9.18 31 0 20 0Z"
                  fill="#E8231A"
                  filter="url(#pin-shadow)"
                />
                {/* Highlight sheen */}
                <ellipse cx="14" cy="13" rx="5" ry="4" fill="rgba(255,255,255,0.25)" />
                {/* White centre dot */}
                <circle cx="20" cy="20" r="7" fill="white" />
              </svg>
            </div>
          )}
        </div>

        {/* Coordinates display */}
        <div className="ucm-coords-panel">
          <div className="ucm-coords-header">
            {selectedCoords ? (
              <>
                <span className="ucm-coords-label">Selected:</span>
                <span className="ucm-coords-value">
                  {selectedCoords.lat.toFixed(6)}, {selectedCoords.lng.toFixed(6)}
                </span>
              </>
            ) : (
              <span className="ucm-coords-placeholder">Click or pan on the map</span>
            )}
            <button className="ucm-location-btn" onClick={handleUseMyLocation} title="Use my current location">
              🎯 My Location
            </button>
          </div>
          
          <div className="ucm-address-row">
            <span className="ucm-address-icon">📍</span>
            <span className="ucm-address-text">{selectedAddress}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="ucm-footer">
          <button className="ucm-cancel-btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            className="ucm-save-btn"
            onClick={handleSave}
            disabled={!selectedCoords || saving}
          >
            {saving ? (
              <>
                <span className="ucm-btn-spinner"></span>
                Saving…
              </>
            ) : (
              '💾 Save Coordinates'
            )}
          </button>
        </div>

        {/* Toast */}
        {toast && (
          <div className={`ucm-toast ucm-toast--${toast.type}`}>{toast.message}</div>
        )}
      </div>
    </div>
  );
};

export default UpdateCoordinatesModal;
