import express from 'express';
import path from 'path';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { 
  getSysInfo, getConnectedDevices, loadConfig, saveConfig, 
  setWifiMode, setupWifiAP, blockMac, reloadRouting, runSudo, PORTAL_FILE, getMacFromIp,
  loadAuthMacs, saveAuthMacs, addPortForward, runPing, getCmdLogs,
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
    const { src_port, dest_ip, dest_port } = req.body;
    const success = await addPortForward(src_port, dest_ip, dest_port);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Failed to add port forwarding' });
    }
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
    const { lan_ip, subnet_mask, dhcp_enabled, dhcp_start, dhcp_end, lease_time } = req.body;
    const config = loadConfig();
    Object.assign(config, { lan_ip, subnet_mask, dhcp_enabled, dhcp_start, dhcp_end, lease_time });
    saveConfig(config);
    
    try {
      if (config.wifi_mode === 'AP') {
        // Full rebuild of AP settings to prevent outdated IP configuration/conflicts
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
  
  app.post('/api/config/nas', requireAdmin, async (req, res) => {
    const { nas_enabled, nas_share_name, nas_workgroup } = req.body;
    const config = loadConfig();
    Object.assign(config, { nas_enabled, nas_share_name, nas_workgroup });
    saveConfig(config);
    if (nas_enabled) {
      await runSudo("systemctl restart smbd");
    } else {
      await runSudo("systemctl stop smbd");
    }
    res.json({ success: true });
  });

  app.post('/api/config/qos', requireAdmin, async (req, res) => {
    const { qos_enabled, qos_download, qos_upload } = req.body;
    const config = loadConfig();
    Object.assign(config, { qos_enabled, qos_download, qos_upload });
    saveConfig(config);
    // In real deployment, this would use `tc` to shape traffic on eth0/wlan0
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
              key: { type: Type.STRING, description: "変更する設定キー(例: sta_ssid, wifi_band, nas_enabled)" },
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
      if (local_dns_enabled && local_dns_name) {
        const lanIp = config.lan_ip || "192.168.4.1";
        await runSudo(`bash -c 'echo "address=/${local_dns_name}/${lanIp}" > /etc/dnsmasq.d/router_local.conf'`);
      } else {
        await runSudo(`rm -f /etc/dnsmasq.d/router_local.conf`);
      }
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

  // Portal Connect Endpoint with real hCaptcha / reCAPTCHA check
  app.post('/api/portal/connect', async (req, res) => {
    const config = loadConfig();
    const isRecaptcha = config.captcha_provider === 'recaptcha';
    const token = isRecaptcha ? req.body['g-recaptcha-response'] : req.body['h-captcha-response'];
    const ip = req.ip || req.socket.remoteAddress || "";
    
    if (!token && !config.captcha_invisible) {
      res.send("<div style='text-align:center; margin-top:50px; color:red;'>Security token missing.</div>");
      return;
    }
    
    const secret = config.captcha_secret_key || (isRecaptcha ? "dummy_recaptcha_secret" : "ES_65f0035706614137b523ff4ef5e8b171");
    const sitekey = config.captcha_site_key || (isRecaptcha ? "dummy_recaptcha_site" : "8dfae658-fe9c-4506-a682-71f07d4ce88a");
    
    if (token) {
      try {
        const params = new URLSearchParams();
        params.append('secret', secret);
        params.append('response', token);
        params.append('remoteip', ip);
        
        const verifyUrl = isRecaptcha ? 'https://www.google.com/recaptcha/api/siteverify' : 'https://api.hcaptcha.com/siteverify';
        const verifyRes = await fetch(verifyUrl, {
          method: 'POST',
          body: params
        });
        const verifyData: any = await verifyRes.json();
        if (!verifyData.success) {
           res.send("<div style='text-align:center; margin-top:50px; color:red;'>認証に失敗しました。</div>");
           return;
        }
      } catch (e) {
        res.send(`<div style='text-align:center; margin-top:50px; color:red;'>API通信エラー<br>${String(e)}</div>`);
        return;
      }
    }

    const mac = await getMacFromIp(ip) || "00:11:22:33:44:test";
    
    const authData = loadAuthMacs();
    authData[mac] = Date.now();
    saveAuthMacs(authData);
    
    const insertPos = config.adblock_enabled ? "3" : "1";
    await runSudo(`iptables -t nat -I PREROUTING ${insertPos} -m mac --mac-source ${mac} -j RETURN`);
    await runSudo(`iptables -I FORWARD 1 -m mac --mac-source ${mac} -j ACCEPT`);
    
    res.send(`
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>接続完了 / Connected</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          background-color: #f7fafc;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          margin: 0;
          color: #2d3748;
        }
        .card {
          background: white;
          padding: 2.5rem;
          border-radius: 16px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          text-align: center;
          max-width: 420px;
          width: 90%;
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
          margin: 0 0 1.5rem 0;
        }
        .status {
          font-size: 0.75rem;
          color: #718096;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .loader {
          border: 2px stroke #e2e8f0;
          border-top: 2px solid #3182ce;
          border-radius: 50%;
          width: 16px;
          height: 16px;
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
        <p>インターネットのご利用が可能になりました。<br>自動的にネットワークに接続を確立しています...</p>
        
        <div class="status">
          <div class="loader"></div>
          <div>Wi-Fi接続チェックを同期中...</div>
        </div>
      </div>

      <script>
        // Multiple OS probe URLs to clear the exclamation mark on all devices (Google, Apple, Microsoft)
        const probes = [
          'http://connectivitycheck.gstatic.com/generate_204',
          'http://connectivitycheck.android.com/generate_204',
          'http://clients3.google.com/generate_204',
          'http://captive.apple.com/hotspot-detect.html',
          'http://www.apple.com/library/test/success.html',
          'http://www.msftconnecttest.com/connecttest.txt',
          'http://www.msftncsi.com/ncsi.txt'
        ];

        // Perform parallel fetching/pinging of all connectivity endpoints to verify state
        probes.forEach(url => {
          fetch(url, { mode: 'no-cors', cache: 'no-store' })
            .then(() => console.log('Probed: ' + url))
            .catch(() => {
              // fallback with image request
              const img = new Image();
              img.src = url + '?t=' + Date.now();
            });
        });

        // Automatically close portal or redirect after 2 seconds
        setTimeout(() => {
          window.location.href = 'http://connectivitycheck.gstatic.com/generate_204';
        }, 2000);
      </script>
    </body>
    </html>
    `);
  });

  // Serve portal directly
  app.get('/portal', (req, res) => {
    try {
      let html = fs.readFileSync(PORTAL_FILE, 'utf-8');
      const config = loadConfig();
      const isRe = config.captcha_provider === 'recaptcha';
      const sitekey = config.captcha_site_key || (isRe ? "dummy_recaptcha_site" : "8dfae658-fe9c-4506-a682-71f07d4ce88a");
      const scriptUrl = isRe ? `https://www.google.com/recaptcha/api.js` : `https://js.hcaptcha.com/1/api.js`;
      const divClass = isRe ? `g-recaptcha` : `h-captcha`;
      
      if (config.captcha_invisible) {
        // Inject invisible captcha handling if enabled
        const actionPrefix = isRe ? `data-action="connect"` : ``;
        
        const autoForm = `
        <form id="auto-captcha-form" action="/api/portal/connect" method="POST">
          <div class="${divClass}" data-sitekey="${sitekey}" data-callback="onSubmit" data-size="invisible" ${actionPrefix}></div>
        </form>
        <script src="${scriptUrl}" async defer></script>
        <script>
          function onSubmit(token) {
            document.getElementById("auto-captcha-form").submit();
          }
          window.onload = function() {
             var btns = document.querySelectorAll("button");
             if(btns.length > 0) {
               btns[0].onclick = function(e) {
                 e.preventDefault();
                 ${isRe ? `grecaptcha.execute();` : `hcaptcha.execute();`}
               };
             } else {
               // Auto execute if no button
               ${isRe ? `grecaptcha.execute();` : `hcaptcha.execute();`}
             }
          }
        </script>
        `;
        html = html.replace('</body>', `${autoForm}</body>`);
      } else {
        // Dynamic substitution for standard visible captcha
        // 1. Replace hCaptcha library script with selected provider script
        html = html.replace('https://js.hcaptcha.com/1/api.js', scriptUrl);
        
        // 2. Replace h-captcha widget class, data-sitekey, and data-callback
        html = html.replace(
          'class="h-captcha" data-sitekey="8dfae658-fe9c-4506-a682-71f07d4ce88a" data-callback="onHcaptchaSuccess"',
          `class="${divClass}" data-sitekey="${sitekey}" data-callback="onCaptchaSuccess"`
        );

        // 3. Set up JavaScript bridge for the unified onCaptchaSuccess callback
        const bridgeJs = `
        <script>
          function onCaptchaSuccess(token) {
            onHcaptchaSuccess(token);
          }
        </script>
        `;
        html = html.replace('</head>', `${bridgeJs}</head>`);

        // 4. Update form inputs to use correct POST parameters
        if (isRe) {
          html = html.replace('name="h-captcha-response"', 'name="g-recaptcha-response"');
        }
      }
      
      res.send(html);
    } catch (e) {
      res.status(404).send('Portal file not found');
    }
  });

  // --- Captive Portal Redirection Middleware ---
  app.use(async (req, res, next) => {
    const p = req.path;
    // Do not intercept captive portal assets, direct requests, or config APIs
    if (
      p.startsWith('/portal') || 
      p.startsWith('/api/portal') || 
      p.startsWith('/api/config') ||
      p.startsWith('/api/auth') || // Allow login checks
      /\.(js|css|png|jpg|jpeg|gif|ico|svg|json|woff2?|ttf|map)$/i.test(p) // Skip static assets but NOT captive portal HTML/TXT checks
    ) {
      return next();
    }

    const config = loadConfig();
    if (config.wifi_mode !== 'AP') {
      return next();
    }

    // Identify if the request came from wlan0 interface subnet
    const ip = req.ip || req.socket.remoteAddress || "";
    const lanIp = config.lan_ip || "192.168.4.1";
    const lanSubnet = lanIp.substring(0, lanIp.lastIndexOf('.')); // e.g., "192.168.4"

    // If request is from our AP subnet and not the router itself
    if (ip.includes(lanSubnet) && !ip.includes('127.0.0.1') && ip !== lanIp) {
      try {
        const mac = await getMacFromIp(ip);
        if (mac) {
          const authData = loadAuthMacs();
          // Redirect unauthenticated clients to Captive Portal page
          if (!authData[mac]) {
            return res.redirect(`http://${lanIp}:3000/portal`);
          }
        } else {
          // If MAC is not found yet, redirect to portal to trigger authentication
          return res.redirect(`http://${lanIp}:3000/portal`);
        }
      } catch (e) {
        console.error("Captive portal redirection error:", e);
      }
    }

    next();
  });

  // --- Vite Middleware or Static Files ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
