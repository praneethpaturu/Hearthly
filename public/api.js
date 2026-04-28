// ─────────────────────────────────────────────────────────────────────
// Standalone client + mock backend
// ─────────────────────────────────────────────────────────────────────
// This file is the only runtime dependency for the three role pages.
// It exposes window.api (REST + Socket.IO + i18n + helpers) and runs
// an in-browser mock of the backend, IoT broker, and order state
// machine. State persists to localStorage so the demo survives reloads
// AND works inside an APK with no server.
// ─────────────────────────────────────────────────────────────────────

window.api = (() => {
  // ── i18n ───────────────────────────────────────────────────────────
  const dict = {
    EN: {
      services: 'Services', book: 'Book', confirm: 'Confirm booking',
      orders: 'My orders', noOrders: 'No orders yet — book a service to get started.',
      tracking: 'Tracking', notes: 'Notes for valet', schedule: 'Schedule',
      cancel: 'Cancel', rate: 'Rate', rateThanks: 'Thanks for your rating!',
      logout: 'Log out', tasks: "Today's tasks", start: 'Start', arrive: 'Mark arrived',
      scanRfid: 'Scan RFID', scanQr: 'Scan QR', complete: 'Complete', proof: 'Upload proof',
      flat: 'Flat', selectFlat: 'Select your flat',
    },
    HI: {
      services: 'सेवाएँ', book: 'बुक करें', confirm: 'बुकिंग पक्की करें',
      orders: 'मेरे ऑर्डर', noOrders: 'अभी कोई ऑर्डर नहीं — सेवा बुक करके शुरू करें।',
      tracking: 'ट्रैकिंग', notes: 'वैले के लिए नोट्स', schedule: 'समय',
      cancel: 'रद्द करें', rate: 'रेटिंग दें', rateThanks: 'धन्यवाद!',
      logout: 'लॉग आउट', tasks: 'आज के कार्य', start: 'शुरू करें', arrive: 'पहुँच गया',
      scanRfid: 'RFID स्कैन', scanQr: 'QR स्कैन', complete: 'पूरा करें', proof: 'प्रमाण अपलोड',
      flat: 'फ्लैट', selectFlat: 'अपना फ्लैट चुनें',
    },
    TE: {
      services: 'సేవలు', book: 'బుక్ చేయండి', confirm: 'బుకింగ్ నిర్ధారించండి',
      orders: 'నా ఆర్డర్లు', noOrders: 'ఇంకా ఆర్డర్లు లేవు — సేవ బుక్ చేయండి.',
      tracking: 'ట్రాకింగ్', notes: 'వాలెట్ కోసం గమనికలు', schedule: 'షెడ్యూల్',
      cancel: 'రద్దు చేయండి', rate: 'రేట్', rateThanks: 'ధన్యవాదాలు!',
      logout: 'లాగ్ అవుట్', tasks: 'నేటి పనులు', start: 'ప్రారంభించు', arrive: 'వచ్చాను',
      scanRfid: 'RFID స్కాన్', scanQr: 'QR స్కాన్', complete: 'పూర్తి', proof: 'రుజువు అప్‌లోడ్',
      flat: 'ఫ్లాట్', selectFlat: 'మీ ఫ్లాట్ ఎంచుకోండి',
    },
  };
  const LANG_KEY = 'vl_lang';
  const lang = () => localStorage.getItem(LANG_KEY) || 'EN';
  const setLang = (l) => { localStorage.setItem(LANG_KEY, l); location.reload(); };
  const t = (k) => (dict[lang()] && dict[lang()][k]) || dict.EN[k] || k;

  // ── Runtime EN→HI translation engine ───────────────────────────────
  // Comprehensive dictionary covering every user-visible string. Keyed
  // by the exact English text as it appears in the UI (whitespace
  // trimmed). The DOM walker + MutationObserver below auto-translate
  // every text node and key attribute, so ad-hoc strings rendered via
  // innerHTML are picked up without per-call wiring.
  const HI_DICT = {
    // ── Brand / roles ──────────────────────────────────────────
    'Hearthly': 'हर्थली',
    'Hearthly — Resident': 'हर्थली — निवासी',
    'Hearthly — Agent': 'हर्थली — एजेंट',
    'Hearthly — Admin': 'हर्थली — एडमिन',
    'Resident': 'निवासी',
    'Agent': 'एजेंट',
    'Admin': 'एडमिन',
    'Operator': 'संचालक',
    'Valet Agent': 'वैले एजेंट',
    'Aarav': 'आरव',
    'Ravi': 'रवि',
    'Priya': 'प्रिया',
    'Priya I': 'प्रिया आ',
    'Aarav Sharma': 'आरव शर्मा',
    'Ravi Kumar': 'रवि कुमार',
    'Priya Admin': 'प्रिया एडमिन',
    'Priya Iyer': 'प्रिया अय्यर',
    'Sandeep Rao': 'संदीप राव',
    'Rakhi Menon': 'राखी मेनन',
    'Faizan Ahmed': 'फैज़ान अहमद',
    'Akhila Reddy': 'अखिला रेड्डी',

    // ── Login flow ──────────────────────────────────────────────
    'Welcome': 'स्वागत है',
    'Welcome back': 'फिर से स्वागत है',
    'Operator sign-in': 'संचालक लॉगिन',
    'Verify your number': 'अपना नंबर सत्यापित करें',
    'Sign in with your phone number to manage home services': 'घर की सेवाओं के लिए अपने फ़ोन नंबर से साइन इन करें',
    'CMCC requires an operator account. Pick the Operator chip below.': 'CMCC के लिए संचालक खाता आवश्यक है। नीचे संचालक चिप चुनें।',
    'Sign in with your phone — we\'ll send a one-time code.': 'अपने फ़ोन से साइन इन करें — हम एक OTP भेजेंगे।',
    'Sign in to start work': 'काम शुरू करने के लिए साइन इन करें',
    'OTP-based login. Demo agent number is pre-filled.': 'OTP आधारित लॉगिन। डेमो एजेंट नंबर पहले से भरा है।',
    'Admin sign-in': 'एडमिन लॉगिन',
    'For property managers and operations staff.': 'प्रॉपर्टी मैनेजर और ऑपरेशन्स स्टाफ़ के लिए।',
    'Mobile number': 'मोबाइल नंबर',
    'Phone number': 'फ़ोन नंबर',
    'Phone': 'फ़ोन',
    'OTP': 'OTP',
    'One-time code': 'वन-टाइम कोड',
    'Enter 6-digit code': '6 अंकों का कोड दर्ज करें',
    'Send OTP': 'OTP भेजें',
    'Sending OTP via MSG91…': 'MSG91 से OTP भेजा जा रहा है…',
    'OTP sent': 'OTP भेजा गया',
    'Verify': 'सत्यापित करें',
    'Verifying…': 'सत्यापित हो रहा है…',
    'Verify & continue': 'सत्यापित करें और जारी रखें',
    'Verify & sign in': 'सत्यापित करें और साइन इन करें',
    'Change number': 'नंबर बदलें',
    'or sign in with': 'या इससे साइन इन करें',
    'Sign in with FaceID': 'FaceID से साइन इन करें',
    'Continue with Google': 'Google से जारी रखें',
    'Demo accounts': 'डेमो खाते',
    'All accounts use OTP': 'सभी खातों के लिए OTP',
    'By continuing you agree to our': 'जारी रखने पर आप हमारी',
    'Terms': 'शर्तों',
    'Privacy policy': 'गोपनीयता नीति',
    'Privacy & data consent': 'गोपनीयता और डेटा सहमति',
    'I consent & continue': 'मैं सहमत हूँ और जारी रखें',
    'I do not consent': 'मैं सहमत नहीं हूँ',
    'Consent recorded': 'सहमति दर्ज हुई',
    'OTP delivered via MSG91 · PCI-DSS · ap-south-1': 'OTP MSG91 के माध्यम से · PCI-DSS · ap-south-1',
    'Look at your phone…': 'अपना फ़ोन देखें…',
    'Recognised ✓': 'पहचाना गया ✓',
    'Mock Google sign-in → demo resident': 'मॉक Google साइन-इन → डेमो निवासी',
    'Enter a valid 10-digit Indian number': 'मान्य 10-अंकों का भारतीय नंबर दर्ज करें',
    'Auto-fill': 'ऑटो-फिल',
    'demo': 'डेमो',
    'Resend in': 'पुनः भेजें',
    'Resend OTP': 'OTP पुनः भेजें',
    'Signed in': 'साइन इन हुआ',
    'Demo:': 'डेमो:',

    // ── Common controls / nav ───────────────────────────────────
    'Cancel': 'रद्द करें',
    'Close': 'बंद करें',
    'Save': 'सहेजें',
    'Submit': 'जमा करें',
    'Continue': 'जारी रखें',
    'Confirm': 'पुष्टि करें',
    'Confirm booking': 'बुकिंग की पुष्टि करें',
    'OK': 'ठीक है',
    'Done': 'पूरा हुआ',
    'Back': 'वापस',
    'Next': 'आगे',
    'Skip': 'छोड़ें',
    'Edit': 'संपादित करें',
    'Update': 'अपडेट करें',
    'Delete': 'हटाएँ',
    'Add': 'जोड़ें',
    'Remove': 'हटाएँ',
    'Search': 'खोजें',
    'Loading…': 'लोड हो रहा है…',
    'Live': 'लाइव',
    'live': 'लाइव',
    'LIVE': 'लाइव',
    'Yes': 'हाँ',
    'No': 'नहीं',

    // ── Greetings / time-of-day ────────────────────────────────
    'Good morning': 'सुप्रभात',
    'Good afternoon': 'शुभ दोपहर',
    'Good evening': 'शुभ संध्या',

    // ── Resident — top tabs / app shell ────────────────────────
    'Services': 'सेवाएँ',
    'My orders': 'मेरे ऑर्डर',
    'Tracking': 'ट्रैकिंग',
    'Profile': 'प्रोफ़ाइल',
    'Set up your flat': 'अपना फ़्लैट सेट करें',
    'Pick the flat where the valet should arrive.': 'वह फ़्लैट चुनें जहाँ वैले को आना है।',
    'Flat': 'फ़्लैट',
    'Select your flat': 'अपना फ़्लैट चुनें',
    'Your name': 'आपका नाम',
    'Toggle theme': 'थीम बदलें',
    'theme': 'थीम',
    'Festival mode': 'त्योहार मोड',
    'festival': 'त्योहार',
    'Festival mode: DIWALI': 'त्योहार मोड: दिवाली',
    'Festival mode: HOLI': 'त्योहार मोड: होली',
    'Festival mode: PONGAL': 'त्योहार मोड: पोंगल',
    'Festival mode: NONE': 'त्योहार मोड: कोई नहीं',
    'logout': 'लॉगआउट',
    'Sign out': 'साइन आउट',
    'Log out': 'लॉग आउट',
    'Open profile menu': 'प्रोफ़ाइल मेनू खोलें',
    'menu': 'मेनू',
    'back': 'वापस',
    'close': 'बंद करें',
    'chat': 'चैट',
    'call': 'कॉल',
    'voice': 'आवाज़',
    'Voice booking': 'आवाज़ से बुकिंग',
    'mic': 'माइक',

    // ── Resident — home ────────────────────────────────────────
    'Book': 'बुक करें',
    'Book a service': 'सेवा बुक करें',
    'Recent': 'हाल के',
    'See all': 'सभी देखें',
    'Upcoming': 'आगामी',
    'Calendar': 'कैलेंडर',
    'No orders yet — book a service to get started.': 'अभी कोई ऑर्डर नहीं — शुरू करने के लिए सेवा बुक करें।',
    'No orders yet': 'अभी कोई ऑर्डर नहीं',
    'Nothing upcoming. Tap "Calendar" to set a recurring schedule.': 'कुछ आगामी नहीं। बार-बार होने वाला शेड्यूल बनाने के लिए "कैलेंडर" टैप करें।',
    'WEEKLY': 'साप्ताहिक',
    'UPCOMING': 'आगामी',
    'AUTO': 'स्वतः',

    // ── Resident — service catalog (names) ─────────────────────
    'Garbage Pickup': 'कचरा उठाव',
    'Laundry Pickup': 'कपड़े धुलाई पिकअप',
    'Car Wash': 'कार वॉश',
    'Grocery Pickup/Drop': 'किराना पिकअप/ड्रॉप',
    'Maintenance Request': 'रखरखाव अनुरोध',
    'Garbage': 'कचरा',
    'Laundry': 'कपड़े धुलाई',
    'Grocery': 'किराना',
    'Maintenance': 'रखरखाव',
    'From': 'से',
    'Free': 'मुफ़्त',
    'Aria': 'आरिया',
    'Visitor': 'विज़िटर',
    'Issue': 'समस्या',
    'Damage': 'क्षति',
    'Locker': 'लॉकर',
    'Valet wallet': 'वैले वॉलेट',
    '+ Add': '+ जोड़ें',
    'History': 'इतिहास',

    // ── Booking sheet ──────────────────────────────────────────
    'ETA': 'ETA',
    'Schedule': 'शेड्यूल',
    'Repeat weekly': 'हर हफ़्ते दोहराएँ',
    'Auto-book this every 7 days': 'इसे हर 7 दिन में स्वतः बुक करें',
    'Notes for valet': 'वैले के लिए नोट्स',
    'Leave at door / ring bell / call on arrival': 'दरवाज़े पर छोड़ दें / घंटी बजाएँ / पहुँचने पर कॉल करें',
    'Vehicle photo (optional · AI auto-detects plate)': 'वाहन की तस्वीर (वैकल्पिक · AI नंबर प्लेट पहचानेगा)',
    'Photo of laundry pile (optional · AI quotes)': 'कपड़ों के ढेर की तस्वीर (वैकल्पिक · AI कोट देगा)',
    'Reading plate…': 'प्लेट पढ़ी जा रही है…',
    'Could not read plate. Try a clearer photo.': 'प्लेट नहीं पढ़ी जा सकी। साफ़ तस्वीर लें।',
    'Counting items…': 'आइटम गिने जा रहे हैं…',
    'Order placed': 'ऑर्डर दिया गया',
    'Recurring schedule saved': 'बार-बार होने वाला शेड्यूल सहेजा गया',

    // ── Active / status badges ─────────────────────────────────
    'CREATED': 'बनाया गया',
    'ASSIGNED': 'सौंपा गया',
    'EN ROUTE': 'रास्ते में',
    'EN_ROUTE': 'रास्ते में',
    'ARRIVED': 'पहुँच गया',
    'IN PROGRESS': 'प्रगति में',
    'IN_PROGRESS': 'प्रगति में',
    'COMPLETED': 'पूरा हुआ',
    'CANCELLED': 'रद्द',
    'OPEN': 'खुला',
    'ACK': 'स्वीकार',
    'RESOLVED': 'हल हुआ',
    'ESCALATED': 'एस्केलेटेड',
    'MONITORING': 'निगरानी',
    'ACTIVE': 'सक्रिय',
    'CONTAINED': 'नियंत्रित',
    'verified': 'सत्यापित',
    'Verified': 'सत्यापित',
    'Flagged': 'फ़्लैग किया',
    'Cancelled': 'रद्द',
    'Cancel order': 'ऑर्डर रद्द करें',
    'Cancelled': 'रद्द किया गया',
    'breached': 'उल्लंघन',

    // ── Order row & detail ─────────────────────────────────────
    'View proof': 'प्रमाण देखें',
    'Tip ₹': 'टिप ₹',
    'Tip': 'टिप',
    'Report': 'शिकायत',
    'Rate': 'रेटिंग',
    'Rate this service': 'इस सेवा को रेट करें',
    'Rate service': 'सेवा को रेट करें',
    'Add a comment (optional)': 'टिप्पणी जोड़ें (वैकल्पिक)',
    'Tell us how it went': 'बताइए अनुभव कैसा रहा',
    'Submit rating': 'रेटिंग सबमिट करें',
    'Thanks for your rating!': 'रेटिंग के लिए धन्यवाद!',
    'Rating saved': 'रेटिंग सहेजी गई',
    'Tip your agent': 'अपने एजेंट को टिप दें',
    '100% goes to': '100%',
    'the agent': 'एजेंट को मिलता है',
    'Custom amount': 'कस्टम राशि',
    'Send tip': 'टिप भेजें',
    'No thanks': 'नहीं चाहिए',
    'Tip sent': 'टिप भेजी गई',
    'Order ID': 'ऑर्डर ID',
    'Amount': 'राशि',
    'Total': 'कुल',
    'Notes': 'नोट्स',
    'Your rating': 'आपकी रेटिंग',
    'Method': 'तरीका',
    'Razorpay txn': 'Razorpay लेनदेन',
    'Receipt': 'रसीद',
    'Tap to download': 'डाउनलोड के लिए टैप करें',
    'Proof of service': 'सेवा का प्रमाण',
    'No image stored': 'कोई छवि सहेजी नहीं गई',
    'Details': 'विवरण',
    'Timeline': 'समयरेखा',
    'Payment': 'भुगतान',
    'Complaint': 'शिकायत',
    'Ticket': 'टिकट',
    'Category': 'श्रेणी',
    'Status': 'स्थिति',

    // ── Tracking ───────────────────────────────────────────────
    'Demo view — book a service for live updates': 'डेमो दृश्य — लाइव अपडेट के लिए सेवा बुक करें',
    'Connecting via Exotel…': 'Exotel के माध्यम से कनेक्ट हो रहा है…',
    'Call connected': 'कॉल कनेक्ट हुई',
    'KYC': 'KYC',
    'KYC by Digio': 'Digio द्वारा KYC',

    // ── Wallet ─────────────────────────────────────────────────
    'Wallet': 'वॉलेट',
    'Balance': 'शेष',
    'Transactions': 'लेनदेन',
    'Initial topup': 'आरंभिक टॉप-अप',
    'Cashback bonus': 'कैशबैक बोनस',
    'Tip to': 'टिप',
    'Wallet topup': 'वॉलेट टॉप-अप',
    'Wallet topped up': 'वॉलेट में राशि जोड़ी गई',
    'Wallet topup (Aria)': 'वॉलेट टॉप-अप (आरिया)',
    '₹500 added': '₹500 जोड़े गए',

    // ── Subscription plans ─────────────────────────────────────
    'Choose your plan': 'अपना प्लान चुनें',
    'Save more with a monthly subscription.': 'मासिक सदस्यता पर अधिक बचत करें।',
    'Bronze': 'ब्रॉन्ज़',
    'Silver': 'सिल्वर',
    'Gold': 'गोल्ड',
    'Plans & subscriptions': 'प्लान और सदस्यता',
    '⭐ Plans & subscriptions': '⭐ प्लान और सदस्यता',
    'Unlimited garbage': 'असीमित कचरा',
    '4 garbage pickups': '4 कचरा पिकअप',
    'Standard support': 'मानक सहायता',
    '2 free laundry pickups': '2 मुफ़्त कपड़े धुलाई पिकअप',
    'Priority support': 'प्राथमिकता सहायता',
    'All Silver features': 'सभी सिल्वर सुविधाएँ',
    '1 free car wash/week': '1 मुफ़्त कार वॉश/सप्ताह',
    'Dedicated valet': 'समर्पित वैले',
    '20% off all services': 'सभी सेवाओं पर 20% छूट',
    'Plan upgraded': 'प्लान अपग्रेड हुआ',
    'Welcome to': 'स्वागत है',

    // ── Visitor pre-approval ───────────────────────────────────
    'Pre-approve visitor': 'विज़िटर को पूर्व-अनुमति दें',
    'Generate a QR for the gate. Valid for 24h.': 'गेट के लिए QR बनाएँ। 24 घंटे तक मान्य।',
    'Visitor name': 'विज़िटर का नाम',
    'When': 'कब',
    'Now': 'अभी',
    'In 1 hour': '1 घंटे में',
    'This evening': 'आज शाम',
    'Tomorrow morning': 'कल सुबह',
    'Purpose': 'उद्देश्य',
    'Delivery': 'डिलीवरी',
    'Service': 'सेवा',
    'Guest': 'अतिथि',
    'Cab': 'कैब',
    'Generate QR': 'QR बनाएँ',
    'Visitor pass ready': 'विज़िटर पास तैयार',
    'Show this QR at the gate': 'यह QR गेट पर दिखाएँ',
    'Valid until': 'तक मान्य',
    'Share': 'साझा करें',
    'Shared': 'साझा किया गया',

    // ── Locker ─────────────────────────────────────────────────
    'Smart locker code': 'स्मार्ट लॉकर कोड',
    'Tell your delivery to drop the package in locker': 'अपने डिलीवरी वाले को कहें कि पैकेज लॉकर में रखें',
    'using this code.': 'इस कोड का उपयोग करके।',
    'UNLOCK CODE': 'अनलॉक कोड',
    'Locker': 'लॉकर',
    'valid until': 'तक मान्य',
    'Share with delivery': 'डिलीवरी के साथ साझा करें',
    'Locker code shared': 'लॉकर कोड साझा किया गया',

    // ── Damage report ──────────────────────────────────────────
    'Report damage': 'क्षति की रिपोर्ट करें',
    'Snap a photo of the damaged item — AI suggests compensation.': 'क्षतिग्रस्त वस्तु की तस्वीर लें — AI मुआवज़ा सुझाएगा।',
    'Photo': 'तस्वीर',
    'Analyse with AI': 'AI से विश्लेषण करें',
    'Analysing…': 'विश्लेषण हो रहा है…',
    'Refund credited': 'रिफ़ंड क्रेडिट हुआ',

    // ── Photo issue ─────────────────────────────────────────────
    'Report an issue': 'समस्या की रिपोर्ट करें',
    'Snap a photo — we\'ll suggest a service.': 'तस्वीर लें — हम सेवा सुझाएँगे।',
    'Book service': 'सेवा बुक करें',

    // ── DPDP / privacy ─────────────────────────────────────────
    'Privacy & data consent': 'गोपनीयता और डेटा सहमति',
    'Per India\'s Digital Personal Data Protection Act 2023, we need your explicit consent.': 'भारत के डिजिटल पर्सनल डेटा प्रोटेक्शन अधिनियम 2023 के अनुसार, हमें आपकी स्पष्ट सहमति चाहिए।',
    'Export my data (DPDP)': 'मेरा डेटा एक्सपोर्ट करें (DPDP)',
    'Delete my data': 'मेरा डेटा हटाएँ',
    'Data exported (DPDP-compliant)': 'डेटा एक्सपोर्ट किया गया (DPDP-अनुपालित)',
    'Data deleted': 'डेटा हटा दिया गया',
    'Verification cancelled': 'सत्यापन रद्द',
    'data deletion': 'डेटा हटाना',

    // ── Aria assistant ─────────────────────────────────────────
    'Your home-services assistant. Try: "Book my usual laundry", "What\'s my balance?", "Cancel my last order".': 'आपका होम-सर्विसेज़ सहायक। आज़माएँ: "मेरी रोज़ की लॉन्ड्री बुक करें", "मेरा बैलेंस क्या है?", "मेरा पिछला ऑर्डर रद्द करें"।',
    'Book my usual': 'मेरी रोज़ की बुकिंग',
    "What's my schedule?": 'मेरा शेड्यूल क्या है?',
    'Top up wallet ₹500': 'वॉलेट में ₹500 जोड़ें',
    'Cancel my last order': 'मेरा पिछला ऑर्डर रद्द करें',
    'Show ESG savings': 'ESG बचत दिखाएँ',
    'Ask anything…': 'कुछ भी पूछें…',
    'Ask': 'पूछें',
    "Hi! I'm Aria. Ask me to book, cancel, top up your wallet, or anything else.": 'नमस्ते! मैं आरिया हूँ। मुझसे बुक करने, रद्द करने, वॉलेट टॉप-अप या कुछ भी पूछें।',
    'I can book a service, cancel your last order, top up your wallet, or show your schedule. What would you like?': 'मैं सेवा बुक कर सकती हूँ, आपका पिछला ऑर्डर रद्द कर सकती हूँ, वॉलेट टॉप-अप कर सकती हूँ, या आपका शेड्यूल दिखा सकती हूँ। आप क्या करना चाहेंगे?',
    'Done!': 'हो गया!',
    'Payment cancelled.': 'भुगतान रद्द।',
    'Payment cancelled': 'भुगतान रद्द',
    'Payment received': 'भुगतान प्राप्त',
    'Couldn\'t top up': 'टॉप-अप नहीं हो सका',
    'No upcoming orders.': 'कोई आगामी ऑर्डर नहीं।',
    'Upcoming:': 'आगामी:',
    "You don't have a cancellable order.": 'आपके पास रद्द किए जा सकने वाला कोई ऑर्डर नहीं है।',

    // ── Voice booking ──────────────────────────────────────────
    'Book by voice': 'आवाज़ से बुक करें',
    'Tap the mic and speak in English, हिन्दी, or తెలుగు. e.g. "tomorrow morning 8 am, garbage pickup".': 'माइक टैप करें और English, हिन्दी, या తెలుగు में बोलें। उदा. "कल सुबह 8 बजे, कचरा उठाव"।',
    'Listening… tap to stop': 'सुन रहा है… रोकने के लिए टैप करें',
    'Transcribing…': 'ट्रांसक्राइब हो रहा है…',
    'You said:': 'आपने कहा:',
    'Detected:': 'पहचाना गया:',
    "Couldn't map to a service.": 'किसी सेवा से मेल नहीं हुआ।',
    'Microphone permission needed': 'माइक्रोफ़ोन अनुमति आवश्यक',
    'confidence': 'विश्वास',

    // ── Voice biometric ─────────────────────────────────────────
    'Voice verification': 'आवाज़ सत्यापन',
    'Listening…': 'सुन रहा है…',
    'Capturing voiceprint…': 'वॉइसप्रिंट कैप्चर हो रहा है…',
    'Matching against enrolled sample…': 'दर्ज नमूने से मिलान…',

    // ── Smart usual / weather / coalition ──────────────────────
    'Predicted from your last': 'आपके पिछले',
    'bookings': 'बुकिंग से अनुमानित',
    'Suggested for': 'सुझाव:',
    'Book in 1 tap': '1 टैप में बुक करें',
    'One-tap booking': 'वन-टैप बुकिंग',
    'confirmed': 'पुष्टि की गई',
    'Rain expected at 3 PM': 'दोपहर 3 बजे बारिश की संभावना',
    'Pleasant morning, perfect for car wash': 'सुहावनी सुबह, कार वॉश के लिए उत्तम',
    'Cooler evening, ideal for laundry pickup': 'ठंडी शाम, कपड़े धुलाई के लिए आदर्श',
    'Hot afternoon — good time to schedule indoor services': 'गर्म दोपहर — इनडोर सेवाओं का समय',
    'Reschedule': 'पुनर्निर्धारित करें',
    'Book now': 'अभी बुक करें',
    'Order': 'ऑर्डर',
    'suggested': 'सुझाया गया',
    'neighbours': 'पड़ोसी',
    'have booked today — book now to save': 'ने आज बुक किया — बचत के लिए अभी बुक करें',
    'save': 'बचाएँ',
    'Group buy unlocks at': 'ग्रुप-बाइ अनलॉक होगा',
    'bookings · saves': 'बुकिंग पर · बचत',

    // ── ESG ─────────────────────────────────────────────────────
    'CO₂ saved this month': 'इस महीने बचा CO₂',
    'tree-months': 'पेड़-महीने',
    'top': 'टॉप',
    'in your community': 'आपके समुदाय में',
    '-week streak': '-सप्ताह स्ट्रीक',
    'Eco-hero': 'इको-हीरो',
    'Segregator': 'पृथक्करण',

    // ── Onboarding tour titles (resident) ──────────────────────
    'Welcome to Hearthly': 'हर्थली में स्वागत है',
    'Book home services, track agents live, pay via UPI — all in one app.': 'घर की सेवाएँ बुक करें, एजेंटों को लाइव ट्रैक करें, UPI से भुगतान करें — सब एक ही ऐप में।',
    'Aria · your assistant': 'आरिया · आपकी सहायक',
    'Tap "Aria" on Home and ask in English / हिन्दी / తెలుగు: "Book my usual laundry", "Top up wallet ₹500".': 'होम पर "आरिया" टैप करें और English / हिन्दी / తెలుగు में पूछें: "मेरी रोज़ की लॉन्ड्री बुक करें", "वॉलेट में ₹500 जोड़ें"।',
    'Live tracking': 'लाइव ट्रैकिंग',
    'After booking, the Track tab shows your agent on a real map with ETA. Chat or call them with one tap.': 'बुकिंग के बाद, ट्रैक टैब असली मैप पर आपके एजेंट और ETA दिखाएगा। एक टैप से चैट या कॉल करें।',
    'Earn ESG points': 'ESG पॉइंट कमाएँ',
    'Each pickup saves CO₂ — climb the community leaderboard, unlock streak badges.': 'हर पिकअप CO₂ बचाता है — समुदाय लीडरबोर्ड पर चढ़ें, स्ट्रीक बैज पाएँ।',
    'Recurring schedules': 'बार-बार होने वाले शेड्यूल',
    'Toggle "Repeat weekly" while booking and we will auto-book it for you.': 'बुकिंग करते समय "हर हफ़्ते दोहराएँ" चालू करें, हम स्वतः बुक करेंगे।',
    'Got it!': 'समझ गया!',

    // ── Tour (agent) ────────────────────────────────────────────
    'Welcome on board': 'स्वागत है',
    'You are KYC-verified and ready to take tasks. Stay Online to receive auto-assigned pickups.': 'आप KYC-सत्यापित हैं और कार्य लेने के लिए तैयार हैं। ऑटो-असाइन्ड पिकअप पाने के लिए ऑनलाइन रहें।',
    'Your task flow': 'आपकी कार्य प्रक्रिया',
    'Each task: Start → Mark arrived → Scan RFID/QR → Complete with photo proof. Status syncs live.': 'हर कार्य: शुरू करें → पहुँच गया → RFID/QR स्कैन → फ़ोटो प्रमाण के साथ पूरा करें। स्थिति लाइव सिंक होती है।',
    'AI verifies your work': 'AI आपके काम को सत्यापित करता है',
    'Upload a photo when completing — AI confirms quality so you get rated fairly.': 'पूरा करते समय फ़ोटो अपलोड करें — AI गुणवत्ता की पुष्टि करता है ताकि आपको उचित रेटिंग मिले।',
    'Earn tips & ratings': 'टिप और रेटिंग कमाएँ',
    'Polite agents earn higher ratings, recurring assignments, and bigger tips.': 'विनम्र एजेंट अधिक रेटिंग, बार-बार असाइनमेंट और अधिक टिप पाते हैं।',

    // ── Tour (admin) ────────────────────────────────────────────
    'Community admin': 'समुदाय एडमिन',
    'Manage everything in your community: bins, agents, residents, complaints, OTA, AI insights.': 'अपने समुदाय में सब कुछ प्रबंधित करें: बिन, एजेंट, निवासी, शिकायतें, OTA, AI इनसाइट।',
    'Live IoT': 'लाइव IoT',
    'Tap any bin to simulate fill level via MQTT — orders auto-create at 80% threshold.': 'किसी भी बिन पर टैप करें ताकि MQTT से फ़िल लेवल सिमुलेट हो — 80% पर ऑर्डर स्वतः बनेंगे।',
    'AI assistant': 'AI सहायक',
    'Ask plain-English questions: "which bins fill fastest?", "complaints by category".': 'सादे अंग्रेज़ी प्रश्न पूछें: "कौन से बिन सबसे जल्दी भरते हैं?", "श्रेणी के अनुसार शिकायतें"।',
    'Open CMCC': 'CMCC खोलें',
    'For network-wide ops, tap CMCC ↗ in the top bar — opens the centralised monitoring console.': 'नेटवर्क-वाइड ऑपरेशन्स के लिए, टॉप बार में CMCC ↗ टैप करें — केंद्रीकृत मॉनिटरिंग कंसोल खुलेगा।',

    // ── Tasks (agent) ───────────────────────────────────────────
    "Today's tasks": 'आज के कार्य',
    'open': 'खुले',
    'completed today': 'आज पूरे',
    'Open': 'खुले',
    'Done today': 'आज पूरे',
    'Earnings': 'कमाई',
    'Current task': 'वर्तमान कार्य',
    'Up next': 'आगे',
    'All clear!': 'सब ठीक!',
    'No open tasks. Bins fill automatically — wait for an auto-assigned pickup, or have the resident book a service.': 'कोई खुला कार्य नहीं। बिन स्वतः भरते हैं — ऑटो-असाइन्ड पिकअप का इंतज़ार करें या निवासी से सेवा बुक करवाएँ।',
    'Note:': 'नोट:',
    'Door RFID:': 'दरवाज़े का RFID:',
    'Start': 'शुरू करें',
    'Mark arrived': 'पहुँच गया',
    'Scan RFID': 'RFID स्कैन करें',
    'Scan QR': 'QR स्कैन करें',
    'Complete': 'पूरा करें',
    'Upload proof': 'प्रमाण अपलोड करें',
    'No RFID tag — use QR fallback': 'कोई RFID टैग नहीं — QR का उपयोग करें',
    'RFID verified': 'RFID सत्यापित',
    'Started — sharing live location': 'शुरू — लाइव स्थान साझा हो रहा है',
    'Online': 'ऑनलाइन',
    'Offline': 'ऑफ़लाइन',
    'Now online': 'अब ऑनलाइन',
    'Going offline': 'ऑफ़लाइन हो रहा है',
    'New task:': 'नया कार्य:',
    'Tasks': 'कार्य',
    'past tasks': 'पिछले कार्य',
    'No past tasks yet.': 'अभी कोई पिछले कार्य नहीं।',
    'Me': 'मैं',
    'Total tasks': 'कुल कार्य',
    'Rating': 'रेटिंग',
    'Capture proof of service': 'सेवा का प्रमाण कैप्चर करें',
    'Photo (camera or gallery)': 'तस्वीर (कैमरा या गैलरी)',
    'Verify & complete': 'सत्यापित करें और पूरा करें',
    'Uploading…': 'अपलोड हो रहा है…',
    'AI verifying…': 'AI सत्यापित कर रहा है…',
    'Service completed': 'सेवा पूरी हुई',
    'AI verified ✓': 'AI सत्यापित ✓',
    'flagged for review': 'समीक्षा हेतु फ़्लैग',

    // ── Scan / QR prompt ───────────────────────────────────────
    'Scan QR': 'QR स्कैन करें',
    'Point camera at the door QR — or paste code': 'कैमरा दरवाज़े के QR पर रखें — या कोड पेस्ट करें',
    'QR code': 'QR कोड',

    // ── Scheduling / calendar ──────────────────────────────────
    'Recurring schedules': 'बार-बार होने वाले शेड्यूल',
    'No recurring schedules yet.': 'अभी कोई बार-बार होने वाला शेड्यूल नहीं।',
    '+ New recurring schedule': '+ नया बार-बार होने वाला शेड्यूल',
    'New recurring schedule': 'नया बार-बार होने वाला शेड्यूल',
    'Auto-books every week at the chosen time.': 'चुने गए समय पर हर हफ़्ते स्वतः बुक करता है।',
    'Day of week': 'सप्ताह का दिन',
    'Time': 'समय',
    'Notes (optional)': 'नोट्स (वैकल्पिक)',
    'e.g. ring bell, leave at door': 'उदा. घंटी बजाएँ, दरवाज़े पर छोड़ें',
    'Save schedule': 'शेड्यूल सहेजें',
    'Schedule saved': 'शेड्यूल सहेजा गया',
    'Schedule deleted': 'शेड्यूल हटाया गया',
    'Schedule added': 'शेड्यूल जोड़ा गया',
    'Every': 'हर',
    'item scheduled': 'आइटम शेड्यूल',
    'items scheduled': 'आइटम शेड्यूल',
    'Nothing scheduled. Tap below to add a recurring service.': 'कुछ शेड्यूल नहीं। नीचे टैप करके बार-बार होने वाली सेवा जोड़ें।',
    '+ Add recurring': '+ बार-बार जोड़ें',
    'recurring': 'बार-बार',
    'one-off': 'एक बार',
    'Mon': 'सोम',
    'Tue': 'मंगल',
    'Wed': 'बुध',
    'Thu': 'गुरु',
    'Fri': 'शुक्र',
    'Sat': 'शनि',
    'Sun': 'रवि',

    // ── Push / notifications ───────────────────────────────────
    'Notifications': 'सूचनाएँ',
    'Mark all read': 'सभी को पढ़ा हुआ करें',
    'Clear': 'साफ़ करें',
    'delivered via FCM': 'FCM से भेजी गई',
    'No notifications yet.': 'अभी कोई सूचना नहीं।',
    'No notifications.': 'कोई सूचना नहीं।',

    // ── Chat ────────────────────────────────────────────────────
    'Chat with': 'चैट करें',
    'your agent': 'आपके एजेंट से',
    'Messages relayed via Exotel — your number stays private.': 'संदेश Exotel के माध्यम से भेजे जाते हैं — आपका नंबर निजी रहता है।',
    'Type a message…': 'संदेश लिखें…',
    'Send': 'भेजें',
    'Where are you?': 'आप कहाँ हैं?',
    'Please ring bell': 'कृपया घंटी बजाएँ',
    'OK come up': 'ठीक है, ऊपर आइए',
    'Thanks': 'धन्यवाद',
    'Say hi!': 'हाय कहें!',
    'Agent replied': 'एजेंट ने जवाब दिया',
    'Just exited the lift on your floor': 'अभी आपकी मंज़िल पर लिफ़्ट से उतरा',
    'Walking up — 30 seconds away': 'चलकर आ रहा हूँ — 30 सेकंड दूर',
    'Will do, ringing now': 'अभी घंटी बजाता हूँ',
    'Coming up, please open the door': 'आ रहा हूँ, कृपया दरवाज़ा खोलें',
    "Thank you ma'am, please rate me!": 'धन्यवाद मैम, कृपया रेटिंग दें!',
    'Acknowledged.': 'स्वीकार।',
    'On my way.': 'रास्ते में हूँ।',
    'Will do.': 'कर दूँगा।',
    'Got it, thanks.': 'समझ गया, धन्यवाद।',

    // ── Razorpay ────────────────────────────────────────────────
    'Razorpay': 'Razorpay',
    'Secure UPI checkout': 'सुरक्षित UPI चेकआउट',
    'PAYING TO': 'भुगतान',
    'AMOUNT': 'राशि',
    'Order id:': 'ऑर्डर आईडी:',
    'Pay ₹': 'भुगतान ₹',
    'Pay': 'भुगतान करें',
    'Verifying signature…': 'हस्ताक्षर सत्यापित हो रहा है…',
    'PCI-DSS · DPDP Act 2023 compliant · ap-south-1': 'PCI-DSS · DPDP अधिनियम 2023 अनुपालित · ap-south-1',
    'UPI': 'UPI',

    // ── Complaint ───────────────────────────────────────────────
    'What happened?': 'क्या हुआ?',
    'Describe the issue': 'समस्या का वर्णन करें',
    'Quality of service': 'सेवा की गुणवत्ता',
    'Damage / loss': 'क्षति / हानि',
    'Late arrival': 'देर से पहुँचना',
    'Behavior': 'व्यवहार',
    'Billing': 'बिलिंग',
    'Complaint received': 'शिकायत प्राप्त',
    'Complaint resolved': 'शिकायत हल',
    'Escalated': 'एस्केलेटेड',
    'Resolve': 'हल करें',
    'Escalate': 'एस्केलेट करें',
    'Complaint queue': 'शिकायत कतार',
    'open · auto-escalate at SLA breach': 'खुली · SLA उल्लंघन पर ऑटो-एस्केलेट',
    'No open complaints. SLAs are healthy.': 'कोई खुली शिकायत नहीं। SLA ठीक हैं।',
    'left': 'बचा',

    // ── Admin specific ──────────────────────────────────────────
    'Admin console': 'एडमिन कंसोल',
    'Complaints': 'शिकायतें',
    'Leaderboard': 'लीडरबोर्ड',
    'Daily ops digest': 'दैनिक ऑप्स डाइजेस्ट',
    'Total orders': 'कुल ऑर्डर',
    'Active': 'सक्रिय',
    'Completed today': 'आज पूरे',
    'Devices online': 'डिवाइस ऑनलाइन',
    'Full bins ≥80%': 'भरे बिन ≥80%',
    'Smart bins': 'स्मार्ट बिन',
    'Click any bin to set its fill level. Crossing 80% auto-creates a pickup order. Edge AI classifies bin contents for ESG reporting.': 'फ़िल लेवल सेट करने के लिए किसी भी बिन पर क्लिक करें। 80% पार करने पर पिकअप ऑर्डर स्वतः बनेगा। एज AI ESG रिपोर्टिंग के लिए बिन सामग्री का वर्गीकरण करता है।',
    'organic': 'जैविक',
    'recyclable': 'पुनर्चक्रण योग्य',
    'edge-AI': 'एज-AI',
    'System health': 'सिस्टम स्वास्थ्य',
    'All services live. Backed by AWS ap-south-1 (Mumbai).': 'सभी सेवाएँ लाइव। AWS ap-south-1 (मुंबई) पर।',
    'API TLS': 'API TLS',
    'TLS 1.3': 'TLS 1.3',
    'MQTT': 'MQTT',
    'mTLS · per-device cert': 'mTLS · प्रति-डिवाइस सर्ट',
    'DB': 'DB',
    'Postgres + 2 replicas': 'Postgres + 2 रेप्लिका',
    'Redis': 'Redis',
    'Cluster · 3 nodes': 'क्लस्टर · 3 नोड',
    'Queue lag': 'क्यू लैग',
    'Audit log': 'ऑडिट लॉग',
    'tamper-evident': 'छेड़छाड़-स्पष्ट',
    'DPDP consent': 'DPDP सहमति',
    '98% residents': '98% निवासी',
    'CERT-In hook': 'CERT-In हुक',
    'armed': 'सक्रिय',
    'Anomalies': 'विसंगतियाँ',
    'ML alerts on bin telemetry & agent behaviour.': 'बिन टेलीमेट्री और एजेंट व्यवहार पर ML अलर्ट।',
    'No anomalies in the last hour.': 'पिछले घंटे में कोई विसंगति नहीं।',
    'Predictive maintenance': 'पूर्वानुमान रखरखाव',
    'Battery health & failure forecast per device.': 'प्रति-डिवाइस बैटरी स्वास्थ्य और विफलता पूर्वानुमान।',
    'Device': 'डिवाइस',
    'Battery': 'बैटरी',
    'Sensor drift': 'सेंसर ड्रिफ़्ट',
    'Failure ETA': 'विफलता ETA',
    'days': 'दिन',
    'RFID scanner': 'RFID स्कैनर',
    'Simulate a tag swipe at the gate scanner.': 'गेट स्कैनर पर टैग स्वाइप का सिमुलेशन।',
    'No active EN_ROUTE / ARRIVED tasks. Start one from the Agent window.': 'कोई सक्रिय EN_ROUTE / ARRIVED कार्य नहीं। एजेंट विंडो से शुरू करें।',
    'RFID tag': 'RFID टैग',
    'Publish scan via MQTT': 'MQTT से स्कैन प्रकाशित करें',
    'Scan published': 'स्कैन प्रकाशित',
    'Firmware OTA': 'फ़र्मवेयर OTA',
    'Per-device firmware versions. OTA updates signed with Ed25519.': 'प्रति-डिवाइस फ़र्मवेयर संस्करण। OTA अपडेट Ed25519 से हस्ताक्षरित।',
    'Type': 'प्रकार',
    'Firmware': 'फ़र्मवेयर',
    'update available': 'अपडेट उपलब्ध',
    'current': 'वर्तमान',
    'Schedule OTA': 'OTA शेड्यूल करें',
    'Schedule update': 'अपडेट शेड्यूल करें',
    'OTA scheduled': 'OTA शेड्यूल हुआ',
    'Version': 'संस्करण',
    'now': 'अभी',
    'tonight 2 AM': 'आज रात 2 बजे',
    'this weekend': 'इस सप्ताहांत',
    'mock': 'मॉक',
    'Ask anything about your community in plain English. e.g. "which bins filled fastest today?", "complaints by category", "agents with low ratings".': 'अपने समुदाय के बारे में सादे अंग्रेज़ी में पूछें। उदा. "आज कौन से बिन सबसे जल्दी भरे?", "श्रेणी के अनुसार शिकायतें", "कम रेटिंग वाले एजेंट"।',
    'Ask about orders, devices, complaints…': 'ऑर्डर, डिवाइस, शिकायतों के बारे में पूछें…',
    'Key': 'कुंजी',
    'Live agent positions': 'लाइव एजेंट स्थान',
    'No active agent telemetry yet — start a task in the Agent window.': 'अभी कोई सक्रिय एजेंट टेलीमेट्री नहीं — एजेंट विंडो में कार्य शुरू करें।',
    'Community': 'समुदाय',
    'Bangalore': 'बेंगलुरु',
    'Hyderabad': 'हैदराबाद',
    'Mumbai': 'मुंबई',
    'Pune': 'पुणे',
    'Delhi NCR': 'दिल्ली NCR',
    'Chennai': 'चेन्नई',
    'Kolkata': 'कोलकाता',
    'Ahmedabad': 'अहमदाबाद',
    'Flats': 'फ़्लैट',
    'Devices': 'डिवाइस',
    'All orders': 'सभी ऑर्डर',
    'No orders yet.': 'अभी कोई ऑर्डर नहीं।',
    'Where': 'कहाँ',
    'Created': 'बनाया',
    'Now viewing': 'अभी देख रहे हैं',
    'Community switched': 'समुदाय बदला',
    'OpenAI key': 'OpenAI कुंजी',
    'OpenAI API key': 'OpenAI API कुंजी',
    'Stored only on this device': 'केवल इस डिवाइस पर सहेजा',
    'Stored only on this device · sent only to api.openai.com': 'केवल इस डिवाइस पर सहेजा · केवल api.openai.com को भेजा',
    'Key saved': 'कुंजी सहेजी',
    'Key cleared': 'कुंजी हटाई',
    'Connect this device to CMCC': 'इस डिवाइस को CMCC से कनेक्ट करें',
    'Server URL where the CMCC is running. Current device id:': 'CMCC जिस सर्वर URL पर चल रहा है। वर्तमान डिवाइस ID:',
    'Sync URL': 'सिंक URL',
    'Connect': 'कनेक्ट करें',
    'Connected to': 'कनेक्ट हुआ',
    'Disconnected': 'डिस्कनेक्ट हुआ',
    'Connect to CMCC': 'CMCC से कनेक्ट करें',
    '📡 Connect to CMCC': '📡 CMCC से कनेक्ट करें',
    'CONNECTED': 'कनेक्टेड',
    'OFFLINE': 'ऑफ़लाइन',
    'ONLINE': 'ऑनलाइन',
    'Set OpenAI key for voice booking': 'आवाज़-बुकिंग के लिए OpenAI कुंजी सेट करें',
    'OpenAI key set (tap to change)': 'OpenAI कुंजी सेट है (बदलने के लिए टैप करें)',

    // ── Leaderboard ─────────────────────────────────────────────
    'Agent leaderboard': 'एजेंट लीडरबोर्ड',
    'This week · top performers across the community': 'इस सप्ताह · समुदाय में शीर्ष प्रदर्शनकर्ता',
    'services': 'सेवाएँ',

    // ── Anomaly types ────────────────────────────────────────────
    'POSSIBLE_THEFT': 'संभावित चोरी',
    'SUDDEN_FILL': 'अचानक भरना',
    'GHOST_COMPLETION': 'घोस्ट पूर्णता',
    'AGENT_IDLE': 'एजेंट निष्क्रिय',
    'DEVICE_OFFLINE': 'डिवाइस ऑफ़लाइन',
    'SLA_BREACH': 'SLA उल्लंघन',
    'PAYMENT_RECONCILE_FAIL': 'भुगतान सुलह विफल',
    'BATTERY_LOW': 'बैटरी कम',
    'HIGH_VOLUME': 'उच्च मात्रा',
    'BIN_THEFT_SUSPECTED': 'बिन चोरी संदिग्ध',
    'Possible ghost completion': 'संभावित घोस्ट पूर्णता',
    'Audit photo proof + RFID log': 'फ़ोटो प्रमाण + RFID लॉग की ऑडिट करें',
    'Inspect bin / verify sensor': 'बिन निरीक्षण / सेंसर सत्यापित करें',
    'Dispatch security to bin': 'बिन के लिए सुरक्षा भेजें',

    // ── Index landing ───────────────────────────────────────────
    '🇮🇳 Telangana · Real-Time Governance': '🇮🇳 तेलंगाना · रियल-टाइम गवर्नेंस',
    'Hearthly · Real-Time Governance for Telangana': 'हर्थली · तेलंगाना के लिए रियल-टाइम गवर्नेंस',
    'Sanitation Worker app': 'सफ़ाई कर्मचारी ऐप',
    'Daily route, RFID/QR scan to confirm pickup, photo proof, complete with AI verification, attendance + welfare tracking.': 'दैनिक रूट, पिकअप पुष्टि के लिए RFID/QR स्कैन, फ़ोटो प्रमाण, AI सत्यापन के साथ पूर्णता, उपस्थिति + कल्याण ट्रैकिंग।',
    'Citizen Portal & App': 'नागरिक पोर्टल और ऐप',
    'Report a civic issue in 30s. Track grievance. Get welfare scheme alerts. Pay municipal bills. Multi-language (Telugu / Hindi / English / Urdu).': '30 सेकंड में नागरिक समस्या दर्ज करें। शिकायत ट्रैक करें। कल्याण योजना अलर्ट पाएँ। नगर बिल भरें। बहु-भाषा (तेलुगु / हिंदी / अंग्रेज़ी / उर्दू)।',
    'Public · opens citizen portal · also': 'सार्वजनिक · नागरिक पोर्टल खोलता है · और',
    'in app': 'ऐप में',
    'Ward Officer dashboard': 'वार्ड अधिकारी डैशबोर्ड',
    'Per-community / ward IoT health, grievance assignment, smart-bin status, anomaly alerts, complaints SLA.': 'प्रति-समुदाय / वार्ड IoT स्वास्थ्य, शिकायत असाइनमेंट, स्मार्ट-बिन स्थिति, विसंगति अलर्ट, शिकायत SLA।',
    'State Real-Time Governance Centre': 'राज्य रियल-टाइम गवर्नेंस केंद्र',
    'NOC for the entire state. 6 ULBs · 600+ wards · live grievances · SBM compliance · worker welfare · disaster mgmt · CAG-ready reports.': 'पूरे राज्य के लिए NOC। 6 ULB · 600+ वार्ड · लाइव शिकायतें · SBM अनुपालन · कर्मचारी कल्याण · आपदा प्रबंधन · CAG-तैयार रिपोर्ट।',
    'Operator login · opens at': 'संचालक लॉगिन · इस पर खुलता है',
    'Backend: Node + Express + Socket.IO · In-process MQTT (aedes) on :1883 · Resets on restart.': 'बैकएंड: Node + Express + Socket.IO · इन-प्रोसेस MQTT (aedes) पोर्ट :1883 · रीस्टार्ट पर रीसेट।',
    'Install on your phone: open this site in Chrome → menu → Add to Home Screen.': 'अपने फ़ोन पर इंस्टॉल करें: इस साइट को Chrome में खोलें → मेनू → होम स्क्रीन पर जोड़ें।',

    // ── Misc / generic confirms ─────────────────────────────────
    'OTA scheduled': 'OTA शेड्यूल हुआ',
    'in your community': 'आपके समुदाय में',
    'Free': 'मुफ़्त',
    // Time abbreviations are intentionally not translated — they're
    // 1–3 letters and would cause false matches inside longer strings.

    // ── Onboarding tour buttons ─────────────────────────────────
    'Last check — really delete all local data?': 'अंतिम जाँच — क्या सच में सारा लोकल डेटा हटाएँ?',
  };

  // Aliases used by `tr` to handle status-strings rendered with underscores
  // converted to spaces (e.g. `EN_ROUTE` → `EN ROUTE`).
  function tr(text) {
    if (typeof text !== 'string' || lang() !== 'HI') return text;
    const trimmed = text.trim();
    if (!trimmed) return text;
    if (HI_DICT[trimmed]) return text.replace(trimmed, HI_DICT[trimmed]);
    return text;
  }

  // Translate text inside a DOM subtree. Walks every text node, plus the
  // common attribute set, and replaces each matching string in-place.
  const I18N_ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'TEXTAREA']);
  function translateNode(root) {
    if (!root || lang() !== 'HI') return;
    if (root.nodeType === 3) {
      const t0 = root.nodeValue?.trim();
      if (t0 && HI_DICT[t0]) root.nodeValue = root.nodeValue.replace(t0, HI_DICT[t0]);
      return;
    }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    // Walk text nodes
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
      if (HI_DICT[t0]) updates.push([n, n.nodeValue.replace(t0, HI_DICT[t0])]);
    }
    updates.forEach(([nn, v]) => { nn.nodeValue = v; });
    // Attributes
    const els = (root.nodeType === 1 ? [root] : []).concat(
      Array.from(root.querySelectorAll ? root.querySelectorAll('*') : [])
    );
    els.forEach((el) => {
      I18N_ATTRS.forEach((attr) => {
        const v = el.getAttribute && el.getAttribute(attr);
        if (v) {
          const tv = v.trim();
          if (HI_DICT[tv]) el.setAttribute(attr, HI_DICT[tv]);
        }
      });
      if ((el.tagName === 'INPUT' || el.tagName === 'BUTTON') && el.value) {
        const tv = String(el.value).trim();
        if (HI_DICT[tv]) el.value = HI_DICT[tv];
      }
    });
  }

  // Live observer — translates anything added/changed after initial paint.
  let _i18nObs = null;
  function startI18nObserver() {
    if (_i18nObs || !document.body) return;
    _i18nObs = new MutationObserver((muts) => {
      if (lang() !== 'HI') return;
      for (const m of muts) {
        if (m.type === 'childList') {
          m.addedNodes.forEach((node) => translateNode(node));
        } else if (m.type === 'characterData') {
          const t0 = m.target.nodeValue?.trim();
          if (t0 && HI_DICT[t0]) m.target.nodeValue = m.target.nodeValue.replace(t0, HI_DICT[t0]);
        } else if (m.type === 'attributes') {
          const el = m.target;
          const a = m.attributeName;
          const v = el.getAttribute(a);
          if (v) {
            const tv = v.trim();
            if (HI_DICT[tv]) el.setAttribute(a, HI_DICT[tv]);
          }
        }
      }
    });
    _i18nObs.observe(document.body, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: I18N_ATTRS.concat(['value']),
    });
  }
  function bootI18n() {
    document.documentElement.lang = lang().toLowerCase();
    if (lang() === 'HI') translateNode(document.body);
    startI18nObserver();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootI18n);
  } else {
    bootI18n();
  }

  // ── Toast ──────────────────────────────────────────────────────────
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

  // ── Formatting ─────────────────────────────────────────────────────
  function fmtINR(paise) { if (!paise) return 'Free'; return '₹ ' + (paise / 100).toFixed(0); }
  function fmtTime(iso) {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
  }

  // ── Storage / state ────────────────────────────────────────────────
  const TOKEN_KEY = 'vl_token';
  const USER_KEY  = 'vl_user';
  const STATE_KEY = 'vl_state_v1';

  function loadState() {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || !s.users) return null;
      return s;
    } catch { return null; }
  }
  function saveState() {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
    scheduleCmccSync();
  }

  // CMCC heartbeat — mirrors local state to a server, so the CMCC running
  // on a different device can see this device's activity.
  const SYNC_URL_KEY = 'vl_sync_url';
  const DEVICE_ID_KEY = 'vl_device_id';
  function deviceId() {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) { id = 'dev_' + Math.random().toString(36).slice(2, 11); localStorage.setItem(DEVICE_ID_KEY, id); }
    return id;
  }
  function syncUrl() { return localStorage.getItem(SYNC_URL_KEY) || ''; }
  function setSyncUrl(u) { if (u) localStorage.setItem(SYNC_URL_KEY, u.replace(/\/$/, '')); else localStorage.removeItem(SYNC_URL_KEY); }
  let _syncTimer = null;
  function scheduleCmccSync() {
    if (!syncUrl()) return;
    if (_syncTimer) clearTimeout(_syncTimer);
    _syncTimer = setTimeout(async () => {
      try {
        await fetch(syncUrl() + '/api/cmcc/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId: deviceId(), state }),
        });
      } catch {}
    }, 1500);
  }

  function seedState() {
    const community = { id: 'c1', name: 'Prestige Sunrise Park', city: 'Bangalore', pincode: '560103' };
    const flats = {};
    for (const block of ['A', 'B']) {
      for (const num of ['101', '102', '201', '202']) {
        const id = `flat-${block}${num}`;
        flats[id] = { id, communityId: 'c1', block, number: num, rfidTag: `RFID-${block}${num}`, label: `${block}-${num}` };
      }
    }
    const services = [
      { id: 'svc-garbage',     type: 'GARBAGE',     name: 'Garbage Pickup',       basePrice: 0,     slaMins: 30,  icon: 'recycling' },
      { id: 'svc-laundry',     type: 'LAUNDRY',     name: 'Laundry Pickup',       basePrice: 19900, slaMins: 60,  icon: 'local_laundry_service' },
      { id: 'svc-carwash',     type: 'CARWASH',     name: 'Car Wash',             basePrice: 29900, slaMins: 90,  icon: 'local_car_wash' },
      { id: 'svc-grocery',     type: 'GROCERY',     name: 'Grocery Pickup/Drop',  basePrice: 9900,  slaMins: 45,  icon: 'shopping_basket' },
      { id: 'svc-maintenance', type: 'MAINTENANCE', name: 'Maintenance Request',  basePrice: 49900, slaMins: 120, icon: 'build' },
    ];
    const users = {
      '+919999900001': { id: 'u-resident-1', phone: '+919999900001', name: 'Aarav Sharma', role: 'RESIDENT', flatId: 'flat-A101', language: 'EN' },
      '+919999900002': { id: 'u-agent-1',    phone: '+919999900002', name: 'Ravi Kumar',   role: 'AGENT',    flatId: null,        language: 'EN' },
      '+919999900003': { id: 'u-admin-1',    phone: '+919999900003', name: 'Priya Admin',  role: 'ADMIN',    flatId: null,        language: 'EN' },
      '+919999900010': { id: 'u-op-1',       phone: '+919999900010', name: 'Priya Iyer',   role: 'OPERATOR', flatId: null,        language: 'EN', opRole: 'NOC Lead' },
      '+919999900011': { id: 'u-op-2',       phone: '+919999900011', name: 'Sandeep Rao',  role: 'OPERATOR', flatId: null,        language: 'EN', opRole: 'NOC Operator' },
      '+919999900012': { id: 'u-op-3',       phone: '+919999900012', name: 'Rakhi Menon',  role: 'OPERATOR', flatId: null,        language: 'EN', opRole: 'NOC Operator' },
      '+919999900013': { id: 'u-op-4',       phone: '+919999900013', name: 'Faizan Ahmed', role: 'OPERATOR', flatId: null,        language: 'EN', opRole: 'On-Call SRE' },
      '+919999900014': { id: 'u-op-5',       phone: '+919999900014', name: 'Akhila Reddy', role: 'OPERATOR', flatId: null,        language: 'EN', opRole: 'Compliance' },
    };
    const devices = {};
    [
      { id: 'bin-block-A', label: 'Block A bin',     fillLevel: 32 },
      { id: 'bin-block-B', label: 'Block B bin',     fillLevel: 58 },
      { id: 'bin-common',  label: 'Common-area bin', fillLevel: 14 },
    ].forEach((b) => {
      devices[b.id] = { id: b.id, type: 'SMART_BIN', label: b.label, communityId: 'c1', fillLevel: b.fillLevel, lastSeen: Date.now(), online: true };
    });
    devices['scanner-gate'] = { id: 'scanner-gate', type: 'QR_SCANNER', label: 'Main gate scanner', communityId: 'c1', lastSeen: Date.now(), online: true };
    return { community, flats, services, users, devices, orders: [], otps: {}, agentLoc: {} };
  }

  let state = loadState() || seedState();
  saveState();

  // ── In-process event bus (replaces Socket.IO) ──────────────────────
  const listeners = new Map();
  const bc = ('BroadcastChannel' in window) ? new BroadcastChannel('vl_events') : null;
  if (bc) bc.onmessage = (e) => fire(e.data.event, e.data.data);
  function on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
    return () => listeners.get(event).delete(fn);
  }
  function emit(event, data) {
    fire(event, data);
    if (bc) try { bc.postMessage({ event, data }); } catch {}
  }
  function fire(event, data) {
    (listeners.get(event) || new Set()).forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } });
  }
  // Cross-page sync: when localStorage state changes in another page, refire events.
  window.addEventListener('storage', (e) => {
    if (e.key === STATE_KEY) {
      try { state = JSON.parse(e.newValue) || state; } catch {}
      fire('storage:state', null);
    }
  });

  // ── Token / session ────────────────────────────────────────────────
  const token = () => localStorage.getItem(TOKEN_KEY);
  const setToken = (v) => v ? localStorage.setItem(TOKEN_KEY, v) : localStorage.removeItem(TOKEN_KEY);
  const user = () => { try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; } };
  const setUser = (u) => u ? localStorage.setItem(USER_KEY, JSON.stringify(u)) : localStorage.removeItem(USER_KEY);

  function issueToken(u) { return 'mock.' + btoa(JSON.stringify({ sub: u.id, role: u.role, exp: Date.now() + 7 * 24 * 3600 * 1000 })) + '.sig'; }
  function decodeToken(t) {
    if (!t) return null;
    try { return JSON.parse(atob(t.split('.')[1] || '')); } catch { return null; }
  }
  function currentUser() {
    const p = decodeToken(token());
    if (!p || (p.exp && p.exp < Date.now())) return null;
    return Object.values(state.users).find((u) => u.id === p.sub) || null;
  }

  function logout() { setToken(null); setUser(null); location.href = '/login.html'; }
  function requireAuth(role) {
    const u = user();
    if (!token() || !u) { location.href = '/login.html'; return null; }
    if (role && u.role !== role) { toast(`This page is for ${role.toLowerCase()}s`); setTimeout(() => location.href = '/login.html', 800); return null; }
    return u;
  }

  // ── Helpers ────────────────────────────────────────────────────────
  const nid = () => 't' + Math.random().toString(36).slice(2, 11);
  const now = () => new Date().toISOString();
  const userById = (id) => {
    const u = Object.values(state.users).find((x) => x.id === id);
    return u ? { id: u.id, name: u.name, phone: u.phone, role: u.role } : null;
  };
  const enrich = (o) => ({
    ...o,
    flat: o.flatId ? state.flats[o.flatId] : null,
    service: state.services.find((s) => s.id === o.serviceId),
    resident: o.residentId ? userById(o.residentId) : null,
    agent: o.agentId ? userById(o.agentId) : null,
  });
  const broadcastOrder = (o) => {
    const e = enrich(o);
    emit('order:status', e);
  };

  // ── Mock REST handlers ─────────────────────────────────────────────
  const routes = {};
  function route(method, pattern, handler) {
    routes[`${method} ${pattern}`] = handler;
  }
  function match(method, path) {
    // Exact match first
    if (routes[`${method} ${path}`]) return { handler: routes[`${method} ${path}`], params: {} };
    // Pattern with :id
    for (const key of Object.keys(routes)) {
      const [m, pat] = key.split(' ');
      if (m !== method) continue;
      const patParts = pat.split('/'); const pathParts = path.split('/');
      if (patParts.length !== pathParts.length) continue;
      const params = {};
      let ok = true;
      for (let i = 0; i < patParts.length; i++) {
        if (patParts[i].startsWith(':')) params[patParts[i].slice(1)] = pathParts[i];
        else if (patParts[i] !== pathParts[i]) { ok = false; break; }
      }
      if (ok) return { handler: routes[key], params };
    }
    return null;
  }

  // Auth
  route('POST', '/api/auth/otp/request', (req) => {
    const { phone } = req.body || {};
    if (!phone || !/^\+91\d{10}$/.test(phone)) throw httpErr(400, 'phone must be +91XXXXXXXXXX');
    if (!state.users[phone]) {
      state.users[phone] = { id: nid(), phone, name: null, role: 'RESIDENT', flatId: null, language: 'EN' };
    }
    const otp = '123456';
    state.otps[phone] = { otp, exp: Date.now() + 5 * 60 * 1000 };
    saveState();
    return { ok: true, demoOtp: otp };
  });
  route('POST', '/api/auth/otp/verify', (req) => {
    const { phone, otp } = req.body || {};
    const stored = state.otps[phone];
    if (!stored || stored.exp < Date.now() || stored.otp !== otp) throw httpErr(400, 'invalid or expired otp');
    delete state.otps[phone];
    const u = state.users[phone];
    saveState();
    return { token: issueToken(u), user: u };
  });
  route('GET', '/api/me', (req) => {
    const me = req.me;
    return { ...me, flat: me.flatId ? state.flats[me.flatId] : null };
  });
  route('PATCH', '/api/me', (req) => {
    const me = req.me;
    const { name, flatId, language } = req.body || {};
    if (name !== undefined) me.name = name;
    if (flatId !== undefined) me.flatId = flatId;
    if (language !== undefined) me.language = language;
    saveState();
    return me;
  });

  // Catalog
  route('GET', '/api/services', () => state.services);
  route('GET', '/api/flats',    () => Object.values(state.flats));

  // Orders (resident)
  route('POST', '/api/orders', (req) => {
    const me = req.me;
    if (me.role !== 'RESIDENT') throw httpErr(403, 'forbidden');
    if (!me.flatId) throw httpErr(400, 'link a flat first');
    const { serviceId, scheduledAt, notes } = req.body || {};
    const service = state.services.find((s) => s.id === serviceId);
    if (!service) throw httpErr(404, 'service not found');
    const ts = now();
    const order = {
      id: nid(),
      residentId: me.id,
      agentId: 'u-agent-1',
      serviceId, flatId: me.flatId,
      status: 'ASSIGNED',
      scheduledAt: scheduledAt || ts,
      amount: service.basePrice,
      notes: notes || null,
      source: 'MANUAL',
      createdAt: ts,
      history: [
        { status: 'CREATED',  at: ts },
        { status: 'ASSIGNED', at: ts, agentId: 'u-agent-1' },
      ],
    };
    state.orders.unshift(order);
    saveState();
    const e = enrich(order);
    emit('order:new', e);
    emit('order:status', e);
    return e;
  });
  route('GET', '/api/orders', (req) => {
    const me = req.me;
    let list = state.orders;
    if (me.role === 'RESIDENT') list = list.filter((o) => o.residentId === me.id);
    if (me.role === 'AGENT')    list = list.filter((o) => o.agentId === me.id);
    return list.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(enrich);
  });
  route('GET', '/api/orders/:id', (req) => {
    const o = state.orders.find((x) => x.id === req.params.id);
    if (!o) throw httpErr(404, 'not found');
    return enrich(o);
  });
  route('POST', '/api/orders/:id/cancel', (req) => {
    const o = state.orders.find((x) => x.id === req.params.id);
    if (!o) throw httpErr(404, 'not found');
    if (!['CREATED', 'ASSIGNED'].includes(o.status)) throw httpErr(400, `cannot cancel from status ${o.status}`);
    o.status = 'CANCELLED';
    o.history.push({ status: 'CANCELLED', at: now(), by: req.me.id });
    saveState();
    broadcastOrder(o);
    return enrich(o);
  });
  route('POST', '/api/orders/:id/rate', (req) => {
    const o = state.orders.find((x) => x.id === req.params.id);
    if (!o || o.residentId !== req.me.id) throw httpErr(404, 'not found');
    if (o.status !== 'COMPLETED') throw httpErr(400, 'only completed orders');
    o.rating = Math.max(1, Math.min(5, Number(req.body?.stars || 5)));
    o.ratingComment = req.body?.comment || null;
    saveState();
    broadcastOrder(o);
    return enrich(o);
  });

  // Agent state-machine
  function transition(orderId, agentId, next, extra = {}) {
    const o = state.orders.find((x) => x.id === orderId);
    if (!o) throw httpErr(404, 'not found');
    if (o.agentId !== agentId) throw httpErr(403, 'not your task');
    o.status = next;
    o.history.push({ status: next, at: now(), ...extra });
    if (next === 'COMPLETED') o.completedAt = now();
    if (next === 'EN_ROUTE') o.enRouteAt = now();
    saveState();
    broadcastOrder(o);
    return enrich(o);
  }
  route('POST', '/api/agent/tasks/:id/start',    (req) => transition(req.params.id, req.me.id, 'EN_ROUTE'));
  route('POST', '/api/agent/tasks/:id/arrive',   (req) => transition(req.params.id, req.me.id, 'ARRIVED'));
  route('POST', '/api/agent/tasks/:id/complete', (req) => transition(req.params.id, req.me.id, 'COMPLETED'));
  route('POST', '/api/agent/tasks/:id/scan', (req) => {
    const { code, type } = req.body || {};
    const o = state.orders.find((x) => x.id === req.params.id);
    if (!o) throw httpErr(404, 'not found');
    if (o.agentId !== req.me.id) throw httpErr(403, 'not your task');
    if (type === 'RFID') {
      const f = o.flatId ? state.flats[o.flatId] : null;
      if (!f || f.rfidTag !== code) throw httpErr(400, 'rfid tag does not match this flat');
    }
    if (type === 'QR' && !code) throw httpErr(400, 'empty qr');
    return transition(req.params.id, req.me.id, 'IN_PROGRESS', { via: type, code });
  });

  // Admin
  route('GET', '/api/admin/devices', () => Object.values(state.devices));
  route('GET', '/api/admin/orders', () =>
    state.orders.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(enrich));
  route('GET', '/api/admin/communities', () => [{
    ...state.community,
    flats: Object.values(state.flats),
    deviceCount: Object.values(state.devices).length,
  }]);
  route('GET', '/api/admin/stats', () => ({
    totalOrders: state.orders.length,
    active: state.orders.filter((o) => !['COMPLETED', 'CANCELLED'].includes(o.status)).length,
    completedToday: state.orders.filter((o) => o.completedAt?.slice(0, 10) === new Date().toISOString().slice(0, 10)).length,
    devicesOnline: Object.values(state.devices).filter((d) => d.online).length,
    fullBins: Object.values(state.devices).filter((d) => d.type === 'SMART_BIN' && d.fillLevel >= 80).length,
  }));
  route('POST', '/api/admin/iot/bin/:id/level', (req) => {
    const d = state.devices[req.params.id];
    if (!d || d.type !== 'SMART_BIN') throw httpErr(404, 'bin not found');
    const lvl = Math.max(0, Math.min(100, Number(req.body?.level)));
    const wasBelow = d.fillLevel < 80;
    d.fillLevel = lvl; d.lastSeen = Date.now();
    saveState();
    emit('device:update', d);
    if (lvl >= 80 && wasBelow) autoCreateGarbageOrder(d.id);
    return { ok: true };
  });
  route('POST', '/api/admin/iot/scan', (req) => {
    const { tag, orderId } = req.body || {};
    handleRfidScan(tag, orderId);
    return { ok: true };
  });

  function autoCreateGarbageOrder(deviceId) {
    const dup = state.orders.find(
      (o) => o.source === 'AUTO_BIN' && o.deviceId === deviceId && !['COMPLETED', 'CANCELLED'].includes(o.status),
    );
    if (dup) return;
    const ts = now();
    const order = {
      id: nid(),
      residentId: null,
      agentId: 'u-agent-1',
      serviceId: 'svc-garbage',
      flatId: null,
      deviceId,
      status: 'ASSIGNED',
      scheduledAt: ts,
      amount: 0,
      notes: `Smart bin ${deviceId} reached threshold`,
      source: 'AUTO_BIN',
      createdAt: ts,
      history: [
        { status: 'CREATED',  at: ts, via: 'IOT_AUTO' },
        { status: 'ASSIGNED', at: ts, agentId: 'u-agent-1' },
      ],
    };
    state.orders.unshift(order);
    saveState();
    const e = enrich(order);
    emit('order:new', e);
    emit('order:status', e);
  }

  function handleRfidScan(tag, orderId) {
    const flat = Object.values(state.flats).find((f) => f.rfidTag === tag);
    if (!flat || !orderId) return;
    const o = state.orders.find((x) => x.id === orderId);
    if (!o || o.flatId !== flat.id) return;
    if (!['EN_ROUTE', 'ARRIVED'].includes(o.status)) return;
    o.status = 'IN_PROGRESS';
    o.history.push({ status: 'IN_PROGRESS', at: now(), via: 'RFID', tag });
    saveState();
    broadcastOrder(o);
  }

  function httpErr(code, msg) { const e = new Error(msg); e.code = code; return e; }

  // ── Public http() ──────────────────────────────────────────────────
  async function http(method, url, body) {
    const path = url.split('?')[0];
    const m = match(method, path);
    if (!m) throw new Error(`route not found: ${method} ${path}`);
    const req = { method, path, body, params: m.params };
    if (path !== '/api/auth/otp/request' && path !== '/api/auth/otp/verify') {
      const me = currentUser();
      if (!me) { logout(); throw new Error('unauthorized'); }
      req.me = me;
    }
    return m.handler(req);
  }

  // ── Public connectSocket() (mock) ──────────────────────────────────
  function connectSocket() {
    const subs = [];
    const sock = {
      on(event, fn) { subs.push(on(event, fn)); return sock; },
      off() { subs.forEach((u) => u()); subs.length = 0; },
      emit(event, data) {
        // Agent broadcasts location → fan out to resident + admin.
        if (event === 'agent:location') {
          const o = state.orders.find((x) => x.id === data.orderId);
          if (!o) return;
          const me = currentUser();
          state.agentLoc[data.orderId] = { ...data, agentId: me?.id || 'agent', at: Date.now() };
          saveState();
          emit('agent:location', { ...data, agentId: me?.id || 'agent' });
        }
      },
    };
    return sock;
  }

  // ── Background IoT simulator ───────────────────────────────────────
  // Runs on every page so the demo stays alive regardless of the
  // current view. Idempotent: an interval id is parked on window so a
  // hot-reload doesn't double-tick.
  if (!window.__VL_TICK__) {
    window.__VL_TICK__ = setInterval(() => {
      // Re-read state (another page may have mutated it)
      try { state = JSON.parse(localStorage.getItem(STATE_KEY)) || state; } catch {}
      Object.values(state.devices).forEach((d) => {
        if (d.type !== 'SMART_BIN') return;
        const before = d.fillLevel;
        d.fillLevel = Math.min(100, Math.round(d.fillLevel + Math.random() * 3));
        d.lastSeen = Date.now();
        emit('device:update', d);
        if (before < 80 && d.fillLevel >= 80) autoCreateGarbageOrder(d.id);
      });
      saveState();
    }, 8000);
  }

  // ── Topbar (used by some pages) ────────────────────────────────────
  function renderTopbar(roleLabel, mountSelector = '#topbar') {
    const u = user();
    const root = document.querySelector(mountSelector);
    if (!root) return;
    root.innerHTML = `
      <div class="logo">Hearthly</div>
      <span class="role">${roleLabel}</span>
      <div class="spacer"></div>
      <select id="lang">
        <option value="EN" ${lang() === 'EN' ? 'selected' : ''}>EN</option>
        <option value="HI" ${lang() === 'HI' ? 'selected' : ''}>HI</option>
        <option value="TE" ${lang() === 'TE' ? 'selected' : ''}>TE</option>
      </select>
      <span class="who">${u?.name || u?.phone || ''}</span>
      <button class="link" id="logout">${t('logout')}</button>`;
    root.querySelector('#logout').onclick = logout;
    root.querySelector('#lang').onchange = (e) => setLang(e.target.value);
  }

  function agentLocation(orderId) {
    return (state.agentLoc && state.agentLoc[orderId]) || null;
  }

  // ── Public surface ─────────────────────────────────────────────────
  return {
    token, setToken, user, setUser,
    http, connectSocket, logout, requireAuth,
    toast, fmtINR, fmtTime,
    lang, setLang, t, tr, translateNode,
    renderTopbar, agentLocation,
    deviceId, syncUrl, setSyncUrl,
    // Expose for debugging only
    _state: () => state,
  };
})();
