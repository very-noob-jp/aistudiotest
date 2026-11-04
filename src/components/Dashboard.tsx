import React, { useEffect, useState } from 'react';

export default function Dashboard() {
  const [sysInfo, setSysInfo] = useState<any>(null);
  const [devices, setDevices] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/sysinfo').then(r => r.json()).then(setSysInfo);
    fetch('/api/devices').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setDevices(data);
      else setDevices([]);
    }).catch(() => setDevices([]));
  }, []);

  if (!sysInfo) return <div className="text-[#666]">読み込み中...</div>;

  return (
    <div>
      <div className="flex justify-between items-center border-b border-[#cccccc] pb-1 mb-4">
        <h2 className="text-[16px] text-[#003399] border-l-[5px] border-l-[#003399] pl-2.5 font-bold m-0">
          機器状態 (System Status)
        </h2>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 text-xs font-bold rounded ${sysInfo.is_windows ? 'bg-[#dbeafe] text-[#1e40af] border border-[#93c5fd]' : 'bg-[#e0f2fe] text-[#0369a1] border border-[#7dd3fc]'}`}>
            OS: {sysInfo.os_platform || (sysInfo.is_windows ? 'Windows' : 'Linux')} ({sysInfo.os_arch || 'x64'})
          </span>
          {sysInfo.os_hostname && (
            <span className="text-xs text-[#666] font-mono">
              Host: {sysInfo.os_hostname}
            </span>
          )}
        </div>
      </div>

      <div className="border border-[#cccccc] p-4 mb-5 bg-[#fafafa]">
        <table className="w-full border-collapse border border-[#cccccc] bg-white text-[13px]">
          <tbody>
            <tr><th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">システム時刻</th><td className="border border-[#cccccc] p-2">{sysInfo.time}</td></tr>
            <tr>
              <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">実行プラットフォーム</th>
              <td className="border border-[#cccccc] p-2">
                <span className="font-bold text-[#003399]">{sysInfo.os_platform || 'Linux'}</span>
                <span className="ml-2 text-xs text-[#666]">({sysInfo.is_windows ? 'Windows Native ネットワークスタック' : 'Linux Kernel iptables & systemd'})</span>
              </td>
            </tr>
            <tr>
              <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">WAN インターフェース (上流)</th>
              <td className="border border-[#cccccc] p-2 font-mono font-bold text-[#003399]">
                {sysInfo.wan_if}
              </td>
            </tr>
            <tr>
              <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">LAN / AP インターフェース (配信)</th>
              <td className="border border-[#cccccc] p-2 font-mono font-bold text-[#008800]">
                {sysInfo.lan_if || 'wlan0'}
              </td>
            </tr>
            <tr><th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">メモリ使用率</th><td className="border border-[#cccccc] p-2">{sysInfo.mem} %</td></tr>
            <tr><th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">CPU動作クロック</th><td className="border border-[#cccccc] p-2">{sysInfo.cpu_freq || '取得不可'}</td></tr>
            <tr><th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">CPU温度</th><td className="border border-[#cccccc] p-2">{sysInfo.temp}°C</td></tr>
            <tr><th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">接続デバイス数</th><td className="border border-[#cccccc] p-2">{devices.length} 台</td></tr>
            <tr><th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">連続稼働時間</th><td className="border border-[#cccccc] p-2">{sysInfo.uptime}</td></tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-[16px] text-[#003399] border-l-[5px] border-l-[#003399] pl-2.5 border-b border-[#cccccc] pb-1 mt-0 mb-4 font-bold">
        ネットワーク構成
      </h2>
      <div className="border border-[#cccccc] p-4 bg-[#fafafa]">
        <div className="flex flex-col md:flex-row items-center justify-center gap-8 py-4">
          <div className="text-center">
            <div className="w-14 h-14 bg-white border border-[#999] rounded-full flex items-center justify-center mx-auto mb-2 font-bold text-sm">INET</div>
            <p className="font-bold text-[#333]">Internet (WAN)</p>
            <p className="text-[11px] text-[#003399] font-mono font-bold">{sysInfo.wan_if}</p>
          </div>
          
          <div className="h-0.5 w-16 bg-[#003399]"></div>
          
          <div className="text-center">
            <div className="w-16 h-24 bg-[#003399] border-2 border-black flex items-center justify-center mx-auto mb-2">
               <span className="text-white text-xs font-bold [writing-mode:vertical-rl]">ROUTER</span>
            </div>
            <p className="font-bold text-[#333]">本機</p>
            <p className="text-[11px] text-[#003399] font-mono">192.168.4.1</p>
          </div>

          <div className="h-0.5 w-16 bg-[#009900]"></div>
          
          <div className="text-center">
             <div className="w-14 h-14 bg-white border border-[#999] rounded-md flex items-center justify-center mx-auto mb-2 font-bold text-sm">LAN</div>
            <p className="font-bold text-[#333]">Clients (LAN)</p>
            <p className="text-[11px] text-[#008800] font-mono font-bold">{sysInfo.lan_if || 'wlan0'}</p>
            <p className="text-[11px] text-[#666]">{devices.length} 台接続中</p>
          </div>
        </div>
      </div>
    </div>
  );
}
