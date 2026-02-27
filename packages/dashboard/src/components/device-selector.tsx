'use client';

import { useEffect, useState } from 'react';
import { api, type Device } from '@/lib/api-client';

interface DeviceSelectorProps {
  onDeviceSelect?: (device: Device) => void;
}

export function DeviceSelector({ onDeviceSelect }: DeviceSelectorProps) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDevices()
      .then((data) => setDevices(data.devices))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const booted = devices.filter((d) => d.state === 'Booted');
  const available = devices.filter((d) => d.state !== 'Booted');

  if (loading) {
    return <span className="text-xs text-[var(--text-secondary)]">Loading devices...</span>;
  }

  return (
    <select
      onChange={(e) => {
        const device = devices.find((d) => d.udid === e.target.value);
        if (device) onDeviceSelect?.(device);
      }}
      defaultValue={booted[0]?.udid ?? ''}
      className="bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-md px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
    >
      {booted.length > 0 && (
        <optgroup label="Booted">
          {booted.map((d) => (
            <option key={d.udid} value={d.udid}>
              {d.name} (Booted)
            </option>
          ))}
        </optgroup>
      )}
      {available.length > 0 && (
        <optgroup label="Available">
          {available.map((d) => (
            <option key={d.udid} value={d.udid}>
              {d.name}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}
