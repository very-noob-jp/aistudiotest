import express from 'express';
import path from 'path';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { 
  getSysInfo, getConnectedDevices, loadConfig, saveConfig, 
  setWifiMode, setupWifiAP, blockMac, unblockMac, reloadRouting, runSudo, PORTAL_FILE, getMacFromIp,
  loadAuthMacs, saveAuthMacs, addPortForward, applyQoS, applyLocalDns, applyDhcpAndDnsExtras,
  runPing, runTraceroute, runDnsLookup, getKernelNetworkTables, getCmdLogs,
  getNetworkMonitorStats, getDnsQueryLogs
} from './server/network.ts';

const PORT = 3000;

async function startServer() {
  const app = express();
  
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // --- API Routes ---
  const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const config = loadConfig();
    if (req.cookies?.admin_token !== config.admin_password) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    next();
  };

  app.post('/api/auth/login', (req, res) => {
    const { password } = req.body;
    const config = loadConfig();
    if (password === config.admin_password) {
      res.cookie('admin_token', password, { httpOnly: true, maxAge: 86400000 });
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, message: 'Invalid password' });
    }
  });
  
  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('admin_token');
    res.json({ success: true });
  });

  app.get('/api/auth/status', async (req, res) => {
    const config = loadConfig();
    const isAdminAuthed = req.cookies?.admin_token === config.admin_password;
    const ip = req.ip || req.socket.remoteAddress || "";
    const cleanIp = ip.replace(/^.*:/, '').trim();
    const mac = await getMacFromIp(ip);
    const authData = loadAuthMacs();
    const portalAuthed = Boolean(
      config.portal_enabled === false ||
      (cleanIp && authData[cleanIp]) ||
      (mac && authData[mac])
    );
    res.json({
      authenticated: isAdminAuthed,
      client_ip: cleanIp || '192.168.4.x',
      client_mac: mac || null,
      portal_authed: portalAuthed,
      portal_enabled: config.portal_enabled !== false,
      captcha_provider: config.captcha_provider || 'none',
      ssid: config.ap_ssid || 'Free_WiFi_Pi',
      local_dns_name: config.local_dns_name || 'pifi.me',
      lan_ip: config.lan_ip || '192.168.4.1'
    });
  });

  app.get('/api/sysinfo', requireAdmin, async (req, res) => {
    const info = await getSysInfo();
    const config = loadConfig();
    res.json({ ...info, config_mode: config.wifi_mode });
  });

  app.get('/api/devices', requireAdmin, async (req, res) => {
    const devices = await getConnectedDevices();
    res.json(devices);
  });
  
  app.get('/api/config', requireAdmin, (req, res) => {
    res.json(loadConfig());
  });

  app.post('/api/config', requireAdmin, (req, res) => {
    const config = loadConfig();
    const newConfig = { ...config, ...req.body };
    saveConfig(newConfig);
    res.json({ success: true });
  });

  app.post('/api/wifi/mode', requireAdmin, async (req, res) => {
    const targetMode = req.body.mode || req.body.wifi_mode;
    const sta_ssid = req.body.sta_ssid;
    const sta_pwd = req.body.sta_pwd;

    if (!targetMode || (targetMode !== 'AP' && targetMode !== 'STA')) {
      return res.status(400).json({ error: '動作モード (AP または STA) が不正です。' });
    }

    const config = loadConfig();
    config.wifi_mode = targetMode;
    if (targetMode === 'STA') {
      if (sta_ssid !== undefined) config.sta_ssid = sta_ssid;
      if (sta_pwd !== undefined) config.sta_pwd = sta_pwd;
    }
    saveConfig(config);

    try {
      const result = await setWifiMode(targetMode, config.sta_ssid, config.sta_pwd);
      if (targetMode === 'STA') {
        res.json({ 
          success: true, 
          message: `クライアント (普段使い) モードに切り替えました。接続先SSID: "${config.sta_ssid || ''}"`,
          detail: result
        });
      } else {
        res.json({ 
          success: true, 
          message: `アクセスポイント (AP) モードに切り替えました。` 
        });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Wi-Fiモード切り替え処理に失敗しました。' });
    }
  });

  app.post('/api/wifi/init-ap', requireAdmin, async (req, res) => {
    try {
      await setupWifiAP();
      res.json({ success: true, message: 'Wi-Fi AP (wlan0) 構築・再起動が完了しました。' });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'AP構築に失敗しました。' });
    }
  });

  app.post('/api/wifi/ap-security', requireAdmin, async (req, res) => {
    const { ap_ssid, ap_security, ap_password } = req.body;
    const config = loadConfig();
    if (ap_ssid) config.ap_ssid = ap_ssid;
    if (ap_security) config.ap_security = ap_security;
    if (ap_password !== undefined) config.ap_password = ap_password;
    saveConfig(config);
    try {
      await setupWifiAP();
      res.json({ success: true, message: 'Wi-Fi アクセスポイント(AP) セキュリティ設定を更新・適用しました。' });
    } catch (e: any) {
      res.status(500).json({ error: e.message || '設定の適用に失敗しました。' });
    }
  });

  app.post('/api/wifi/advanced', requireAdmin, async (req, res) => {
    const { band, isolation } = req.body;
    const config = loadConfig();
    if (band) {
      config.wifi_band = band;
      const hw_mode = band === '5g' ? 'a' : 'g';
      const channel = band === '5g' ? '36' : '6';
      await runSudo(`sed -i "s/^#*hw_mode=.*/hw_mode=${hw_mode}/" /etc/hostapd/hostapd.conf`);
      await runSudo(`sed -i "s/^#*channel=.*/channel=${channel}/" /etc/hostapd/hostapd.conf`);
    }
    if (isolation !== undefined) {
      config.ap_isolation = isolation;
      if (isolation) await runSudo(`iptables -I FORWARD -i wlan0 -o wlan0 -j DROP`);
      else await runSudo(`iptables -D FORWARD -i wlan0 -o wlan0 -j DROP`);
    }
    saveConfig(config);
    await runSudo("systemctl restart hostapd");
    res.json({ success: true });
  });

  app.post('/api/routing/reload', requireAdmin, async (req, res) => {
    await reloadRouting();
    res.json({ success: true, message: 'Routing rules reloaded' });
  });

  app.post('/api/routing/portfwd', requireAdmin, async (req, res) => {
    const { action, rule, src_port, dest_ip, dest_port, protocol, name } = req.body;
    const config = loadConfig();
    if (action === 'del' && rule?.id) {
      config.port_forwards = (config.port_forwards || []).filter((r: any) => r.id !== rule.id);
      saveConfig(config);
      await reloadRouting();
      return res.json({ success: true, port_forwards: config.port_forwards });
    }
    if (action === 'toggle' && rule?.id) {
      config.port_forwards = (config.port_forwards || []).map((r: any) =>
        r.id === rule.id ? { ...r, enabled: !r.enabled } : r
      );
      saveConfig(config);
      await reloadRouting();
      return res.json({ success: true, port_forwards: config.port_forwards });
    }
    const newRule = {
      id: Date.now().toString(),
      name: name || `Port ${src_port}`,
      protocol: protocol || 'tcp',
      src_port: String(src_port),
      dest_ip: String(dest_ip),
      dest_port: String(dest_port),
      enabled: true
    };
    config.port_forwards = [...(config.port_forwards || []), newRule];
    saveConfig(config);
    await addPortForward(src_port, dest_ip, dest_port);
    await reloadRouting();
    res.json({ success: true, port_forwards: config.port_forwards });
  });

  app.post('/api/routing/nat-options', requireAdmin, async (req, res) => {
    const { dmz_enabled, dmz_ip, mss_clamping, upnp_enabled } = req.body;
    const config = loadConfig();
    Object.assign(config, { dmz_enabled, dmz_ip, mss_clamping, upnp_enabled });
    saveConfig(config);
    if (upnp_enabled) {
      await runSudo("systemctl start miniupnpd || true");
    } else {
      await runSudo("systemctl stop miniupnpd || true");
    }
    await reloadRouting();
    res.json({ success: true });
  });

  app.post('/api/routing/static', requireAdmin, async (req, res) => {
    const { action, route } = req.body;
    const config = loadConfig();
    const { id, dest, gateway, metric } = route;
    
    if (action === 'add') {
      config.static_routes = [...(config.static_routes || []), { id: id || Date.now().toString(), dest, gateway, metric }];
      await runSudo(`ip route add ${dest} via ${gateway} metric ${metric}`);
    } else if (action === 'del') {
      config.static_routes = (config.static_routes || []).filter(r => r.id !== id);
      await runSudo(`ip route del ${dest} via ${gateway} metric ${metric}`);
    }
    
    saveConfig(config);
    res.json({ success: true });
  });

  app.post('/api/config/lan', requireAdmin, async (req, res) => {
    const { lan_ip, subnet_mask, dhcp_enabled, dhcp_start, dhcp_end, lease_time, custom_dns1, custom_dns2, dhcp_static_leases, custom_dns_records } = req.body;
    const config = loadConfig();
    Object.assign(config, {
      lan_ip, subnet_mask, dhcp_enabled, dhcp_start, dhcp_end, lease_time,
      ...(custom_dns1 !== undefined ? { custom_dns1 } : {}),
      ...(custom_dns2 !== undefined ? { custom_dns2 } : {}),
      ...(dhcp_static_leases !== undefined ? { dhcp_static_leases } : {}),
      ...(custom_dns_records !== undefined ? { custom_dns_records } : {})
    });
    saveConfig(config);
    
    try {
      await applyDhcpAndDnsExtras();
      if (config.wifi_mode === 'AP') {
        await setupWifiAP();
      } else {
        await runSudo("ip addr flush dev wlan0 || true");
        await runSudo(`ip addr add ${lan_ip}/24 dev wlan0 || true`);
      }
      res.json({ success: true, message: 'LAN settings updated and applied successfully.' });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'LAN設定の適用に失敗しました。' });
    }
  });

  app.post('/api/config/dhcp-static', requireAdmin, async (req, res) => {
    const { action, lease } = req.body;
    const config = loadConfig();
    if (action === 'add' && lease?.mac && lease?.ip) {
      const cleanMac = lease.mac.toLowerCase().trim();
      const filtered = (config.dhcp_static_leases || []).filter((l: any) => l.mac.toLowerCase() !== cleanMac);
      config.dhcp_static_leases = [...filtered, {
        id: lease.id || Date.now().toString(),
        mac: cleanMac,
        ip: lease.ip.trim(),
        hostname: (lease.hostname || '').trim()
      }];
    } else if (action === 'del' && lease?.id) {
      config.dhcp_static_leases = (config.dhcp_static_leases || []).filter((l: any) => l.id !== lease.id);
    }
    saveConfig(config);
    await applyDhcpAndDnsExtras();
    await runSudo("systemctl restart dnsmasq || true");
    res.json({ success: true, dhcp_static_leases: config.dhcp_static_leases });
  });

  app.post('/api/config/dns-records', requireAdmin, async (req, res) => {
    const { action, record } = req.body;
    const config = loadConfig();
    if (action === 'add' && record?.domain && record?.ip) {
      config.custom_dns_records = [...(config.custom_dns_records || []), {
        id: Date.now().toString(),
        domain: record.domain.trim(),
        ip: record.ip.trim()
      }];
    } else if (action === 'del' && record?.id) {
      config.custom_dns_records = (config.custom_dns_records || []).filter((r: any) => r.id !== record.id);
    }
    saveConfig(config);
    await applyDhcpAndDnsExtras();
    await runSudo("systemctl restart dnsmasq || true");
    res.json({ success: true, custom_dns_records: config.custom_dns_records });
  });

  app.post('/api/config/firewall', requireAdmin, async (req, res) => {
    const { strict_ip_binding, adblock_enabled, dos_protection, block_wan_ping, tcp_bbr_enabled, action, rule } = req.body;
    const config = loadConfig();
    if (strict_ip_binding !== undefined) config.strict_ip_binding = strict_ip_binding;
    if (adblock_enabled !== undefined) config.adblock_enabled = adblock_enabled;
    if (dos_protection !== undefined) config.dos_protection = dos_protection;
    if (block_wan_ping !== undefined) config.block_wan_ping = block_wan_ping;
    if (tcp_bbr_enabled !== undefined) config.tcp_bbr_enabled = tcp_bbr_enabled;

    if (action === 'add_rule' && rule) {
      config.firewall_rules = [...(config.firewall_rules || []), {
        id: Date.now().toString(),
        name: rule.name || 'Custom Rule',
        direction: rule.direction || 'FORWARD',
        protocol: rule.protocol || 'tcp',
        src_ip: rule.src_ip || '',
        dst_port: rule.dst_port || '',
        action: rule.action || 'DROP'
      }];
    } else if (action === 'del_rule' && rule?.id) {
      config.firewall_rules = (config.firewall_rules || []).filter((r: any) => r.id !== rule.id);
    }

    saveConfig(config);
    await applyDhcpAndDnsExtras();
    await reloadRouting();
    await runSudo("systemctl restart dnsmasq || true");
    res.json({ success: true, firewall_rules: config.firewall_rules });
  });

  app.post('/api/config/vpn', requireAdmin, async (req, res) => {
    const { vpn_enabled, vpn_type, vpn_psk } = req.body;
    const config = loadConfig();
    Object.assign(config, { vpn_enabled, vpn_type, vpn_psk });
    saveConfig(config);
    if (vpn_enabled) {
      await runSudo("systemctl start strongswan xl2tpd");
    } else {
      await runSudo("systemctl stop strongswan xl2tpd");
    }
    res.json({ success: true });
  });

  app.post('/api/config/qos', requireAdmin, async (req, res) => {
    const { qos_enabled, qos_download, qos_upload } = req.body;
    const config = loadConfig();
    Object.assign(config, { qos_enabled, qos_download, qos_upload });
    saveConfig(config);
    await applyQoS(qos_enabled, qos_download, qos_upload);
    res.json({ success: true });
  });

  // AI Assistant Chat endpoint
  app.post('/api/ai/chat', requireAdmin, async (req, res) => {
    const { message, history } = req.body;
    const config = loadConfig();
    if (!config.gemini_api_key) {
      return res.status(400).json({ error: 'Gemini APIキーが設定されていません。' });
    }
    
    const ai = new GoogleGenAI({ apiKey: config.gemini_api_key });
    
    // Tools definition
    const tools = [{
      functionDeclarations: [
        {
          name: "get_router_status",
          description: "ルーターの現在のCPU使用率、メモリ、接続デバイス数などのシステム情報を取得します",
          parameters: { type: Type.OBJECT, properties: {} }
        },
        {
          name: "update_setting",
          description: "ルーターの設定を変更します。引数: key(設定キー名), value(新しい値)",
          parameters: {
            type: Type.OBJECT,
            properties: {
              key: { type: Type.STRING, description: "変更する設定キー(例: sta_ssid, wifi_band, ap_ssid)" },
              value: { type: Type.STRING, description: "設定する値" }
            },
            required: ["key", "value"]
          }
        },
        {
          name: "reboot_router",
          description: "ルーターを再起動します",
          parameters: { type: Type.OBJECT, properties: {} }
        }
      ]
    }];

    try {
      const systemInstruction = "あなたはRaspberry Piベースのエンタープライズ業務用ルーターに組み込まれたAIネットワーク管理者です。ユーザーの要望に応じて、機器の状態確認や設定変更を行ってください。";
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [...(history || []), { role: 'user', parts: [{ text: message }] }],
        config: {
          systemInstruction,
          tools
        }
      });
      
      let aiResponseText = "";
      
      if (response.functionCalls && response.functionCalls.length > 0) {
        for (const call of response.functionCalls) {
          if (call.name === 'get_router_status') {
            const sys = await getSysInfo();
            const devs = await getConnectedDevices();
            const status = `CPU: ${sys.cpu_freq || ''} ${sys.temp || ''}, Mem: ${sys.mem}%, 接続数: ${devs.length}台`;
            aiResponseText += `\n[システムステータスを確認しました: ${status}]`;
          } else if (call.name === 'update_setting') {
            const argKey = call.args.key as string;
            const argVal = call.args.value;
            const currentConfig = loadConfig() as any;
            currentConfig[argKey] = argVal === 'true' ? true : (argVal === 'false' ? false : argVal);
            saveConfig(currentConfig);
            aiResponseText += `\n[設定 ${argKey} を ${argVal} に変更しました]`;
          } else if (call.name === 'reboot_router') {
            aiResponseText += `\n[ルーターを再起動します...]`;
            setTimeout(() => runSudo("reboot"), 3000);
          }
        }
        
        // Second pass to explain what happened
        const followUp = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [
            ...(history || []),
            { role: 'user', parts: [{ text: message }] },
            { role: 'model', parts: [{ text: aiResponseText }] },
            { role: 'user', parts: [{ text: 'ユーザーに処理結果を簡潔に報告してください。' }] }
          ]
        });
        aiResponseText += "\n" + followUp.text;
        
      } else {
         aiResponseText = response.text || '';
      }
      
      res.json({ text: aiResponseText });
    } catch (e: any) {
      res.status(500).json({ error: String(e) });
    }
  });

  // Local DNS config endpoint
  app.post('/api/config/dns', requireAdmin, async (req, res) => {
    const { local_dns_enabled, local_dns_name } = req.body;
    const config = loadConfig();
    Object.assign(config, { local_dns_enabled, local_dns_name });
    saveConfig(config);
    // Setup local DNS mapping
    try {
      await applyLocalDns(local_dns_enabled, local_dns_name, config.lan_ip);
      await runSudo("systemctl restart dnsmasq || true");
      res.json({ success: true, message: 'DNS settings updated successfully.' });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'DNS設定の適用に失敗しました。' });
    }
  });

  // Wake on LAN endpoint
  app.post('/api/maintenance/wol', requireAdmin, async (req, res) => {
    const { mac } = req.body;
    if (mac) {
      await runSudo(`etherwake -i wlan0 ${mac}`); // etherwake package usually installed
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'MAC required' });
    }
  });

  // Enterprise additional endpoints
  app.post('/api/config/wg', requireAdmin, async (req, res) => {
    const { wg_enabled, wg_port } = req.body;
    const config = loadConfig();
    Object.assign(config, { wg_enabled, wg_port });
    saveConfig(config);
    if (wg_enabled) {
      await runSudo("systemctl start wg-quick@wg0");
    } else {
      await runSudo("systemctl stop wg-quick@wg0");
    }
    res.json({ success: true });
  });

  app.post('/api/config/syslog', requireAdmin, async (req, res) => {
    const { syslog_server, syslog_port } = req.body;
    const config = loadConfig();
    Object.assign(config, { syslog_server, syslog_port });
    saveConfig(config);
    if (syslog_server) {
      await runSudo(`echo "*.* @${syslog_server}:${syslog_port}" > /tmp/rsyslog-remote.conf`);
      await runSudo("cp /tmp/rsyslog-remote.conf /etc/rsyslog.d/99-remote.conf");
      await runSudo("systemctl restart rsyslog");
    } else {
      await runSudo("rm -f /etc/rsyslog.d/99-remote.conf");
      await runSudo("systemctl restart rsyslog");
    }
    res.json({ success: true });
  });

  app.post('/api/devices/block', requireAdmin, async (req, res) => {
    const { mac } = req.body;
    if (mac) {
      await blockMac(mac);
      res.json({ success: true, message: `Blocked ${mac}` });
    } else {
      res.status(400).json({ error: 'MAC required' });
    }
  });

  app.post('/api/devices/unblock', requireAdmin, async (req, res) => {
    const { mac } = req.body;
    if (mac) {
      await unblockMac(mac);
      res.json({ success: true, message: `Unblocked ${mac}` });
    } else {
      res.status(400).json({ error: 'MAC required' });
    }
  });

  app.post('/api/devices/auth', requireAdmin, async (req, res) => {
    const { mac, ip, authorize } = req.body;
    const authData = loadAuthMacs();
    const now = Date.now();
    if (authorize) {
      if (mac) authData[mac.toLowerCase()] = now;
      if (ip) authData[ip] = now;
    } else {
      if (mac) delete authData[mac.toLowerCase()];
      if (ip) delete authData[ip];
    }
    saveAuthMacs(authData);
    await reloadRouting();
    res.json({ success: true });
  });

  app.post('/api/devices/alias', requireAdmin, (req, res) => {
    const { mac, alias } = req.body;
    if (!mac) return res.status(400).json({ error: 'MAC required' });
    const config = loadConfig();
    config.device_aliases = { ...(config.device_aliases || {}), [mac.toLowerCase()]: alias || '' };
    saveConfig(config);
    res.json({ success: true });
  });

  app.post('/api/system/reboot', requireAdmin, async (req, res) => {
    res.json({ success: true, message: 'Rebooting...' });
    setTimeout(() => runSudo("reboot"), 1000);
  });

  app.post('/api/system/initialize', requireAdmin, async (req, res) => {
    res.json({ success: true, message: 'Initializing...' });
    setTimeout(() => {
        saveConfig({}); // reset config
        runSudo("reboot");
    }, 1000);
  });

  app.post('/api/diag/ping', requireAdmin, async (req, res) => {
    const { host } = req.body;
    if (!host) return res.status(400).json({error: 'Host required'});
    const output = await runPing(host);
    res.json({ output });
  });

  app.post('/api/diag/traceroute', requireAdmin, async (req, res) => {
    const { host } = req.body;
    if (!host) return res.status(400).json({ error: 'Host required' });
    const output = await runTraceroute(host);
    res.json({ output });
  });

  app.post('/api/diag/nslookup', requireAdmin, async (req, res) => {
    const { host } = req.body;
    if (!host) return res.status(400).json({ error: 'Host required' });
    const output = await runDnsLookup(host);
    res.json({ output });
  });

  app.get('/api/diag/tables', requireAdmin, async (req, res) => {
    const tables = await getKernelNetworkTables();
    res.json(tables);
  });

  app.post('/api/system/password', requireAdmin, (req, res) => {
    const { new_password } = req.body;
    if (!new_password || String(new_password).trim().length < 3) {
      return res.status(400).json({ error: 'パスワードは3文字以上で指定してください。' });
    }
    const config = loadConfig();
    config.admin_password = String(new_password).trim();
    saveConfig(config);
    res.cookie('admin_token', config.admin_password, { httpOnly: true, maxAge: 86400000 });
    res.json({ success: true });
  });

  app.post('/api/system/restore', requireAdmin, async (req, res) => {
    const { config: importedConfig } = req.body;
    if (!importedConfig || typeof importedConfig !== 'object') {
      return res.status(400).json({ error: '不正な設定ファイルです。' });
    }
    const current = loadConfig();
    const merged = { ...current, ...importedConfig };
    saveConfig(merged);
    await applyDhcpAndDnsExtras();
    await reloadRouting();
    res.json({ success: true });
  });

  app.get('/api/system/logs', requireAdmin, async (req, res) => {
    const syslog = await runSudo('tail -n 30 /var/log/syslog');
    res.json({ syslog });
  });

  app.get('/api/cli/logs', requireAdmin, (req, res) => {
    res.json({ logs: getCmdLogs() });
  });

  app.post('/api/cli/exec', requireAdmin, async (req, res) => {
    const { command } = req.body;
    if (!command) return res.status(400).json({ error: 'Command required' });
    const output = await runSudo(command.replace(/^sudo\s+/, ''));
    res.json({ output, logs: getCmdLogs() });
  });

  app.post('/api/system/service', requireAdmin, async (req, res) => {
    const { service } = req.body;
    await runSudo(`systemctl restart ${service}`);
    res.json({ success: true });
  });
  
  app.get('/api/portal/html', requireAdmin, (req, res) => {
    try {
      const html = fs.readFileSync(PORTAL_FILE, 'utf-8');
      res.send(html);
    } catch (e) {
      res.status(404).send('Portal file not found');
    }
  });

  app.post('/api/portal/html', requireAdmin, (req, res) => {
    try {
      fs.writeFileSync(PORTAL_FILE, req.body.html || '');
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Failed to save' });
    }
  });

  app.post('/api/portal/reset', requireAdmin, async (req, res) => {
    try {
      saveAuthMacs({});
      await reloadRouting();
      res.json({ success: true, message: 'All portal sessions have been cleared.' });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Failed to clear sessions' });
    }
  });

  // Network traffic stats monitoring endpoint
  app.get('/api/monitor/stats', requireAdmin, async (req, res) => {
    try {
      const stats = await getNetworkMonitorStats();
      res.json(stats);
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Failed to fetch network traffic stats.' });
    }
  });

  // DNS query log streaming endpoint
  app.get('/api/monitor/dns-logs', requireAdmin, async (req, res) => {
    try {
      const logs = await getDnsQueryLogs();
      res.json({ logs });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Failed to fetch DNS query logs.' });
    }
  });

  // Portal Connect Endpoint with support for No-CAPTCHA (default), Passcode, or optional reCAPTCHA/hCaptcha
  app.post('/api/portal/connect', async (req, res) => {
    const config = loadConfig();
    const provider = config.captcha_provider || 'none';
    const ip = req.ip || req.socket.remoteAddress || "";
    const cleanIp = ip.replace(/^.*:/, '').trim();
    const wantsJson = req.body?.json === true || (req.headers.accept || '').includes('application/json');

    // 1. Passcode check if provider === 'passcode'
    if (provider === 'passcode') {
      const submittedPasscode = (req.body?.passcode || '').trim();
      const expectedPasscode = (config.portal_passcode || '1234').trim();
      if (submittedPasscode !== expectedPasscode) {
        if (wantsJson) {
          return res.status(401).json({ success: false, message: 'ゲストパスコードが一致しません。' });
        }
        return res.send("<div style='text-align:center; margin-top:50px; color:#b91c1c; font-family:sans-serif;'><h3>パスコードが正しくありません。</h3><p>正しいゲストパスコードを入力してください。</p><p><a href='/portal' style='color:#005b9f;'>ポータル画面へ戻る</a></p></div>");
      }
    }

    // 2. External Captcha check ONLY if provider is 'recaptcha' or 'hcaptcha'
    if (provider === 'recaptcha' || provider === 'hcaptcha') {
      const isRecaptcha = provider === 'recaptcha';
      const token = req.body['g-recaptcha-response'] || req.body['h-captcha-response'] || req.body['token'];
      const testSecret = isRecaptcha ? "6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe" : "0x0000000000000000000000000000000000000000";
      const secret = (config.captcha_secret_key && !config.captcha_secret_key.startsWith('dummy_')) 
        ? config.captcha_secret_key 
        : testSecret;

      if (token && token !== 'test_token_bypass') {
        try {
          const params = new URLSearchParams();
          params.append('secret', secret);
          params.append('response', token);
          params.append('remoteip', cleanIp);
          
          const verifyUrl = isRecaptcha ? 'https://www.google.com/recaptcha/api/siteverify' : 'https://api.hcaptcha.com/siteverify';
          const verifyRes = await fetch(verifyUrl, {
            method: 'POST',
            body: params
          });
          const verifyData: any = await verifyRes.json();
          if (!verifyData.success && config.captcha_secret_key) {
            if (wantsJson) {
              return res.status(401).json({ success: false, message: 'CAPTCHA認証に失敗しました。' });
            }
            res.send("<div style='text-align:center; margin-top:50px; color:red; font-family:sans-serif;'><h3>セキュリティ認証に失敗しました。</h3><p>もう一度お試しください。</p><p><a href='/portal'>戻る</a></p></div>");
            return;
          }
        } catch (e) {
          console.warn("Captcha verification API offline or unreachable, continuing in fallback mode:", e);
        }
      }
    }

    // Resolve client identifier (both MAC and IP to guarantee bypass)
    const mac = await getMacFromIp(ip);
    const authData = loadAuthMacs();
    const now = Date.now();

    if (mac) {
      authData[mac] = now;
    }
    if (cleanIp && cleanIp !== '127.0.0.1') {
      authData[cleanIp] = now;
    }
    saveAuthMacs(authData);
    
    // Apply firewall bypass rules immediately
    await reloadRouting();

    if (wantsJson) {
      return res.json({ success: true, mac, ip: cleanIp });
    }
    
    const ua = req.headers['user-agent'] || "";
    const isSwitch = /Nintendo Switch|NintendoBrowser/i.test(ua);
    const isApple = /iPhone|iPad|iPod|Macintosh.*CaptiveNetworkSupport/i.test(ua);
    const isWindows = /Windows NT/i.test(ua);

    let redirectTarget = 'http://connectivitycheck.gstatic.com/generate_204';
    let deviceName = '端末';
    if (isSwitch) {
      redirectTarget = 'http://conntest.nintendowifi.net/';
      deviceName = 'Nintendo Switch';
    } else if (isApple) {
      redirectTarget = 'http://captive.apple.com/hotspot-detect.html';
      deviceName = 'Appleデバイス';
    } else if (isWindows) {
      redirectTarget = 'http://www.msftconnecttest.com/connecttest.txt';
      deviceName = 'Windows PC';
    }
    
    res.send(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="refresh" content="2;url=${redirectTarget}">
      <title>接続完了 / Connected</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          background-color: #f7fafc;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
          color: #2d3748;
          padding: 1rem;
          box-sizing: border-box;
        }
        .card {
          background: white;
          padding: 2.5rem 2rem;
          border-radius: 16px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          text-align: center;
          max-width: 440px;
          width: 100%;
        }
        .checkmark-container {
          width: 72px;
          height: 72px;
          background-color: #def7ec;
          color: #03543f;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1.5rem;
        }
        .checkmark {
          width: 36px;
          height: 36px;
          stroke-width: 3;
          stroke: currentColor;
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        h2 {
          margin: 0 0 0.5rem 0;
          color: #03543f;
          font-size: 1.5rem;
          font-weight: 700;
        }
        p {
          color: #4a5568;
          font-size: 0.95rem;
          line-height: 1.5;
          margin: 0 0 1.25rem 0;
        }
        .status {
          font-size: 0.8rem;
          color: #718096;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          margin-bottom: 1.5rem;
        }
        .btn-complete {
          display: inline-block;
          background-color: #047857;
          color: #ffffff !important;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          font-weight: 600;
          font-size: 0.95rem;
          text-decoration: none;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          transition: background-color 0.2s;
        }
        .btn-complete:hover {
          background-color: #065f46;
        }
        .loader {
          border: 2px solid #e2e8f0;
          border-top: 2px solid #047857;
          border-radius: 50%;
          width: 18px;
          height: 18px;
          animation: spin 1s linear infinite;
          margin: 0 auto 0.5rem;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="checkmark-container">
          <svg class="checkmark" viewBox="0 0 24 24">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <h2>接続完了 / Connected</h2>
        <p>インターネットのご利用が可能になりました。<br>${deviceName}の接続チェック画面へ自動で遷移します。</p>
        
        <div class="status">
          <div class="loader"></div>
          <div>OS接続シグナル同期中...</div>
        </div>

        <div>
          <a href="${redirectTarget}" class="btn-complete" id="complete-link">
            接続確認・完了 (Finish)
          </a>
        </div>
      </div>

      <script>
        const probes = [
          'http://conntest.nintendowifi.net/',
          'http://connectivitycheck.gstatic.com/generate_204',
          'http://connectivitycheck.android.com/generate_204',
          'http://clients3.google.com/generate_204',
          'http://captive.apple.com/hotspot-detect.html',
          'http://www.apple.com/library/test/success.html',
          'http://www.msftconnecttest.com/connecttest.txt',
          'http://www.msftncsi.com/ncsi.txt'
        ];

        probes.forEach(url => {
          fetch(url, { mode: 'no-cors', cache: 'no-store' })
            .catch(() => {
              const img = new Image();
              img.src = url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();
            });
        });

        setTimeout(() => {
          window.location.href = '${redirectTarget}';
        }, 1800);
      </script>
    </body>
    </html>
    `);
  });

  // Serve portal directly (No reCAPTCHA by default; supports 'none', 'passcode', or optional 'recaptcha'/'hcaptcha')
  app.get('/portal', (req, res) => {
    try {
      let html = fs.readFileSync(PORTAL_FILE, 'utf-8');
      const config = loadConfig();
      const provider = config.captcha_provider || 'none';
      const ssid = config.ap_ssid || 'Free_WiFi_Pi';

      html = html.replace(/Free_WiFi_Pi/g, ssid);

      if (provider === 'passcode') {
        const passcodeScript = `
        <script>
          window.addEventListener('DOMContentLoaded', function() {
            var sec = document.getElementById('passcode-section');
            var inp = document.getElementById('passcode-input');
            if (sec) sec.style.display = 'block';
            if (inp) inp.required = true;
          });
        </script>
        `;
        html = html.replace('</body>', `${passcodeScript}</body>`);
      } else if (provider === 'recaptcha' || provider === 'hcaptcha') {
        const isRe = provider === 'recaptcha';
        const defaultSiteKey = isRe ? "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI" : "10000000-ffff-ffff-ffff-000000000001";
        const sitekey = (config.captcha_site_key && !config.captcha_site_key.startsWith('dummy_')) ? config.captcha_site_key : defaultSiteKey;
        const scriptUrl = isRe 
          ? `https://www.recaptcha.net/recaptcha/api.js` 
          : `https://js.hcaptcha.com/1/api.js`;
        const widgetClass = isRe ? 'g-recaptcha' : 'h-captcha';
        const captchaInject = `
        <script src="${scriptUrl}" async defer></script>
        <script>
          window.addEventListener('DOMContentLoaded', function() {
            var btn = document.getElementById('connect-btn');
            if (btn) {
              var container = document.createElement('div');
              container.style.cssText = 'display:flex;justify-content:center;margin-bottom:16px;';
              container.innerHTML = '<div class="${widgetClass}" data-sitekey="${sitekey}"></div>';
              btn.parentNode.insertBefore(container, btn);
            }
          });
        </script>
        `;
        html = html.replace('</body>', `${captchaInject}</body>`);
      }

      res.send(html);
    } catch (e) {
      res.status(404).send('Portal file not found');
    }
  });

  // --- Captive Portal Connectivity Check Handlers (Nintendo Switch, Apple, Android, Windows) ---
  const sendPortalRedirect = (res: express.Response, lanIp: string) => {
    const portalUrl = `http://${lanIp}:3000/portal`;
    res.status(302);
    res.setHeader('Location', portalUrl);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    return res.send(`<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="refresh" content="0;url=${portalUrl}">
  <title>Redirecting to login portal</title>
</head>
<body onload="window.location.replace('${portalUrl}')">
  <p>ネットワークに接続するにはログインが必要です。<a href="${portalUrl}">こちらをクリック</a>してください。</p>
</body>
</html>`);
  };

  const handleConnectivityCheck = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const hostHeader = (req.headers.host || "").toLowerCase();
    const p = req.path;
    const ip = req.ip || req.socket.remoteAddress || "";
    const cleanIp = ip.replace(/^.*:/, '').trim();
    let isAuthed = false;

    try {
      const authData = loadAuthMacs();
      if (cleanIp && authData[cleanIp]) {
        isAuthed = true;
      } else {
        const mac = await getMacFromIp(ip);
        if (mac && authData[mac]) {
          isAuthed = true;
        }
      }
    } catch (e) {}

    const config = loadConfig();
    const lanIp = config.lan_ip || "192.168.4.1";

    // 1. Nintendo Switch check (conntest.nintendowifi.net or ctest.cdn.nintendo.net)
    if (hostHeader.includes('nintendowifi.net') || hostHeader.includes('nintendo.net')) {
      if (isAuthed) {
        res.setHeader('X-Organization', 'Nintendo');
        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(`<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html>
<head>
<title>HTML Page</title>
</head>
<body bgcolor="#FFFFFF">
ok
</body>
</html>`);
      }
      return sendPortalRedirect(res, lanIp);
    }

    // 2. Android / Google 204 check
    if (p.includes('/generate_204') || hostHeader.includes('connectivitycheck.gstatic.com') || hostHeader.includes('connectivitycheck.android.com') || hostHeader.includes('clients3.google.com')) {
      if (isAuthed) {
        return res.status(204).end();
      }
      return sendPortalRedirect(res, lanIp);
    }

    // 3. Apple Hotspot Detect (captive.apple.com / hotspot-detect.html)
    if (p.includes('/hotspot-detect.html') || hostHeader.includes('captive.apple.com') || hostHeader.includes('thinkdifferent.us') || hostHeader.includes('ibook.info')) {
      if (isAuthed) {
        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send('<HTML><HEAD><TITLE>Success</TITLE></HEAD><BODY>Success</BODY></HTML>');
      }
      return sendPortalRedirect(res, lanIp);
    }

    // 4. Windows NCSI check (msftconnecttest.com, msftncsi.com)
    if (p.includes('/connecttest.txt') || p.includes('/ncsi.txt') || hostHeader.includes('msftconnecttest.com') || hostHeader.includes('msftncsi.com')) {
      if (isAuthed) {
        res.setHeader('Content-Type', 'text/plain');
        return res.status(200).send('Microsoft Connect Test');
      }
      return sendPortalRedirect(res, lanIp);
    }

    next();
  };

  app.use(handleConnectivityCheck);

  // --- Captive Portal Redirection Middleware ---
  app.use(async (req, res, next) => {
    const p = req.path;
    // Do not intercept captive portal assets, /login (pifi.me/login), direct requests, or config APIs
    if (
      p === '/login' ||
      p.startsWith('/login/') ||
      p.startsWith('/portal') || 
      p.startsWith('/api/portal') || 
      p.startsWith('/api/config') ||
      p.startsWith('/api/auth') || // Allow login checks
      /\.(js|css|png|jpg|jpeg|gif|ico|svg|json|woff2?|ttf|map)$/i.test(p) // Skip static assets
    ) {
      return next();
    }

    const config = loadConfig();
    if (config.wifi_mode !== 'AP' || config.portal_enabled === false) {
      return next();
    }

    // Identify if the request came from wlan0 interface subnet
    const ip = req.ip || req.socket.remoteAddress || "";
    const cleanIp = ip.replace(/^.*:/, '').trim();
    const lanIp = config.lan_ip || "192.168.4.1";

    const hostHeader = (req.headers.host || "").toLowerCase();
    const hostName = hostHeader.split(':')[0];
    const localDnsName = (config.local_dns_enabled && config.local_dns_name) ? config.local_dns_name.toLowerCase().trim() : "";

    // If the user is explicitly accessing the router's IP, localhost, or configured local DNS name (e.g. pifi.me), allow dashboard
    const isLocalAccess = 
      hostName === lanIp || 
      hostName === 'localhost' || 
      hostName === '127.0.0.1' ||
      (localDnsName && (
        hostName === localDnsName || 
        hostName === `www.${localDnsName}` || 
        hostName.endsWith(`.${localDnsName}`)
      ));

    // Check if client is already authenticated (via IP or MAC)
    let isAuthed = false;
    try {
      const authData = loadAuthMacs();
      if (cleanIp && authData[cleanIp]) {
        isAuthed = true;
      } else {
        const mac = await getMacFromIp(ip);
        if (mac && authData[mac]) {
          isAuthed = true;
        }
      }
    } catch (e) {}

    if (isAuthed || isLocalAccess) {
      return next();
    }

    // Client is unauthenticated and attempting external or intercepted access
    return sendPortalRedirect(res, lanIp);
  });

  // Bypass Vite 6 host validation by rewriting the Host header for all incoming requests reaching the SPA
  app.use((req, res, next) => {
    req.headers.host = 'localhost';
    next();
  });

  // --- Vite Middleware or Static Files ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Apply initial QoS on startup
  const initConfig = loadConfig();
  applyQoS(initConfig.qos_enabled, initConfig.qos_download, initConfig.qos_upload).catch(console.error);
  
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Attempt to also listen on port 80 directly if running with sufficient privileges
  try {
    const port80Server = app.listen(80, "0.0.0.0", () => {
      console.log(`Port 80 listener active for local domains (e.g. http://pifi.me)`);
    });
    port80Server.on('error', () => {
      // Port 80 binding error (e.g. non-root or already bound) is safely ignored because iptables redirects port 80 to PORT
    });
  } catch (e) {}
}

startServer();
