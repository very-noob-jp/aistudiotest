export interface SysInfo {
  temp: string;
  mem: string;
  disk: string;
  uptime: string;
  wifi_active: boolean;
  wan_if: string;
  config_mode: string;
  time: string;
  cpu_freq?: string;
}

export interface ConnectedDevice {
  ip: string;
  mac: string;
  dev: string;
  traffic: number;
}

export interface StaticRoute {
  id: string;
  dest: string;
  gateway: string;
  metric: string;
}

export interface RouterConfig {
  strict_ip_binding: boolean;
  adblock_enabled: boolean;
  admin_password?: string;
  wifi_mode: 'AP' | 'STA';
  sta_ssid?: string;
  sta_pwd?: string;
  wifi_band?: '2g' | '5g';
  ap_isolation?: boolean;
  ap_ssid?: string;
  ap_security?: 'open' | 'wpa2_psk' | 'wpa3_sae';
  ap_password?: string;
  
  // Enterprise Network Settings
  lan_ip?: string;
  subnet_mask?: string;
  dhcp_enabled?: boolean;
  dhcp_start?: string;
  dhcp_end?: string;
  lease_time?: string;
  
  // Routing
  static_routes?: StaticRoute[];
  
  // VPN Settings
  vpn_enabled?: boolean;
  vpn_type?: 'ipsec' | 'l2tp' | 'openvpn';
  vpn_psk?: string;
  
  // Pi 4B Specific: NAS & QoS
  nas_enabled?: boolean;
  nas_share_name?: string;
  nas_workgroup?: string;
  qos_enabled?: boolean;
  qos_download?: string;
  qos_upload?: string;
  
  // AI Assistant
  gemini_api_key?: string;
  
  // Captcha & Portal
  captcha_provider?: 'hcaptcha' | 'recaptcha';
  captcha_site_key?: string;
  captcha_secret_key?: string;
  captcha_invisible?: boolean;
  
  // Local DNS
  local_dns_enabled?: boolean;
  local_dns_name?: string;

  // Captive Portal Lease
  session_timeout?: number;

  // Additional Enterprise Features
  wg_enabled?: boolean;
  wg_port?: string;
  syslog_server?: string;
  syslog_port?: string;
}
