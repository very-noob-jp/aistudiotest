import React, { useEffect, useState } from 'react';
import type { ConnectedDevice } from '../types';

export default function DeviceList() {
  const [devices, setDevices] = useState<ConnectedDevice[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [statusMsg, setStatusMsg] = useState('');
  const [editingMac, setEditingMac] = useState<string | null>(null);
  const [aliasInput, setAliasInput] = useState('');

  const fetchDevices = () => {
    fetch('/api/devices')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setDevices(data);
        else setDevices([]);
      })
      .catch(() => setDevices([]));
  };

  useEffect(() => {
    fetchDevices();
    let int: any;
    if (autoRefresh) int = setInterval(fetchDevices, 5000);
    return () => clearInterval(int);
  }, [autoRefresh]);

  const notify = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(''), 4000);
  };

  const handleToggleBlock = async (d: ConnectedDevice) => {
    const endpoint = d.blocked ? '/api/devices/unblock' : '/api/devices/block';
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mac: d.mac })
    });
    notify(d.blocked ? `端末 [${d.mac}] のブロックを解除しました。` : `端末 [${d.mac}] の通信をファイアウォールで遮断しました。`);
    fetchDevices();
  };

  const handleToggleAuth = async (d: ConnectedDevice) => {
    const authorize = !d.authenticated;
    await fetch('/api/devices/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mac: d.mac, ip: d.ip, authorize })
    });
    notify(authorize ? `端末 [${d.ip}] をポータル認証済み（通信許可）に設定しました。` : `端末 [${d.ip}] のポータル認証を解除しました。`);
    fetchDevices();
  };

  const handleReserveStaticIp = async (d: ConnectedDevice) => {
    await fetch('/api/config/dhcp-static', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add',
        lease: {
          mac: d.mac,
          ip: d.ip,
          hostname: d.alias || d.hostname || `client-${d.ip.split('.').pop()}`
        }
      })
    });
    notify(`端末 [${d.mac}] を IP ${d.ip} でDHCP固定予約に登録しました。`);
  };

  const handleSaveAlias = async (mac: string) => {
    await fetch('/api/devices/alias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mac, alias: aliasInput })
    });
    setEditingMac(null);
    fetchDevices();
    notify('端末の識別名を保存しました。');
  };

  return (
    <div>
      <h2 className="text-[16px] text-[#003399] border-l-[5px] border-l-[#003399] pl-2.5 border-b border-[#cccccc] pb-1 mt-0 mb-4 font-bold flex justify-between items-end">
        <span>接続クライアント管理・強制認証・MACフィルタ</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchDevices}
            className="bg-[#eeeeee] border border-[#888888] hover:bg-[#dddddd] px-2.5 py-0.5 text-xs font-normal text-black cursor-pointer"
          >
            今すぐ更新
          </button>
          <label className="text-[12px] font-normal text-black flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
            自動更新(5秒)
          </label>
        </div>
      </h2>

      {statusMsg && (
        <div className="bg-[#ecfdf5] border border-[#10b981] text-[#065f46] px-4 py-2 mb-4 text-xs font-bold">
          {statusMsg}
        </div>
      )}

      <div className="border border-[#cccccc] p-4 bg-[#fafafa]">
        <p className="mb-3 text-xs text-[#555]">
          ARPテーブルおよびDHCPリースから検出された全クライアント一覧です。管理画面からワンクリックで「ポータル認証の強制許可」「固定IP化」「通信遮断」を行えます。
        </p>
        <table className="w-full border-collapse border border-[#cccccc] bg-white text-[13px] text-center">
          <thead className="bg-[#eef3f6]">
            <tr>
              <th className="border border-[#cccccc] p-2 font-normal">端末名 / ホスト名</th>
              <th className="border border-[#cccccc] p-2 font-normal">IPアドレス</th>
              <th className="border border-[#cccccc] p-2 font-normal">MACアドレス</th>
              <th className="border border-[#cccccc] p-2 font-normal">インターフェース</th>
              <th className="border border-[#cccccc] p-2 font-normal">ネット認証状態</th>
              <th className="border border-[#cccccc] p-2 font-normal">管理アクション</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d, i) => (
              <tr key={i} className="hover:bg-[#f9f9f9]">
                <td className="border border-[#cccccc] p-2 text-left">
                  {editingMac === d.mac ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={aliasInput}
                        onChange={e => setAliasInput(e.target.value)}
                        className="border border-[#003399] p-1 text-xs w-28"
                        placeholder="識別名"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveAlias(d.mac)}
                        className="bg-[#003399] text-white px-2 py-0.5 text-xs cursor-pointer"
                      >
                        保存
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[#222]">
                        {d.alias || d.hostname || '不明な端末'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMac(d.mac);
                          setAliasInput(d.alias || d.hostname || '');
                        }}
                        className="text-[11px] text-[#003399] underline cursor-pointer"
                      >
                        名前変更
                      </button>
                    </div>
                  )}
                </td>
                <td className="border border-[#cccccc] p-2 text-[#003399] font-mono font-bold tabular-nums">{d.ip}</td>
                <td className="border border-[#cccccc] p-2 font-mono uppercase tabular-nums">{d.mac}</td>
                <td className="border border-[#cccccc] p-2 font-mono text-xs">
                  {d.dev.includes('wlan') ? '無線 AP (wlan0)' : `有線 (${d.dev})`}
                </td>
                <td className="border border-[#cccccc] p-2">
                  {d.blocked ? (
                    <span className="text-[#991b1b] font-bold text-xs">✕ 遮断中 (Blocked)</span>
                  ) : d.authenticated ? (
                    <span className="text-[#166534] font-bold text-xs">● 認証済 (WAN許可)</span>
                  ) : (
                    <span className="text-[#b45309] font-bold text-xs">○ 未認証 (Portal待)</span>
                  )}
                </td>
                <td className="border border-[#cccccc] p-2 space-x-1.5 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleToggleAuth(d)}
                    className={`px-2.5 py-1 text-xs font-bold border cursor-pointer ${
                      d.authenticated
                        ? 'bg-[#fffbeb] border-[#f59e0b] text-[#b45309] hover:bg-[#fef3c7]'
                        : 'bg-[#059669] border-[#047857] text-white hover:bg-[#047857]'
                    }`}
                  >
                    {d.authenticated ? '認証解除' : '強制認証許可'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReserveStaticIp(d)}
                    className="bg-[#eef3f6] border border-[#003399] text-[#003399] px-2.5 py-1 text-xs hover:bg-[#dce7ef] cursor-pointer"
                  >
                    固定IP化
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleBlock(d)}
                    className={`px-2.5 py-1 text-xs font-bold border cursor-pointer ${
                      d.blocked
                        ? 'bg-[#2563eb] border-[#1d4ed8] text-white hover:bg-[#1d4ed8]'
                        : 'bg-[#cc0000] border border-[#990000] text-white hover:bg-[#aa0000]'
                    }`}
                  >
                    {d.blocked ? '遮断解除' : 'MAC遮断'}
                  </button>
                </td>
              </tr>
            ))}
            {devices.length === 0 && (
              <tr>
                <td colSpan={6} className="border border-[#cccccc] p-6 text-[#666]">
                  現在接続されている端末はありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
