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
      <h2 className="text-[16px] text-[#003399] border-l-[5px] border-l-[#003399] pl-2.5 border-b border-[#cccccc] pb-1 mt-0 mb-4 font-bold">
        機器状態
      </h2>
      <div className="border border-[#cccccc] p-4 mb-5 bg-[#fafafa]">
        <table className="w-full border-collapse border border-[#cccccc] bg-white text-[13px]">
          <tbody>
            <tr><th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">システム時刻</th><td className="border border-[#cccccc] p-2">{sysInfo.time}</td></tr>
            <tr><th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">メモリ使用率</th><td className="border border-[#cccccc] p-2">{sysInfo.mem} %</td></tr>
            <tr><th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">WANインターフェース</th><td className="border border-[#cccccc] p-2">{sysInfo.wan_if}</td></tr>
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
            <p className="font-bold text-[#333]">Internet</p>
            <p className="text-[11px] text-[#666]">{sysInfo.wan_if}</p>
          </div>
          
          <div className="h-0.5 w-16 bg-[#003399]"></div>
          
          <div className="text-center">
            <div className="w-16 h-24 bg-[#003399] border-2 border-black flex items-center justify-center mx-auto mb-2">
               <span className="text-white text-xs font-bold [writing-mode:vertical-rl]">ROUTER</span>
            </div>
            <p className="font-bold text-[#333]">本機</p>
            <p className="text-[11px] text-[#003399]">192.168.4.1</p>
          </div>

          <div className="h-0.5 w-16 bg-[#009900]"></div>
          
          <div className="text-center">
             <div className="w-14 h-14 bg-white border border-[#999] rounded-md flex items-center justify-center mx-auto mb-2 font-bold text-sm">LAN</div>
            <p className="font-bold text-[#333]">Clients</p>
            <p className="text-[11px] text-[#666]">{devices.length} 台接続中</p>
          </div>
        </div>
      </div>
    </div>
  );
}
