import React, { useState, useEffect } from 'react';
import Dashboard from './Dashboard';
import DeviceList from './DeviceList';
import NetworkSettings from './NetworkSettings';
import WifiSettings from './WifiSettings';
import RoutingSettings from './RoutingSettings';
import VPNSettings from './VPNSettings';
import NASSettings from './NASSettings';
import QoSSettings from './QoSSettings';
import PortalEditor from './PortalEditor';
import AdvancedSettings from './AdvancedSettings';
import Maintenance from './Maintenance';
import AIAssistant from './AIAssistant';
import CLIMonitor from './CLIMonitor';

export default function ClassicLayout({ onLogout }: { onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sysInfo, setSysInfo] = useState<any>(null);

  const fetchSysInfo = () => {
    fetch('/api/sysinfo').then(r => r.json()).then(setSysInfo).catch(()=>{});
  };

  useEffect(() => {
    fetchSysInfo();
    const int = setInterval(fetchSysInfo, 10000);
    return () => clearInterval(int);
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'devices': return <DeviceList />;
      case 'network': return <NetworkSettings />;
      case 'wifi': return <WifiSettings />;
      case 'routing': return <RoutingSettings />;
      case 'vpn': return <VPNSettings />;
      case 'nas': return <NASSettings />;
      case 'qos': return <QoSSettings />;
      case 'portal': return <PortalEditor />;
      case 'advanced': return <AdvancedSettings />;
      case 'maintenance': return <Maintenance />;
      case 'ai': return <AIAssistant />;
      case 'cli': return <CLIMonitor />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-white text-[#333333] font-sans text-[13px]">
      {/* Header */}
      <div className="bg-[#003399] text-white px-5 py-3 flex justify-between items-center border-b-4 border-[#ff9900]">
        <div className="text-[18px] font-bold">ルーター Web設定</div>
        {sysInfo && (
          <div className="flex gap-4">
            <span className="bg-white text-[#003399] px-3 py-0.5 rounded-full text-xs font-bold">WAN: {sysInfo.wan_if}</span>
            <span className="bg-white text-[#003399] px-3 py-0.5 rounded-full text-xs font-bold">モード: {sysInfo.config_mode}</span>
            <span className="text-xs self-center">{sysInfo.time}</span>
          </div>
        )}
      </div>

      <div className="flex h-[calc(100vh-54px)]">
        {/* Sidebar */}
        <div className="w-[240px] bg-[#f4f4f4] border-r border-[#cccccc] overflow-y-auto flex-shrink-0 flex flex-col">
          <MenuCategory title="情報" items={[
            { id: 'dashboard', label: '機器状態・構成図' },
            { id: 'devices', label: '接続端末一覧' }
          ]} active={activeTab} onSelect={setActiveTab} />
          
          <MenuCategory title="基本設定" items={[
            { id: 'network', label: 'LAN / DHCP設定' },
            { id: 'wifi', label: '無線LAN (Wi-Fi) 設定' },
          ]} active={activeTab} onSelect={setActiveTab} />

          <MenuCategory title="ルーティング・NAT" items={[
            { id: 'routing', label: '静的ルーティング・NAPT' },
            { id: 'qos', label: '帯域制御 (QoS)' },
          ]} active={activeTab} onSelect={setActiveTab} />

          <MenuCategory title="アプリケーション" items={[
            { id: 'nas', label: '簡易NAS・USB共有' },
          ]} active={activeTab} onSelect={setActiveTab} />

          <MenuCategory title="高度な設定" items={[
            { id: 'vpn', label: 'VPN (IPsec/L2TP) 設定' },
            { id: 'advanced', label: 'ファイアウォール・フィルタ' },
            { id: 'portal', label: 'キャプティブポータル' },
          ]} active={activeTab} onSelect={setActiveTab} />

          <MenuCategory title="管理" items={[
            { id: 'maintenance', label: '保守・ネットワーク診断' },
            { id: 'cli', label: 'CLI 実行ログ・端末' },
            { id: 'ai', label: 'AI アシスタント (Gemini)' },
          ]} active={activeTab} onSelect={setActiveTab} />

          <div className="mt-auto p-4 border-t border-[#cccccc]">
            <button onClick={onLogout} className="w-full bg-[#eeeeee] border border-[#888888] hover:bg-[#dddddd] py-1 text-sm">
              ログアウト
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-white p-5">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

function MenuCategory({ title, items, active, onSelect }: any) {
  return (
    <div>
      <div className="bg-[#dddddd] px-3 py-1.5 font-bold border-t border-white border-b border-[#cccccc] text-xs">
        {title}
      </div>
      {items.map((item: any) => (
        <button
          key={item.id}
          onClick={() => onSelect(item.id)}
          className={`w-full text-left px-5 py-2 text-[#003399] border-b border-dotted border-[#cccccc] text-[13px] hover:bg-[#e6e6e6] transition-none ${active === item.id ? 'bg-white text-black font-bold border-l-[5px] border-l-[#ff9900] pl-4' : ''}`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
