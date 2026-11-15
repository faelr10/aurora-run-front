import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';

import { subscribeFixes } from '@/services/location';
import type { TrackPoint } from '@/types/domain';
import { isReliableFix, preferLiveFix, type GeoPoint } from '@/utils/geo';

type LiveFix = GeoPoint;

type RouteMapProps = {
  points: TrackPoint[];
  follow?: boolean;
  searching?: boolean;
  dark?: boolean;
  ends?: boolean;
  height?: number | 'fill';
  onLive?: (fix: GeoPoint | null) => void;
};

const CLOSE_ZOOM = 18;

export function RouteMap({ points, follow = false, searching = true, dark = false, ends = false, height = 220, onLive }: RouteMapProps) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const centeredRef = useRef(false);
  const preciseRef = useRef(false);
  const [live, setLive] = useState<LiveFix | null>(null);
  const route = points.filter((point) => isReliableFix(point));
  const latest = route.at(-1) ?? null;

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    const map = L.map(node, { zoomControl: false, attributionControl: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);
    map.setView([0, 0], 2);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    const resize = () => map.invalidateSize();
    requestAnimationFrame(resize);
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!follow) return;
    return subscribeFixes((position) => {
      const { latitude, longitude, accuracy } = position.coords;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
      const next: LiveFix = {
        latitude,
        longitude,
        accuracy: Number.isFinite(accuracy) ? accuracy : null,
        timestamp: position.timestamp,
      };
      setLive((current) => preferLiveFix(current, next));
    });
  }, [follow]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    if (route.length > 1) {
      L.polyline(
        route.map((point) => [point.latitude, point.longitude] as [number, number]),
        { color: dark ? '#D6FF3E' : '#14B86A', weight: ends ? 5 : 4, lineCap: 'round', lineJoin: 'round' },
      ).addTo(layer);
    }
    const marker = follow
      ? live
        ? L.latLng(live.latitude, live.longitude)
        : latest
          ? L.latLng(latest.latitude, latest.longitude)
          : null
      : null;
    const accuracy = live?.accuracy ?? latest?.accuracy ?? null;
    const preciseNow = isReliableFix({ accuracy });
    if (marker) {
      if (accuracy != null && !preciseNow) {
        L.circle(marker, {
          radius: accuracy,
          color: '#14B86A',
          weight: 1,
          fillColor: '#14B86A',
          fillOpacity: 0.12,
        }).addTo(layer);
      }
      L.circleMarker(marker, {
        radius: dark ? 10 : 8,
        color: dark ? '#243018' : '#063F2A',
        weight: dark ? 3 : 2,
        fillColor: dark ? '#D6FF3E' : '#C9F55A',
        fillOpacity: 1,
      }).addTo(layer);
      if (!centeredRef.current || (preciseNow && !preciseRef.current)) {
        centeredRef.current = true;
        preciseRef.current = preciseNow;
        map.setView(marker, CLOSE_ZOOM);
      } else if (follow) {
        preciseRef.current = preciseNow;
        map.panTo(marker);
      }
    } else if (!follow && route.length > 0) {
      const start = route[0];
      const finish = route[route.length - 1];
      if (ends) {
        L.circleMarker([start.latitude, start.longitude], {
          radius: 7,
          color: '#141816',
          weight: 2,
          fillColor: '#d6ff3e',
          fillOpacity: 1,
        }).addTo(layer);
        if (route.length > 1) {
          L.circleMarker([finish.latitude, finish.longitude], {
            radius: 7,
            color: '#141816',
            weight: 2,
            fillColor: '#f7faf8',
            fillOpacity: 1,
          }).addTo(layer);
        }
      }
      if (route.length > 1) {
        map.fitBounds(
          route.map((point) => [point.latitude, point.longitude] as [number, number]),
          { padding: [32, 32], maxZoom: 17 },
        );
      } else {
        map.setView([start.latitude, start.longitude], 16);
      }
    }
    map.invalidateSize();
  }, [dark, ends, follow, latest, live, route]);

  const precise = isReliableFix({ accuracy: live?.accuracy ?? latest?.accuracy ?? null });

  useEffect(() => {
    onLive?.(live);
  }, [live, onLive]);

  return (
    <div className={dark ? 'map-frame map-dark' : 'map-frame'} style={{ height: height === 'fill' ? '100%' : height }}>
      <div ref={nodeRef} className="map-canvas" />
      {follow && searching && !live && !latest ? <p className="map-overlay">Buscando a localização</p> : null}
      {follow && (live || latest) && !precise ? (
        <p className="map-overlay">Localização aproximada. A distância entra quando o GPS ficar preciso.</p>
      ) : null}
    </div>
  );
}
