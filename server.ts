import express from 'express';
import path from 'path';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { 
  getSysInfo, getConnectedDevices, loadConfig, saveConfig, 
  setWifiMode, setupWifiAP, blockMac, reloadRouting, runSudo, PORTAL_FILE, getMacFromIp,
  loadAuthMacs, saveAuthMacs, addPortForward, applyQoS, applyLocalDns, runPing, getCmdLogs,
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
    
    // Refresh iptables rules safely instead of a fragile positional insert
    await reloadRouting();
    
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

  // Serve portal directly
  app.get('/portal', (req, res) => {
    try {
      let html = fs.readFileSync(PORTAL_FILE, 'utf-8');
      const config = loadConfig();
      const isRe = config.captcha_provider === 'recaptcha';
      const sitekey = config.captcha_site_key || (isRe ? "dummy_recaptcha_site" : "8dfae658-fe9c-4506-a682-71f07d4ce88a");
      // Use official global mirror recaptcha.net for bulletproof loading on game consoles (Switch/Switch 2) & restricted nets
      const scriptUrl = isRe 
        ? `https://www.recaptcha.net/recaptcha/api.js?onload=onRecaptchaLoaded&render=explicit` 
        : `https://js.hcaptcha.com/1/api.js?onload=onHcaptchaLoaded&render=explicit`;
      
      if (config.captcha_invisible) {
        // Inject invisible captcha handling if enabled
        const actionPrefix = isRe ? `data-action="connect"` : ``;
        const divClass = isRe ? `g-recaptcha` : `h-captcha`;
        
        // Remove the original captcha widget
        html = html.replace(
          '<div class="h-captcha" data-sitekey="8dfae658-fe9c-4506-a682-71f07d4ce88a" data-callback="onHcaptchaSuccess"></div>',
          ''
        );
        html = html.replace('<script src="https://js.hcaptcha.com/1/api.js" async defer></script>', '');
        
        const autoForm = `
        <form id="auto-captcha-form" action="/api/portal/connect" method="POST" style="display:none;">
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
               ${isRe ? `grecaptcha.execute();` : `hcaptcha.execute();`}
             }
          }
        </script>
        `;
        html = html.replace('</body>', `${autoForm}</body>`);
      } else {
        // Dynamic substitution for standard visible captcha with explicit render & fallback
        // 1. Replace original script tag with explicit loader
        html = html.replace('<script src="https://js.hcaptcha.com/1/api.js" async defer></script>', `<script src="${scriptUrl}" async defer></script>`);
        
        // 2. Set up JavaScript bridge for explicit rendering and fast loading
        const bridgeJs = `
        <script>
          var captchaWidgetId = null;
          function hideCaptchaLoading() {
            var loader = document.getElementById('captcha-loading-indicator');
            if (loader) loader.style.display = 'none';
          }
          function onCaptchaSuccess(token) {
            onHcaptchaSuccess(token);
          }
          function renderCaptchaWidget() {
            var target = document.getElementById('captcha-render-target');
            if (!target) return;
            if (captchaWidgetId !== null) return;
            try {
              if (${isRe} && typeof grecaptcha !== 'undefined' && grecaptcha.render) {
                target.innerHTML = '';
                captchaWidgetId = grecaptcha.render(target, {
                  sitekey: '${sitekey}',
                  callback: onCaptchaSuccess
                });
                hideCaptchaLoading();
              } else if (!${isRe} && typeof hcaptcha !== 'undefined' && hcaptcha.render) {
                target.innerHTML = '';
                captchaWidgetId = hcaptcha.render(target, {
                  sitekey: '${sitekey}',
                  callback: onCaptchaSuccess
                });
                hideCaptchaLoading();
              }
            } catch(e) {
              console.error("Captcha render error:", e);
            }
          }
          window.onRecaptchaLoaded = function() {
            renderCaptchaWidget();
          };
          window.onHcaptchaLoaded = function() {
            renderCaptchaWidget();
          };
          window.onModalOpen = function() {
            renderCaptchaWidget();
          };
          // Fallback timer in case onload fired early
          setTimeout(function() {
            renderCaptchaWidget();
          }, 1000);
        </script>
        `;
        html = html.replace('</head>', `${bridgeJs}</head>`);

        // 3. Update form inputs to use correct POST parameters
        if (isRe) {
          html = html.replace('name="h-captcha-response"', 'name="g-recaptcha-response"');
        }
      }
      
      res.send(html);
    } catch (e) {
      res.status(404).send('Portal file not found');
    }
  });

  // --- Captive Portal Connectivity Check Handlers (Nintendo Switch, Apple, Android, Windows) ---
  const handleConnectivityCheck = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const hostHeader = (req.headers.host || "").toLowerCase();
    const p = req.path;
    const ip = req.ip || req.socket.remoteAddress || "";
    let isAuthed = false;

    try {
      const mac = await getMacFromIp(ip);
      if (mac) {
        const authData = loadAuthMacs();
        isAuthed = !!authData[mac];
      }
    } catch (e) {}

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
      const config = loadConfig();
      const lanIp = config.lan_ip || "192.168.4.1";
      return res.redirect(`http://${lanIp}:3000/portal`);
    }

    // 2. Android / Google 204 check
    if (p.includes('/generate_204') || hostHeader.includes('connectivitycheck.gstatic.com') || hostHeader.includes('connectivitycheck.android.com') || hostHeader.includes('clients3.google.com')) {
      if (isAuthed) {
        return res.status(204).end();
      }
      const config = loadConfig();
      const lanIp = config.lan_ip || "192.168.4.1";
      return res.redirect(`http://${lanIp}:3000/portal`);
    }

    // 3. Apple Hotspot Detect (captive.apple.com / hotspot-detect.html)
    if (p.includes('/hotspot-detect.html') || hostHeader.includes('captive.apple.com') || hostHeader.includes('thinkdifferent.us') || hostHeader.includes('ibook.info')) {
      if (isAuthed) {
        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send('<HTML><HEAD><TITLE>Success</TITLE></HEAD><BODY>Success</BODY></HTML>');
      }
      const config = loadConfig();
      const lanIp = config.lan_ip || "192.168.4.1";
      return res.redirect(`http://${lanIp}:3000/portal`);
    }

    // 4. Windows NCSI check (msftconnecttest.com, msftncsi.com)
    if (p.includes('/connecttest.txt') || p.includes('/ncsi.txt') || hostHeader.includes('msftconnecttest.com') || hostHeader.includes('msftncsi.com')) {
      if (isAuthed) {
        res.setHeader('Content-Type', 'text/plain');
        return res.status(200).send('Microsoft Connect Test');
      }
      const config = loadConfig();
      const lanIp = config.lan_ip || "192.168.4.1";
      return res.redirect(`http://${lanIp}:3000/portal`);
    }

    next();
  };

  app.use(handleConnectivityCheck);

  // --- Captive Portal Redirection Middleware ---
  app.use(async (req, res, next) => {
    const p = req.path;
    // Do not intercept captive portal assets, direct requests, or config APIs
    if (
      p.startsWith('/portal') || 
      p.startsWith('/api/portal') || 
      p.startsWith('/api/config') ||
      p.startsWith('/api/auth') || // Allow login checks
      /\.(js|css|png|jpg|jpeg|gif|ico|svg|json|woff2?|ttf|map)$/i.test(p) // Skip static assets
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

    if (isLocalAccess) {
      return next();
    }

    // If the Host header is an external domain, iptables intercepted the request because client is unauthenticated
    if (!isLocalAccess) {
       return res.redirect(`http://${lanIp}:3000/portal`);
    }

    // Fallback: If request is from our AP subnet and not the router itself
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
