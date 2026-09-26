import React, { useState, useEffect } from 'react';
import Dashboard from './Dashboard';
import DeviceList from './DeviceList';
import NetworkMonitor from './NetworkMonitor';
import NetworkSettings from './NetworkSettings';
import WifiSettings from './WifiSettings';
import RoutingSettings from './RoutingSettings';
import VPNSettings from './VPNSettings';
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
      case 'monitor': return <NetworkMonitor />;
      case 'network': return <NetworkSettings />;
      case 'wifi': return <WifiSettings />;
      case 'routing': return <RoutingSettings />;
      case 'vpn': return <VPNSettings />;
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
        <div className="text-[18px] font-bold tracking-tight">PiFi Enterprise Router Web設定</div>
        {sysInfo && (
          <div className="flex items-center gap-3 text-xs font-mono text-[#e2e8f0]">
            <span>WAN: <strong className="text-white">{sysInfo.wan_if}</strong></span>
            <span aria-hidden="true">·</span>
            <span>モード: <strong className="text-white">{sysInfo.config_mode}</strong></span>
            <span aria-hidden="true">·</span>
            <span>Gateway: <strong className="text-white">pifi.me/login</strong></span>
            <span aria-hidden="true">·</span>
            <span>{sysInfo.time}</span>
          </div>
        )}
      </div>

      <div className="flex h-[calc(100vh-54px)]">
        {/* Sidebar */}
        <div className="w-[240px] bg-[#f4f4f4] border-r border-[#cccccc] overflow-y-auto flex-shrink-0 flex flex-col">
          <MenuCategory title="ステータス・監視" items={[
            { id: 'dashboard', label: '機器状態・構成図' },
            { id: 'devices', label: '接続端末・強制認証・MAC制御' },
            { id: 'monitor', label: 'リアルタイム通信・DNS監視' }
          ]} active={activeTab} onSelect={setActiveTab} />
          
          <MenuCategory title="LAN・無線設定" items={[
            { id: 'network', label: 'LAN / DHCP固定予約 / DNS' },
            { id: 'wifi', label: '無線LAN (AP / クライアント)' },
          ]} active={activeTab} onSelect={setActiveTab} />

          <MenuCategory title="NAT・ルーティング・QoS" items={[
            { id: 'routing', label: 'ポート開放(NAPT) / DMZ / 経路' },
            { id: 'qos', label: '帯域制御 (トラフィックQoS)' },
          ]} active={activeTab} onSelect={setActiveTab} />

          <MenuCategory title="セキュリティ・ポータル" items={[
            { id: 'advanced', label: 'ファイアウォール・BBR・ACL' },
            { id: 'portal', label: 'キャプティブポータル (CAPTCHA無)' },
            { id: 'vpn', label: 'VPNサーバー (IPsec/WireGuard)' },
          ]} active={activeTab} onSelect={setActiveTab} />

          <MenuCategory title="保守・診断・CLI" items={[
            { id: 'maintenance', label: '診断・カーネル表・設定保存' },
            { id: 'cli', label: 'ルートCLI端末・実行ログ' },
            { id: 'ai', label: 'AI ネットワーク管理 (Gemini)' },
          ]} active={activeTab} onSelect={setActiveTab} />

          <div className="mt-auto p-4 border-t border-[#cccccc]">
            <button onClick={onLogout} className="w-full bg-[#eeeeee] border border-[#888888] hover:bg-[#dddddd] py-1.5 text-xs font-bold cursor-pointer">
              ログアウト (pifi.me/login へ)
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
