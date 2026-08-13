import React, { useEffect, useState } from 'react';
import type { ConnectedDevice } from '../types';

export default function DeviceList() {
  const [devices, setDevices] = useState<ConnectedDevice[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchDevices = () => {
    fetch('/api/devices').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setDevices(data);
      else setDevices([]);
    }).catch(() => setDevices([]));
  };

  useEffect(() => {
    fetchDevices();
    let int: any;
    if (autoRefresh) int = setInterval(fetchDevices, 5000);
    return () => clearInterval(int);
  }, [autoRefresh]);

  const handleBlock = async (mac: string) => {
    if (confirm(`端末 [${mac}] の通信を切断しますか？`)) {
      await fetch('/api/devices/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mac })
      });
      fetchDevices();
    }
  };

  return (
    <div>
      <h2 className="text-[16px] text-[#003399] border-l-[5px] border-l-[#003399] pl-2.5 border-b border-[#cccccc] pb-1 mt-0 mb-4 font-bold flex justify-between items-end">
        <span>接続端末一覧</span>
        <label className="text-[12px] font-normal text-black flex items-center gap-1 cursor-pointer">
          <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
          自動更新(5秒)
        </label>
      </h2>
      <div className="border border-[#cccccc] p-4 bg-[#fafafa]">
        <table className="w-full border-collapse border border-[#cccccc] bg-white text-[13px] text-center">
          <thead className="bg-[#eef3f6]">
            <tr>
              <th className="border border-[#cccccc] p-2 font-normal">IPアドレス</th>
              <th className="border border-[#cccccc] p-2 font-normal">MACアドレス</th>
              <th className="border border-[#cccccc] p-2 font-normal">経路</th>
              <th className="border border-[#cccccc] p-2 font-normal">アクション</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d, i) => (
              <tr key={i} className="hover:bg-[#f9f9f9]">
                <td className="border border-[#cccccc] p-2 text-[#003399] font-mono">{d.ip}</td>
                <td className="border border-[#cccccc] p-2 font-mono uppercase">{d.mac}</td>
                <td className="border border-[#cccccc] p-2">
                  {d.dev.includes('wlan') ? '無線(WLAN)' : '有線(LAN)'}
                </td>
                <td className="border border-[#cccccc] p-2">
                  <button 
                    onClick={() => handleBlock(d.mac)}
                    className="bg-[#cc0000] border border-[#990000] text-white px-3 py-1 text-xs hover:bg-[#aa0000]"
                  >
                    切断
                  </button>
                </td>
              </tr>
            ))}
            {devices.length === 0 && (
              <tr>
                <td colSpan={4} className="border border-[#cccccc] p-6 text-[#666]">
                  接続されている端末はありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
