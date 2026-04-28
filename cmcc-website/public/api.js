// ─────────────────────────────────────────────────────────────────────
// CMCC API client — talks to the standalone CMCC backend (this server).
// Holds operator auth, exposes a small set of helpers compatible with the
// shared dashboard.js / dashboard-pro.js modules.
// ─────────────────────────────────────────────────────────────────────

window.api = (() => {
  const TOKEN_KEY = 'vl_cmcc_token';
  const USER_KEY  = 'vl_cmcc_user';

  const token = () => localStorage.getItem(TOKEN_KEY);
  const setToken = (v) => v ? localStorage.setItem(TOKEN_KEY, v) : localStorage.removeItem(TOKEN_KEY);
  const user = () => { try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; } };
  const setUser = (u) => u ? localStorage.setItem(USER_KEY, JSON.stringify(u)) : localStorage.removeItem(USER_KEY);

  async function http(method, url, body) {
    const r = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token() ? { Authorization: 'Bearer ' + token() } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'HTTP ' + r.status);
    return d;
  }

  function logout() { setToken(null); setUser(null); location.replace('/login.html'); }

  // ── i18n (EN ↔ HI) ─────────────────────────────────────────────────
  const LANG_KEY = 'vl_cmcc_lang';
  const lang = () => localStorage.getItem(LANG_KEY) || 'EN';
  const setLang = (l) => { localStorage.setItem(LANG_KEY, l); location.reload(); };
  const t = (k) => k;

  // Comprehensive English→Hindi dictionary for the CMCC console + citizen
  // portal. Technical terms (CMCC, NOC, RFID, OTA, MQTT, SLA, KPI, etc.)
  // are intentionally kept in Latin script — that's the convention Indian
  // ops teams use even when speaking Hindi.
  const HI_DICT = {
    // Brand / shell
    'Valet CMCC · Centralized Monitoring & Control Center': 'वैले CMCC · केंद्रीकृत मॉनिटरिंग और नियंत्रण केंद्र',
    'Centralized Monitoring & Control Center · operator access only': 'केंद्रीकृत मॉनिटरिंग और नियंत्रण केंद्र · केवल संचालक पहुँच',
    'Hearthly': 'हर्थली',
    'Hearthly Governance': 'हर्थली गवर्नेंस',
    'CMCC · LIVE': 'CMCC · लाइव',
    'TELANGANA · LIVE': 'तेलंगाना · लाइव',

    // Login
    'Sign in · Valet CMCC': 'साइन इन · वैले CMCC',
    'Operator sign-in': 'संचालक लॉगिन',
    'Verify your number': 'अपना नंबर सत्यापित करें',
    'Mobile number': 'मोबाइल नंबर',
    'Enter 6-digit code': '6 अंकों का कोड दर्ज करें',
    'Send OTP': 'OTP भेजें',
    'Sending OTP…': 'OTP भेजा जा रहा है…',
    'Verifying…': 'सत्यापित हो रहा है…',
    'Verify & sign in': 'सत्यापित करें और साइन इन करें',
    'Change number': 'नंबर बदलें',
    'Demo operators (OTP 123456)': 'डेमो संचालक (OTP 123456)',
    'NOC Lead': 'NOC प्रमुख',
    'NOC Operator': 'NOC संचालक',
    'On-Call SRE': 'ऑन-कॉल SRE',
    'Compliance': 'अनुपालन',
    'DPDP-compliant · TLS 1.3 · ap-south-1 (mock)': 'DPDP-अनुपालित · TLS 1.3 · ap-south-1 (मॉक)',
    'Auto-fill': 'ऑटो-फ़िल',
    'Resend in': 'पुनः भेजें',
    'Resend OTP': 'OTP पुनः भेजें',
    'Welcome': 'स्वागत है',
    'Enter +91XXXXXXXXXX': '+91XXXXXXXXXX दर्ज करें',

    // Sidebar sections
    'Monitor': 'मॉनिटर',
    'Operate': 'ऑपरेट',
    'Govern': 'गवर्नेंस',
    'Saved views': 'सहेजे गए दृश्य',
    'Municipal · ULB': 'नगरपालिका · ULB',
    'Overview': 'अवलोकन',
    'Anomalies': 'विसंगतियाँ',
    'IoT Fleet': 'IoT बेड़ा',
    'Analytics': 'विश्लेषण',
    'Communities': 'समुदाय',
    'Agents': 'एजेंट',
    'Orders': 'ऑर्डर',
    'AI Insights': 'AI इनसाइट',
    'Audit Log': 'ऑडिट लॉग',
    'Team': 'टीम',
    'Settings': 'सेटिंग्स',
    'What-if': 'व्हाट-इफ़',
    'Compare': 'तुलना',
    'Wards': 'वार्ड',
    'Grievances': 'शिकायतें',
    'SBM Compliance': 'SBM अनुपालन',
    'Worker Welfare': 'कर्मचारी कल्याण',
    'GIS Map': 'GIS मानचित्र',
    'Disaster Mgmt': 'आपदा प्रबंधन',
    'Compliance Reports': 'अनुपालन रिपोर्ट',
    'Bangalore P0': 'बेंगलुरु P0',
    'OTA pending': 'OTA लंबित',
    'Open today': 'आज खुले',
    'Sign out': 'साइन आउट',

    // Top bar / common controls
    'CMCC': 'CMCC',
    'Search community, agent, order, device...': 'समुदाय, एजेंट, ऑर्डर, डिवाइस खोजें...',
    'All systems nominal': 'सभी सिस्टम सामान्य',
    'mobile-linked': 'मोबाइल-लिंक्ड',
    'Create incident': 'घटना बनाएँ',
    'Per-community': 'प्रति-समुदाय',
    'Notifications': 'सूचनाएँ',
    'Toggle theme': 'थीम बदलें',
    "What's new": 'नया क्या है',
    'Brief me': 'मुझे ब्रीफ़ करें',
    'Aria': 'आरिया',
    'Listening…': 'सुन रहा है…',
    'menu': 'मेनू',
    'Close': 'बंद करें',
    'Cancel': 'रद्द करें',
    'Save': 'सहेजें',
    'Submit': 'जमा करें',
    'Generate': 'जनरेट करें',
    'View': 'देखें',
    'Enroll': 'नामांकित करें',
    'Live': 'लाइव',
    'live': 'लाइव',
    'LIVE': 'लाइव',
    'LIVE FEED': 'लाइव फ़ीड',
    'navigate': 'नेविगेट',
    'select': 'चुनें',
    'close': 'बंद',

    // Overview KPIs
    'Live network status': 'लाइव नेटवर्क स्थिति',
    'communities · 8 cities': 'समुदाय · 8 शहर',
    'Updated': 'अपडेट',
    'Active orders': 'सक्रिय ऑर्डर',
    'Revenue today': 'आज का राजस्व',
    'SLA compliance': 'SLA अनुपालन',
    'target 95%': 'लक्ष्य 95%',
    'Open anomalies': 'खुली विसंगतियाँ',
    'critical': 'गंभीर',
    'Agents online': 'एजेंट ऑनलाइन',
    'Full bins ≥80%': 'भरे बिन ≥80%',
    'Devices offline': 'डिवाइस ऑफ़लाइन',
    'Completed today': 'आज पूरे',
    'National live map': 'राष्ट्रीय लाइव मानचित्र',
    'Anomaly feed': 'विसंगति फ़ीड',
    'Top communities by activity': 'गतिविधि के अनुसार शीर्ष समुदाय',
    'Recent control actions': 'हाल की नियंत्रण क्रियाएँ',
    'Community': 'समुदाय',
    'City': 'शहर',
    'SLA': 'SLA',
    'Status': 'स्थिति',
    'OK': 'ठीक',
    'WARN': 'चेतावनी',
    'Warn': 'चेतावनी',
    'Critical': 'गंभीर',
    'When': 'कब',
    'Operator': 'संचालक',
    'Action': 'क्रिया',
    'Target': 'लक्ष्य',
    'Predictive demand surge': 'पूर्वानुमान माँग वृद्धि',
    'Pre-position': 'पूर्व-स्थान',
    'Open simulator': 'सिमुलेटर खोलें',
    'Building-level anomaly': 'भवन-स्तरीय विसंगति',
    'Visitor pattern AI': 'विज़िटर पैटर्न AI',
    'Add Tuesday pickup': 'मंगलवार पिकअप जोड़ें',
    'Notify maintenance': 'मेंटेनेंस को सूचित करें',
    'Auto-approve window': 'ऑटो-अनुमोदन विंडो',
    'Review history': 'इतिहास देखें',
    // Full-sentence insight-card text (kept as single text nodes after the
    // markup-flattening fix, so each whole sentence translates atomically).
    '☔ Sunday 9 AM — laundry surge predicted in Bangalore (rain forecast 70%+, 3 affected communities). Expected +38% volume.':
      '☔ रविवार सुबह 9 बजे — बेंगलुरु में लॉन्ड्री माँग में उछाल का पूर्वानुमान (बारिश की संभावना 70%+, 3 प्रभावित समुदाय)। अपेक्षित +38% मात्रा।',
    'Suggested: pre-position 4 extra agents in Whitefield · push residents about same-day pickup before 11 AM.':
      'सुझाव: व्हाइटफील्ड में 4 अतिरिक्त एजेंट पूर्व-तैनात करें · निवासियों को सुबह 11 बजे से पहले उसी-दिन पिकअप के बारे में सूचित करें।',
    '🔍 B-block bin in Prestige Sunrise Park fills 3.4× faster on Tuesdays — root cause likely AC repair tech leaving cardboard packaging.':
      '🔍 प्रेस्टीज सनराइज़ पार्क का B-ब्लॉक बिन मंगलवार को 3.4× तेज़ी से भरता है — संभावित कारण: AC रिपेयर टेक्नीशियन कार्डबोर्ड पैकेजिंग छोड़ रहा है।',
    'Pattern detected over 6 weeks · 92% confidence · suggested: schedule extra Tuesday pickup OR notify maintenance team.':
      'पैटर्न 6 सप्ताह में पहचाना गया · 92% विश्वास · सुझाव: मंगलवार को अतिरिक्त पिकअप शेड्यूल करें या मेंटेनेंस टीम को सूचित करें।',
    '📦 Amazon delivery arrives at Brigade Cosmopolis Mon–Wed between 2–4 PM · 87% of weeks. Auto-pre-approve window?':
      '📦 ब्रिगेड कॉस्मोपोलिस में Amazon डिलीवरी सोम–बुध दोपहर 2–4 बजे आती है · 87% सप्ताहों में। ऑटो-पूर्व-अनुमोदन विंडो?',
    'Saves 45s/visit at gate · 230 deliveries/month · est. ₹2,070 in security time saved.':
      'गेट पर प्रति-विज़िट 45 सेकंड बचाता है · 230 डिलीवरी/माह · अनुमानित ₹2,070 सुरक्षा समय की बचत।',
    // Toast / push messages fired by these card buttons
    'Pre-positioning queued': 'पूर्व-तैनाती कतार में',
    '4 agents alerted in Whitefield': 'व्हाइटफील्ड में 4 एजेंट सतर्क',
    'Recurring pickup added': 'बार-बार पिकअप जोड़ा गया',
    'Every Tuesday · B-block bin': 'हर मंगलवार · B-ब्लॉक बिन',
    'Maintenance notified': 'मेंटेनेंस को सूचित किया',
    'Will discuss with AC repair team': 'AC रिपेयर टीम से चर्चा होगी',
    'Auto-approve window saved': 'ऑटो-अनुमोदन विंडो सहेजी',
    'Amazon Mon–Wed 2–4 PM at Brigade Cosmopolis': 'ब्रिगेड कॉस्मोपोलिस पर Amazon सोम–बुध 2–4 बजे',
    'Visitor history': 'विज़िटर इतिहास',
    '230 Amazon deliveries logged in last 30 days': 'पिछले 30 दिनों में 230 Amazon डिलीवरी दर्ज',

    // Communities / agents / orders
    'flats': 'फ़्लैट',
    'agents online': 'एजेंट ऑनलाइन',
    'Orders': 'ऑर्डर',
    'Revenue': 'राजस्व',
    'KYC': 'KYC',
    'KYC PENDING': 'KYC लंबित',
    'ONLINE': 'ऑनलाइन',
    'OFFLINE': 'ऑफ़लाइन',
    'services this week': 'इस सप्ताह सेवाएँ',
    'All statuses': 'सभी स्थितियाँ',
    'Order': 'ऑर्डर',
    'Service': 'सेवा',
    'Agent': 'एजेंट',
    'Amount': 'राशि',
    'Created': 'बनाया',
    'ASSIGNED': 'सौंपा गया',
    'EN_ROUTE': 'रास्ते में',
    'EN ROUTE': 'रास्ते में',
    'ARRIVED': 'पहुँचा',
    'IN_PROGRESS': 'प्रगति में',
    'IN PROGRESS': 'प्रगति में',
    'COMPLETED': 'पूरा',
    'CANCELLED': 'रद्द',
    'OPEN': 'खुला',
    'ACK': 'स्वीकार',
    'RESOLVED': 'हल',
    'ESCALATED': 'एस्केलेटेड',
    'BREACHED': 'उल्लंघन',
    'BLOCKED': 'अवरुद्ध',
    'Ack': 'स्वीकार',
    'Resolve': 'हल करें',
    'Playbook': 'प्लेबुक',
    'Video call agent': 'एजेंट को वीडियो कॉल',
    'Dispatch': 'भेजें',
    'Reassign': 'पुनः सौंपें',
    'Refund order': 'ऑर्डर रिफंड',

    // IoT
    'Total bins': 'कुल बिन',
    '≥80% fill': '≥80% भरा',
    'Offline': 'ऑफ़लाइन',
    'Need OTA': 'OTA चाहिए',
    'Schedule fleet OTA': 'फ्लीट OTA शेड्यूल',
    'Smart bins by community': 'समुदाय के अनुसार स्मार्ट बिन',
    'Schedule OTA': 'OTA शेड्यूल करें',
    'Schedule update': 'अपडेट शेड्यूल करें',
    'Version': 'संस्करण',
    'now': 'अभी',
    'tonight 2 AM': 'आज रात 2 बजे',
    'this weekend': 'इस सप्ताहांत',

    // Anomalies
    'Anomalies & incidents': 'विसंगतियाँ और घटनाएँ',
    'open': 'खुला',
    'acknowledged': 'स्वीकृत',
    'resolved': 'हल',
    'BIN_THEFT_SUSPECTED': 'बिन चोरी संदिग्ध',
    'GHOST_COMPLETION': 'घोस्ट पूर्णता',
    'AGENT_IDLE': 'एजेंट निष्क्रिय',
    'DEVICE_OFFLINE': 'डिवाइस ऑफ़लाइन',
    'SLA_BREACH': 'SLA उल्लंघन',
    'PAYMENT_RECONCILE_FAIL': 'भुगतान सुलह विफल',
    'BATTERY_LOW': 'बैटरी कम',
    'HIGH_VOLUME': 'उच्च मात्रा',

    // Analytics
    'MRR': 'MRR',
    'Active residents': 'सक्रिय निवासी',
    'Churn (90d)': 'चर्न (90 दिन)',
    'Daily revenue (last 14 days)': 'दैनिक राजस्व (पिछले 14 दिन)',
    'Revenue by service': 'सेवा के अनुसार राजस्व',
    'City breakdown': 'शहर अनुसार',

    // AI Insights
    'OpenAI · gpt-4o-mini': 'OpenAI · gpt-4o-mini',
    'mock mode': 'मॉक मोड',
    'Ask anything about the network.': 'नेटवर्क के बारे में कुछ भी पूछें।',
    'Operator console': 'संचालक कंसोल',
    'Ask': 'पूछें',
    'Key': 'कुंजी',
    'Top performing community': 'शीर्ष प्रदर्शन समुदाय',
    'Worst SLA today': 'आज सबसे ख़राब SLA',
    'Most anomalies last hour': 'पिछले घंटे सबसे ज़्यादा विसंगतियाँ',
    'Revenue forecast next 7 days': 'अगले 7 दिनों का राजस्व पूर्वानुमान',
    'Auto-summary (last 24h)': 'ऑटो-सारांश (पिछले 24 घंटे)',
    'Generating digest…': 'डाइजेस्ट तैयार हो रहा है…',
    'Predicted incidents (24h)': 'पूर्वानुमानित घटनाएँ (24 घंटे)',
    'Thinking…': 'सोच रहा है…',

    // Compliance / audit / team
    'DPDP 2023 · CERT-In': 'DPDP 2023 · CERT-In',
    'Consent rate': 'सहमति दर',
    'Data export requests (30d)': 'डेटा एक्सपोर्ट अनुरोध (30 दिन)',
    'Erasure requests (30d)': 'मिटाने के अनुरोध (30 दिन)',
    'all fulfilled': 'सभी पूर्ण',
    'CERT-In incident hooks': 'CERT-In घटना हुक',
    'Data residency': 'डेटा निवास',
    'Audit log': 'ऑडिट लॉग',
    'entries': 'प्रविष्टियाँ',
    'Tamper-evident · ap-south-1 · QLDB': 'छेड़छाड़-स्पष्ट · ap-south-1 · QLDB',
    'NOC Team': 'NOC टीम',
    'Hash': 'हैश',

    // Settings
    'Integrations': 'एकीकरण',
    'Telangana eGov stack': 'तेलंगाना eGov स्टैक',
    'Communication channels': 'संचार चैनल',
    'Storage + AI': 'स्टोरेज + AI',
    'connected': 'कनेक्टेड',
    'verified': 'सत्यापित',
    'live': 'लाइव',
    'Reset demo data': 'डेमो डेटा रीसेट',
    'Wipes the CMCC seed (orders, anomalies, audit) and regenerates fresh mock data.': 'CMCC सीड (ऑर्डर, विसंगतियाँ, ऑडिट) मिटा कर ताज़ा मॉक डेटा तैयार करता है।',
    'Reset': 'रीसेट',
    'CMCC reset': 'CMCC रीसेट',
    'New mock dataset generated': 'नया मॉक डेटासेट तैयार',

    // Incident sheet
    'Open an investigation, page on-call, or quarantine a device.': 'जाँच खोलें, ऑन-कॉल को पेज करें, या डिवाइस को क्वारंटाइन करें।',
    'Service outage': 'सेवा बाधित',
    'Device tampering': 'डिवाइस से छेड़छाड़',
    'Agent escalation': 'एजेंट एस्केलेशन',
    'Payment reconciliation': 'भुगतान सुलह',
    'Security / breach': 'सुरक्षा / उल्लंघन',
    'Severity': 'गंभीरता',
    'Critical (page SRE)': 'गंभीर (SRE को पेज करें)',
    'Warning': 'चेतावनी',
    'Info': 'सूचना',
    'Description': 'विवरण',
    'Details, affected scope, suggested action…': 'विवरण, प्रभावित क्षेत्र, सुझाई गई कार्रवाई…',
    'Open incident': 'घटना खोलें',
    'Incident opened': 'घटना खोली गई',

    // Playbook
    'Incident': 'घटना',
    'Step 1 — Acknowledge & triage': 'चरण 1 — स्वीकार और ट्राइएज',
    "Confirm you've seen this incident. Acknowledging starts the SLA clock and notifies the on-call channel.": 'पुष्टि करें कि आपने यह घटना देख ली है। स्वीकार करने पर SLA घड़ी शुरू होती है और ऑन-कॉल चैनल को सूचना जाती है।',
    'Acknowledge & continue →': 'स्वीकार करें और जारी रखें →',
    'Step 2 — Context': 'चरण 2 — संदर्भ',
    'Live telemetry, agent GPS, and related orders for the affected entity.': 'प्रभावित इकाई के लिए लाइव टेलीमेट्री, एजेंट GPS, और संबंधित ऑर्डर।',
    'Suggested runbook': 'सुझाई गई रनबुक',
    '← Back': '← वापस',
    'Choose action →': 'क्रिया चुनें →',
    'Step 3 — Suggested actions': 'चरण 3 — सुझाई गई क्रियाएँ',
    'Tap any to execute. Each writes an audit entry. Multiple actions allowed.': 'निष्पादित करने के लिए टैप करें। हर क्रिया एक ऑडिट प्रविष्टि बनाती है। एक से अधिक क्रियाएँ अनुमत।',
    'Write post-mortem →': 'पोस्ट-मॉर्टम लिखें →',
    'Step 4 — Post-mortem': 'चरण 4 — पोस्ट-मॉर्टम',
    'A short summary attached to the audit trail.': 'ऑडिट ट्रेल से जुड़ा संक्षिप्त सारांश।',
    'Resolve & close': 'हल करें और बंद करें',
    'Incident resolved': 'घटना हल',
    'Device telemetry (last 60s):': 'डिवाइस टेलीमेट्री (पिछले 60 सेक):',
    'Agent GPS (nearest):': 'एजेंट GPS (निकटतम):',
    'Ravi Kumar, 220m away, 4 min away.': 'रवि कुमार, 220 मी दूर, 4 मिनट दूर।',
    'Related orders in last hour:': 'पिछले घंटे के संबंधित ऑर्डर:',
    '3 garbage pickups completed.': '3 कचरा पिकअप पूरे।',
    'Camera feed:': 'कैमरा फ़ीड:',
    't-60s · 22% · 22% · 24% · 31% · 67% · 95%  ← anomaly here': 't-60 सेक · 22% · 22% · 24% · 31% · 67% · 95%  ← यहाँ विसंगति',
    'Available at NVR-c1-CH04 (last motion 2 min ago).': 'NVR-c1-CH04 पर उपलब्ध (अंतिम गतिविधि 2 मिनट पहले)।',
    'Suggested runbook': 'सुझाई गई रनबुक',
    'Action executed': 'क्रिया निष्पादित',
    'Pre-positioning executed': 'पूर्व-तैनाती निष्पादित',
    'agents alerted': 'एजेंट सतर्क',
    'Scheduled': 'शेड्यूल हुआ',
    'Pre-positioning at': 'पूर्व-तैनाती',
    'Loaded saved view': 'सहेजा गया दृश्य लोड किया',
    'Aria heard': 'आरिया ने सुना',
    'Aria summary': 'आरिया सारांश',
    'Last hour: 3 services completed, 1 anomaly opened, 0 SLA breaches.': 'पिछला घंटा: 3 सेवाएँ पूरी हुईं, 1 विसंगति खुली, 0 SLA उल्लंघन।',
    'Aria · dispatch queued': 'आरिया · प्रेषण कतार में',
    'Closest agent notified · Ravi Kumar · ETA 4 min': 'निकटतम एजेंट सूचित · रवि कुमार · ETA 4 मिनट',
    'Microphone unavailable': 'माइक्रोफ़ोन अनुपलब्ध',
    'Permission denied or no input device': 'अनुमति अस्वीकृत या कोई इनपुट डिवाइस नहीं',
    'Daily briefing · Aria voice': 'दैनिक ब्रीफ़िंग · आरिया आवाज़',
    'Webhook fired': 'वेबहुक फ़ायर हुआ',
    'subscriber(s)': 'सब्सक्राइबर',
    'Pop-up blocked': 'पॉप-अप अवरुद्ध',
    'Allow pop-ups to print': 'प्रिंट के लिए पॉप-अप अनुमति दें',
    'Daily ops digest': 'दैनिक ऑप्स डाइजेस्ट',

    // Playbook step bodies referenced inside `<b>…:</b>` patterns
    'Confirm context, runbook, action, post-mortem': 'संदर्भ, रनबुक, क्रिया, पोस्ट-मॉर्टम की पुष्टि',

    // Keyboard shortcuts help (each line has a `<b>shortcut</b> · description`
    // structure — the description text node starts with " · " so the trim
    // produces these as keys).
    'Keyboard shortcuts': 'कीबोर्ड शॉर्टकट',
    '· open command palette': '· कमांड पैलेट खोलें',
    '· go to Orders': '· ऑर्डर पर जाएँ',
    '· go to Communities': '· समुदाय पर जाएँ',
    '· go to Agents': '· एजेंट पर जाएँ',
    '· go to IoT Fleet': '· IoT फ़्लीट पर जाएँ',
    '· go to Anomalies': '· विसंगतियों पर जाएँ',
    '· go to Analytics': '· विश्लेषण पर जाएँ',
    '· go to Audit': '· ऑडिट पर जाएँ',
    '· go to Settings': '· सेटिंग्स पर जाएँ',
    '· this help': '· यह मदद',

    // Cmd-K
    'Search anything — try \'ravi\', \'bin\', \'bangalore\', \'create incident\'…': 'कुछ भी खोजें — \'ravi\', \'bin\', \'bangalore\', \'create incident\' आज़माएँ…',
    'No matches': 'कोई मिलान नहीं',
    'Actions': 'क्रियाएँ',
    'Pages': 'पृष्ठ',
    'Devices': 'डिवाइस',

    // What-if
    'Live what-if simulation': 'लाइव व्हाट-इफ़ सिमुलेशन',
    'Drag the controls — see projected impact updated live (mock ML model)': 'कंट्रोल खिसकाएँ — अनुमानित प्रभाव लाइव दिखेगा (मॉक ML मॉडल)',
    'Rain probability': 'बारिश की संभावना',
    'Hour of day': 'दिन का समय',
    'Peak hours?': 'पीक घंटे?',
    'Yes': 'हाँ',
    'No': 'नहीं',
    'Holiday weekend?': 'छुट्टी का सप्ताहांत?',
    'Projected orders / hour': 'अनुमानित ऑर्डर / घंटा',
    'SLA at risk if no action': 'क्रिया न होने पर SLA जोख़िम में',
    'Agents needed': 'आवश्यक एजेंट',
    'Revenue impact (₹)': 'राजस्व प्रभाव (₹)',
    'Suggested action:': 'सुझाई गई क्रिया:',
    'Execute pre-position': 'पूर्व-स्थान निष्पादित करें',
    'Schedule for': 'के लिए शेड्यूल',
    'Historical pattern': 'ऐतिहासिक पैटर्न',

    // Compare
    'Compare communities': 'समुदायों की तुलना',
    'Pick up to 3 — best/worst values highlighted': '3 तक चुनें — सर्वश्रेष्ठ/न्यूनतम मान हाइलाइट',
    '— pick a community —': '— समुदाय चुनें —',
    'Open anomalies': 'खुली विसंगतियाँ',

    // Municipal — Wards
    'ULBs': 'ULBs',
    'live ward-level operations': 'लाइव वार्ड-स्तरीय संचालन',
    'Wards live': 'वार्ड लाइव',
    'Avg SBM score': 'औसत SBM स्कोर',
    'Open grievances': 'खुली शिकायतें',
    'SLA at risk (4h)': 'SLA जोख़िम में (4 घंटे)',
    'Ward': 'वार्ड',
    'Population': 'जनसंख्या',
    'Workers': 'कर्मचारी',
    'Bins': 'बिन',
    'Coverage': 'कवरेज',
    'SBM': 'SBM',
    'Star': 'स्टार',
    'ODF': 'ODF',
    'full': 'भरा',

    // Municipal — Grievances
    'Citizen Grievances': 'नागरिक शिकायतें',
    'Live grievance queue · auto-routed to ward officers · SLA-tracked · CPGRAMS-compatible': 'लाइव शिकायत क्यू · वार्ड अधिकारियों को ऑटो-रूट · SLA-ट्रैक · CPGRAMS-संगत',
    'SLA risk (2h)': 'SLA जोख़िम (2 घंटे)',
    'Resolved (24h)': 'हल (24 घंटे)',
    'Citizen NPS': 'नागरिक NPS',
    'By category (last 30 days)': 'श्रेणी अनुसार (पिछले 30 दिन)',
    'SLA performance': 'SLA प्रदर्शन',
    'Within SLA': 'SLA के भीतर',
    'SLA breached': 'SLA उल्लंघन',
    'Avg resolution time': 'औसत हल समय',
    'Auto-escalated': 'ऑटो-एस्केलेटेड',
    'Multilingual intake': 'बहुभाषी इनटेक',
    'WhatsApp reports': 'WhatsApp रिपोर्ट',
    'ID': 'ID',
    'Category': 'श्रेणी',
    'Issue': 'समस्या',
    'Citizen': 'नागरिक',
    'Opened': 'खुला',
    'left': 'बचा',
    'Garbage': 'कचरा',
    'Water': 'पानी',
    'Streetlight': 'स्ट्रीटलाइट',
    'Roads': 'सड़कें',
    'Sewage': 'सीवेज',
    'Stray': 'आवारा',
    'Encroachment': 'अतिक्रमण',
    'Mosquito': 'मच्छर',
    'Stray animals': 'आवारा जानवर',
    'Fogging': 'फॉगिंग',

    // Municipal — SBM
    'Swachh Bharat Mission Compliance': 'स्वच्छ भारत मिशन अनुपालन',
    'SBM-Urban 2.0': 'SBM-शहरी 2.0',
    'Real-time scorecard aligned with MoHUA Star Rating Protocol · auto-feeds SBM portal': 'MoHUA स्टार रेटिंग प्रोटोकॉल के अनुरूप रियल-टाइम स्कोरकार्ड · SBM पोर्टल को ऑटो-फ़ीड',
    '5-star wards': '5-स्टार वार्ड',
    'ODF+ wards': 'ODF+ वार्ड',
    'Bin coverage': 'बिन कवरेज',
    'SBM Star Rating Protocol': 'SBM स्टार रेटिंग प्रोटोकॉल',
    'Door-to-door collection': 'घर-घर संग्रहण',
    'Source segregation': 'स्रोत पृथक्करण',
    'Sweeping coverage': 'सफ़ाई कवरेज',
    'Waste processing': 'कचरा प्रसंस्करण',
    'Plastic waste mgmt': 'प्लास्टिक कचरा प्रबंधन',
    'Public toilets functional': 'सार्वजनिक शौचालय कार्यरत',
    'Citizen satisfaction': 'नागरिक संतुष्टि',
    'Information transparency': 'सूचना पारदर्शिता',
    'Auto-reported to portals': 'पोर्टलों को ऑटो-रिपोर्ट',
    'Top-performing wards': 'शीर्ष-प्रदर्शन वार्ड',

    // Municipal — Welfare
    'Sanitation Worker Welfare': 'सफ़ाई कर्मचारी कल्याण',
    'workers': 'कर्मचारी',
    'Real-time safety, attendance, insurance, and skill-development tracking · aligned with Safai Mitra Suraksha': 'रियल-टाइम सुरक्षा, उपस्थिति, बीमा, और कौशल विकास ट्रैकिंग · सफ़ाई मित्र सुरक्षा के अनुरूप',
    'Workers tracked': 'ट्रैक किए गए कर्मचारी',
    'Avg attendance': 'औसत उपस्थिति',
    'No safety kit': 'सुरक्षा किट नहीं',
    'Overdue health check': 'विलंबित स्वास्थ्य जाँच',
    'Welfare schemes coverage': 'कल्याण योजनाओं का कवरेज',
    'PMSBY (insurance ₹2L)': 'PMSBY (बीमा ₹2 लाख)',
    'Aasara pension eligible': 'आसरा पेंशन योग्य',
    'enrolled': 'नामांकित',
    'Arogyasri health card': 'आरोग्यश्री स्वास्थ्य कार्ड',
    'Safety kit issued': 'सुरक्षा किट जारी',
    '2BHK housing scheme': '2BHK आवास योजना',
    'allotted': 'आवंटित',
    'KCR Kit (maternity)': 'KCR किट (मातृत्व)',
    'distributed': 'वितरित',
    'T-SAT skill training': 'T-SAT कौशल प्रशिक्षण',
    'Active alerts': 'सक्रिय अलर्ट',
    'workers without safety kit': 'कर्मचारी बिना सुरक्षा किट',
    'Auto-PO raised on GeM · ETA 3 days': 'GeM पर ऑटो-PO · ETA 3 दिन',
    'workers overdue for health check': 'कर्मचारी स्वास्थ्य जाँच में विलंब',
    'Auto-scheduled at ESI Hospital · SMS sent': 'ESI अस्पताल में ऑटो-शेड्यूल · SMS भेजा',
    'workers eligible for Skill India promotion': 'कर्मचारी स्किल इंडिया प्रमोशन के योग्य',
    'Training slots available next week': 'अगले सप्ताह प्रशिक्षण स्लॉट उपलब्ध',
    'Worker': 'कर्मचारी',
    'Attendance': 'उपस्थिति',
    'Safety kit': 'सुरक्षा किट',
    'Insurance': 'बीमा',
    'Last health check': 'अंतिम स्वास्थ्य जाँच',
    'Skill courses': 'कौशल कोर्स',
    'missing': 'अनुपस्थित',
    'expired': 'समाप्त',

    // Municipal — GIS
    'GIS — Live City Map': 'GIS — लाइव शहर मानचित्र',
    'Bhuvan-compatible': 'Bhuvan-संगत',
    'Ward boundaries · grievance heatmap · sanitation routes · live incidents': 'वार्ड सीमाएँ · शिकायत हीटमैप · सफ़ाई रूट · लाइव घटनाएँ',
    'Wards mapped': 'मानचित्रित वार्ड',
    'Live incidents': 'लाइव घटनाएँ',
    'Avg AQI': 'औसत AQI',
    'SLA breach': 'SLA उल्लंघन',

    // Municipal — Disaster
    'Disaster & Public Safety': 'आपदा और सार्वजनिक सुरक्षा',
    'Real-time hazard detection · NDMA-compatible · auto-citizen alerts · resource dispatch': 'रियल-टाइम ख़तरा पहचान · NDMA-संगत · ऑटो-नागरिक अलर्ट · संसाधन प्रेषण',
    'Active incidents': 'सक्रिय घटनाएँ',
    'Citizens alerted (24h)': 'सतर्क नागरिक (24 घंटे)',
    'Channels': 'चैनल',
    'Languages': 'भाषाएँ',
    'Citizen alert channels': 'नागरिक अलर्ट चैनल',
    'NDMA + State integrations': 'NDMA + राज्य एकीकरण',
    'Alert again': 'फिर अलर्ट करें',

    // Municipal — Reports
    'CAG audit-ready': 'CAG ऑडिट-तैयार',
    'One-click reports for MoHUA · NITI Aayog · CAG · Smart Cities Mission · AMRUT': 'MoHUA · NITI आयोग · CAG · स्मार्ट सिटीज़ मिशन · AMRUT के लिए वन-क्लिक रिपोर्ट',
    'Report generated': 'रिपोर्ट तैयार',
    'Saved to Downloads · audit logged': 'डाउनलोड में सहेजी · ऑडिट लॉग की',

    // Citizen portal
    '🇮🇳 भारत सरकार · Government of Telangana': '🇮🇳 भारत सरकार · तेलंगाना सरकार',
    'Real-Time Governance · Live': 'रियल-टाइम गवर्नेंस · लाइव',
    'Telangana Citizen Portal': 'तेलंगाना नागरिक पोर्टल',
    'Mee-Seva enabled · Aadhaar / DigiLocker login': 'मी-सेवा सक्षम · आधार / DigiLocker लॉगिन',
    'Track grievance': 'शिकायत ट्रैक करें',
    'Schemes': 'योजनाएँ',
    'Open data': 'ओपन डेटा',
    'Govt login': 'सरकारी लॉगिन',
    '🌟 Powered by Real-Time Governance': '🌟 रियल-टाइम गवर्नेंस द्वारा संचालित',
    'Report any civic issue in 30 seconds': '30 सेकंड में नागरिक समस्या दर्ज करें',
    'Snap a photo, drop a pin, send. Auto-routed to your ward officer with SLA tracking. Available in Telugu, Hindi, English, Urdu · also via WhatsApp + missed-call.': 'फ़ोटो लें, पिन डालें, भेजें। SLA ट्रैकिंग के साथ आपके वार्ड अधिकारी को ऑटो-रूट होगा। तेलुगु, हिंदी, अंग्रेज़ी, उर्दू में उपलब्ध · WhatsApp + मिस्ड कॉल से भी।',
    'Telangana at a glance': 'तेलंगाना एक नज़र में',
    'Citizens registered': 'पंजीकृत नागरिक',
    'Grievances resolved (today)': 'हल शिकायतें (आज)',
    'Avg resolution time': 'औसत समाधान समय',
    'Citizen NPS': 'नागरिक NPS',
    'Smart bins live': 'स्मार्ट बिन लाइव',
    'SBM 5-star wards': 'SBM 5-स्टार वार्ड',
    'Recently resolved in your area': 'आपके क्षेत्र में हाल ही में हल',
    'Last 24 hours · Hyderabad': 'पिछले 24 घंटे · हैदराबाद',
    'RESOLVED': 'हल',
    'IN PROGRESS': 'प्रगति में',
    'Track your grievance': 'अपनी शिकायत ट्रैक करें',
    'Enter the GRV ID you received via SMS to see real-time status and ward-officer assignment.': 'रियल-टाइम स्थिति और वार्ड-अधिकारी असाइनमेंट देखने के लिए SMS में मिली GRV ID दर्ज करें।',
    'Track': 'ट्रैक',
    'Other ways to report': 'रिपोर्ट के अन्य तरीक़े',
    'WhatsApp': 'WhatsApp',
    'Missed call': 'मिस्ड कॉल',
    'Mee-Seva centres': 'मी-सेवा केंद्र',
    'Emergency': 'आपातकाल',
    'Dial 100 / 108': '100 / 108 डायल करें',
    'Telangana welfare schemes': 'तेलंगाना कल्याण योजनाएँ',
    'RTI-compliant': 'RTI-अनुपालित',
    'Available downloads': 'उपलब्ध डाउनलोड',
    'Public dashboards': 'सार्वजनिक डैशबोर्ड',
    'Anyone can view the same KPIs that government officers see — full transparency.': 'सरकारी अधिकारी जो KPI देखते हैं, वही कोई भी देख सकता है — पूर्ण पारदर्शिता।',
    'SBM Live': 'SBM लाइव',
    'Star ratings, segregation, ODF status': 'स्टार रेटिंग, पृथक्करण, ODF स्थिति',
    'Air Quality': 'वायु गुणवत्ता',
    'AQI by ward · 15-min refresh': 'वार्ड अनुसार AQI · 15-मिनट रिफ़्रेश',
    'Budget tracker': 'बजट ट्रैकर',
    'Ward-wise spending live': 'वार्ड-वार खर्च लाइव',
    'Ward leaderboard': 'वार्ड लीडरबोर्ड',
    'Best & worst performers': 'सर्वश्रेष्ठ और न्यूनतम प्रदर्शन',
    'Report a civic issue': 'नागरिक समस्या दर्ज करें',
    'Auto-routed to your ward officer · SLA-tracked · resolved within hours': 'आपके वार्ड अधिकारी को ऑटो-रूट · SLA-ट्रैक · घंटों में हल',
    "What's wrong? (in any language)": 'क्या ग़लत है? (किसी भी भाषा में)',
    'Bin not picked since Monday morning': 'सोमवार सुबह से बिन नहीं उठाया',
    'Photo (optional · AI verifies)': 'फ़ोटो (वैकल्पिक · AI सत्यापित करेगा)',
    'Location': 'स्थान',
    'Plot no. / landmark / pincode': 'प्लॉट नं. / लैंडमार्क / पिनकोड',
    'Mobile (Aadhaar-verified citizens get faster service)': 'मोबाइल (आधार-सत्यापित नागरिकों को तेज़ सेवा)',
    'Submit grievance': 'शिकायत जमा करें',
    'By submitting you agree to our DPDP-compliant data policy. Your grievance is logged on a tamper-evident ledger and visible to your ward officer in real time.': 'जमा करने पर आप हमारी DPDP-अनुपालित डेटा नीति से सहमत होते हैं। आपकी शिकायत छेड़छाड़-स्पष्ट लेजर पर दर्ज होती है और रियल-टाइम में आपके वार्ड अधिकारी को दिखती है।',

    // Common controls / status
    'Privacy': 'गोपनीयता',
    'Terms': 'शर्तें',
    'Accessibility': 'पहुँच',
    'RTI': 'RTI',
    'Sitemap': 'साइटमैप',
    'Helpline 1800 425 6900': 'हेल्पलाइन 1800 425 6900',
    'CERT-In compliant · DPDP Act 2023 · ISO 27001 · ap-south-1 · 12 languages': 'CERT-In अनुपालित · DPDP अधिनियम 2023 · ISO 27001 · ap-south-1 · 12 भाषाएँ',
  };

  // Pattern-based fallback for dynamic strings (e.g. "5 services this
  // week"). Each pattern is matched against the trimmed text node; the
  // capture groups are spliced into the Hindi template via $1, $2, etc.
  // Numbers / IDs / city names pass through unchanged.
  const HI_PATTERNS = [
    [/^(\d+) services this week$/, 'इस सप्ताह $1 सेवाएँ'],
    [/^(\d+) workers without safety kit$/, '$1 कर्मचारी बिना सुरक्षा किट'],
    [/^(\d+) workers overdue for health check$/, 'स्वास्थ्य जाँच में विलंबित $1 कर्मचारी'],
    [/^(\d+) workers eligible for Skill India promotion$/, 'स्किल इंडिया प्रमोशन के योग्य $1 कर्मचारी'],
    [/^(\d+) workers tracked$/i, '$1 कर्मचारी ट्रैक किए गए'],
    [/^(\d+) active anomalies \((\d+) critical\)\. Most common: (.+)\.$/, '$1 सक्रिय विसंगतियाँ ($2 गंभीर)। सबसे सामान्य: $3।'],
    [/^(\d+) flats · (\d+) agents online$/, '$1 फ़्लैट · $2 एजेंट ऑनलाइन'],
    [/^(\d+) flats$/, '$1 फ़्लैट'],
    [/^(\d+) agents online$/, '$1 एजेंट ऑनलाइन'],
    [/^(\d+) orders today · SLA (\d+)%$/, 'आज $1 ऑर्डर · SLA $2%'],
    [/^(\d+) orders today$/, 'आज $1 ऑर्डर'],
    [/^(\d+) services scheduled$/, '$1 सेवाएँ शेड्यूल'],
    [/^(\d+) total$/, 'कुल $1'],
    [/^([A-Za-z][A-Za-z ]+), ([A-Z]{2}) · (\d+) flats · (\d+) agents online$/, '$1, $2 · $3 फ़्लैट · $4 एजेंट ऑनलाइन'],
    [/^([A-Za-z][A-Za-z ]+) · (\d+) services this week$/, '$1 · इस सप्ताह $2 सेवाएँ'],
    [/^([A-Za-z][A-Za-z ]+) · (\d+) flats$/, '$1 · $2 फ़्लैट'],
    [/^Schedule fleet OTA \((\d+)\)$/, 'फ़्लीट OTA शेड्यूल ($1)'],
    [/^(\d+) open$/, '$1 खुले'],
    [/^(\d+) open · auto-escalate at SLA breach$/, '$1 खुले · SLA उल्लंघन पर ऑटो-एस्केलेट'],
    [/^(\d+) entries$/, '$1 प्रविष्टियाँ'],
    [/^(\d+) ULBs · (.+) citizens · live ward-level operations$/, '$1 ULB · $2 नागरिक · लाइव वार्ड-स्तरीय संचालन'],
    [/^(\d+) of (\d+)$/, '$1 / $2'],
    [/^(\d+) device(s)?$/, '$1 डिवाइस'],
    [/^(\d+) deliveries logged in last 30 days$/, 'पिछले 30 दिनों में $1 डिलीवरी'],
    [/^Loaded saved view$/, 'सहेजा गया दृश्य लोड किया'],
    [/^Saves (\d+)s\/visit at gate · (\d+) deliveries\/month · est\. ₹([0-9,]+) in security time saved\.$/,
      'गेट पर प्रति-विज़िट $1 सेकंड बचत · $2 डिलीवरी/माह · अनुमानित ₹$3 सुरक्षा समय की बचत।'],
    [/^Pattern detected over (\d+) weeks · (\d+)% confidence · suggested: schedule extra Tuesday pickup OR notify maintenance team\.$/,
      'पैटर्न $1 सप्ताह में पहचाना गया · $2% विश्वास · सुझाव: मंगलवार को अतिरिक्त पिकअप शेड्यूल करें या मेंटेनेंस टीम को सूचित करें।'],
  ];

  function tr(text) {
    if (typeof text !== 'string' || lang() !== 'HI') return text;
    const t0 = text.trim();
    if (!t0) return text;
    if (HI_DICT[t0]) return text.replace(t0, HI_DICT[t0]);
    for (const [re, hi] of HI_PATTERNS) {
      const m = t0.match(re);
      if (m) {
        let out = hi;
        for (let i = m.length - 1; i >= 1; i--) out = out.replace('$' + i, m[i]);
        return text.replace(t0, out);
      }
    }
    return text;
  }

  const I18N_ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'TEXTAREA']);
  // Resolve a trimmed string to its Hindi form via dict OR regex pattern.
  // Returns null if no match — caller leaves the text unchanged.
  function _hiResolve(t0) {
    if (HI_DICT[t0]) return HI_DICT[t0];
    for (const [re, hi] of HI_PATTERNS) {
      const m = t0.match(re);
      if (m) {
        let out = hi;
        for (let i = m.length - 1; i >= 1; i--) out = out.replace('$' + i, m[i]);
        return out;
      }
    }
    return null;
  }
  function translateNode(root) {
    if (!root || lang() !== 'HI') return;
    if (root.nodeType === 3) {
      const t0 = root.nodeValue?.trim();
      const hi = t0 ? _hiResolve(t0) : null;
      if (hi) root.nodeValue = root.nodeValue.replace(t0, hi);
      return;
    }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (SKIP_TAGS.has(n.parentNode?.nodeName)) return NodeFilter.FILTER_REJECT;
        if (!n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const updates = [];
    let n;
    while ((n = walker.nextNode())) {
      const t0 = n.nodeValue.trim();
      const hi = _hiResolve(t0);
      if (hi) updates.push([n, n.nodeValue.replace(t0, hi)]);
    }
    updates.forEach(([nn, v]) => { nn.nodeValue = v; });
    const els = (root.nodeType === 1 ? [root] : []).concat(
      Array.from(root.querySelectorAll ? root.querySelectorAll('*') : [])
    );
    els.forEach((el) => {
      I18N_ATTRS.forEach((attr) => {
        const v = el.getAttribute && el.getAttribute(attr);
        if (v) {
          const tv = v.trim();
          const hi = _hiResolve(tv);
          if (hi) el.setAttribute(attr, hi);
        }
      });
      if ((el.tagName === 'INPUT' || el.tagName === 'BUTTON') && el.value) {
        const tv = String(el.value).trim();
        const hi = _hiResolve(tv);
        if (hi) el.value = hi;
      }
    });
  }
  let _i18nObs = null;
  let _i18nPaused = false;
  function startI18nObserver() {
    if (_i18nObs || !document.body) return;
    _i18nObs = new MutationObserver((muts) => {
      if (_i18nPaused || lang() !== 'HI') return;
      for (const m of muts) {
        if (m.type === 'childList') {
          m.addedNodes.forEach((node) => translateNode(node));
        } else if (m.type === 'characterData') {
          const t0 = m.target.nodeValue?.trim();
          const hi = t0 ? _hiResolve(t0) : null;
          if (hi) m.target.nodeValue = m.target.nodeValue.replace(t0, hi);
        } else if (m.type === 'attributes') {
          const el = m.target;
          const a = m.attributeName;
          const v = el.getAttribute(a);
          if (v) {
            const tv = v.trim();
            const hi = _hiResolve(tv);
            if (hi) el.setAttribute(a, hi);
          }
        }
      }
    });
    _i18nObs.observe(document.body, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: I18N_ATTRS.concat(['value']),
    });
  }
  // Used by callers that bulk-replace DOM (e.g. dashboard.js paint()).
  // Pausing avoids the observer firing thousands of mutation events while
  // innerHTML is rewritten; the caller does a single batch translateNode
  // pass after the rewrite is done.
  function pauseI18n() { _i18nPaused = true; }
  function resumeI18n() {
    _i18nPaused = false;
    if (lang() === 'HI') translateNode(document.body);
  }
  function bootI18n() {
    document.documentElement.lang = lang().toLowerCase();
    if (lang() === 'HI') translateNode(document.body);
    startI18nObserver();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootI18n);
  else bootI18n();

  // Toast
  let toastEl;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = tr(msg);
    toastEl.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove('show'), 2200);
  }

  function fmtINR(p) { if (!p) return 'Free'; return '₹ ' + (p / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 }); }
  function fmtTime(iso) { return new Date(iso).toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }); }

  // dashboard.js calls api._state() — we expose the rolling seed kept by
  // the dashboard itself plus the merged mobile state. The dashboard stores
  // its mutating seed under 'vl_cmcc_seed' (same as before), so this shim
  // returns it directly.
  function _state() {
    try { return JSON.parse(localStorage.getItem('vl_cmcc_seed') || '{}'); }
    catch { return {}; }
  }

  return { token, setToken, user, setUser, http, logout, toast, fmtINR, fmtTime, lang, setLang, t, tr, translateNode, pauseI18n, resumeI18n, _state };
})();
