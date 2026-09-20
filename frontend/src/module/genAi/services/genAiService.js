/**
 * Service to communicate with backend GenAI server
 */

import { getApiBase } from '../../../shared/apiBase';

const chatUrl = () => `${getApiBase()}/genai/chat`;

const ROUTE_DIRECTORY = [
  {
    keywords: ['profile', 'account', 'user profile', 'my profile', 'settings'],
    routeName: 'User Profile Page',
    routePath: '/profile',
    descEn: 'You can view and edit your profile details, personal settings, and account information on the User Profile page.',
    descHi: 'आप अपनी प्रोफाइल विवरण, व्यक्तिगत सेटिंग्स और खाता जानकारी यूजर प्रोफाइल पेज पर देख सकते हैं।'
  },
  {
    keywords: ['upload', 'document', 'documents', 'docs', 'lab report', 'prescription', 'file', 'reports'],
    routeName: 'Upload Medical Documents Page',
    routePath: '/uploadDoc',
    descEn: 'You can upload, view, and manage your medical records, lab reports, and prescriptions on the Upload Documents page.',
    descHi: 'आप अपने मेडिकल रिकॉर्ड, लैब रिपोर्ट और पर्चे अपलोड दस्तावेज़ पेज पर अपलोड और देख सकते हैं।'
  },
  {
    keywords: ['socrates', 'symptom form', 'symptom log', 'clinical form'],
    routeName: 'Socrates Symptom Form Page',
    routePath: '/socrates',
    descEn: 'Log detailed clinical symptoms using the structured SOCRATES framework on the Socrates Symptom Form page.',
    descHi: 'सुकरात लक्षण फॉर्म पेज पर विस्तृत लक्षण (SOCRATES framework) दर्ज करें।'
  },
  {
    keywords: ['namaste', 'namaste code', 'ayush', 'ayurveda'],
    routeName: 'NAMASTE Code Search Page',
    routePath: '/namaste-code',
    descEn: 'Lookup Ayush (Ayurveda, Siddha, Unani) terminology and standardized health codes on the NAMASTE Code Search page.',
    descHi: 'नमस्ते कोड खोज पेज पर आयुष (आयुर्वेद, सिद्ध, यूनानी) स्वास्थ्य शब्दावली और कोड खोजें।'
  },
  {
    keywords: ['icd', 'icd code', 'icd-11', 'disease code'],
    routeName: 'ICD-11 Disease Code Search Page',
    routePath: '/icd-code',
    descEn: 'Search International Classification of Diseases (ICD-11) codes and dual coding tools on the ICD-11 Code Search page.',
    descHi: 'ICD-11 कोड खोज पेज पर अंतरराष्ट्रीय बीमारी वर्गीकरण कोड खोजें।'
  },
  {
    keywords: ['abha', 'abha id', 'abha card', 'ayushman'],
    routeName: 'ABHA ID Management Page',
    routePath: '/abha',
    descEn: 'Create, link, verify, and view your ABHA (Ayushman Bharat Health Account) card on the ABHA ID Management page.',
    descHi: 'आभा आईडी पेज पर अपना ABHA स्वास्थ्य कार्ड बनाएं और सत्यापित करें।'
  },
  {
    keywords: ['basic info', 'basicinfo', 'personal info', 'demographics'],
    routeName: 'Basic Info Page',
    routePath: '/basicInfo',
    descEn: 'Enter and update your basic demographic, contact, and baseline health details on the Basic Info page.',
    descHi: 'बुनियादी जानकारी पेज पर अपनी व्यक्तिगत और स्वास्थ्य जानकारी अपडेट करें।'
  },
  {
    keywords: ['consent', 'privacy', 'permission'],
    routeName: 'Consent Management Page',
    routePath: '/consent',
    descEn: 'Manage medical data sharing access and privacy permissions on the Consent Management page.',
    descHi: 'सहमति प्रबंधन पेज पर अपने मेडिकल डेटा एक्सेस की अनुमति प्रबंधित करें।'
  },
  {
    keywords: ['doctor', 'doctor dashboard', 'patient data', 'consultation', 'consultations', 'alerts', 'directory'],
    routeName: 'Doctor Portal & Dashboard',
    routePath: '/doctor',
    descEn: 'Access doctor consultations, patient data, emergency alerts, and medical staff directory on the Doctor Portal.',
    descHi: 'डॉक्टर पोर्टल पर रोगी विवरण, परामर्श और आपातकालीन अलर्ट प्रबंधित करें।'
  },
  {
    keywords: ['dashboard', 'home', 'main page', 'landing'],
    routeName: 'User Dashboard / Home',
    routePath: '/dashboard',
    descEn: 'View your overall health metrics, quick stats, active alerts, and recent health summary on the Main Dashboard.',
    descHi: 'मुख्य डैशबोर्ड पर अपना स्वास्थ्य ओवरव्यू और हालिया अलर्ट देखें।'
  },
  {
    keywords: ['kindle', 'health code'],
    routeName: 'Health Code Portal',
    routePath: '/kindle',
    descEn: 'Search unified medical codes combining modern and traditional health terminology on the Health Code Portal.',
    descHi: 'हेल्थ कोड पोर्टल पर एकीकृत मेडिकल कोड खोजें।'
  }
];

export const getDirectionResponse = (message, language = 'en') => {
  if (!message) return null;
  const lower = message.toLowerCase();
  const isHindi = language === 'hi';
  const isBengali = language === 'bn';
  const isTamil = language === 'ta';

  const matched = ROUTE_DIRECTORY.filter((item) =>
    item.keywords.some((kw) => lower.includes(kw))
  );

  if (matched.length > 0) {
    if (isHindi) {
      let resp = `यहाँ आपके द्वारा पूछे गए फ़ीचर का प्लेटफ़ॉर्म रास्ता (Direction) दिया गया है:\n\n`;
      matched.forEach((item) => {
        resp += `• [${item.routeName}](${item.routePath})\n  ${item.descHi}\n\n`;
      });
      resp += `पेज पर तुरंत पहुँचने के लिए ऊपर दिए गए नीले लिंक पर क्लिक करें!`;
      return resp;
    } else if (isBengali) {
      let resp = `আপনার অনুরোধ করা ফিচারের প্ল্যাটফর্ম নেভিগেশন লিংক নিচে দেওয়া হলো:\n\n`;
      matched.forEach((item) => {
        resp += `• [${item.routeName}](${item.routePath})\n  ${item.descEn}\n\n`;
      });
      resp += `সরাসরি পেজে যেতে উপরের নীল লিংকে ক্লিক করুন!`;
      return resp;
    } else if (isTamil) {
      let resp = `நீங்கள் கேட்ட அம்சத்திற்கான பிளாட்ஃபார்ம் வழிசெலுத்தல் லிங்க் கீழே கொடுக்கப்பட்டுள்ளது:\n\n`;
      matched.forEach((item) => {
        resp += `• [${item.routeName}](${item.routePath})\n  ${item.descEn}\n\n`;
      });
      resp += `நேரடியாகப் பக்கத்திற்குச் செல்ல மேலே உள்ள நீல நிற இணைப்பைக் கிளிக் செய்யவும்!`;
      return resp;
    } else {
      let resp = `Here is how you can access the requested feature on the platform:\n\n`;
      matched.forEach((item) => {
        resp += `• [${item.routeName}](${item.routePath})\n  ${item.descEn}\n\n`;
      });
      resp += `Click on the highlighted link above to navigate directly to the page!`;
      return resp;
    }
  }

  // General direction query fallback
  if (
    /\b(navigate|navigation|direction|directions|where|guide|pages|routes|links|show all|platform|sections)\b/i.test(
      lower
    )
  ) {
    if (isHindi) {
      let resp = `प्लेटफ़ॉर्म के मुख्य पेजों के लिए दिशा निर्देश (Platform Routes Directory):\n\n`;
      ROUTE_DIRECTORY.forEach((item) => {
        resp += `• [${item.routeName}](${item.routePath}): ${item.descHi}\n`;
      });
      return resp;
    } else if (isBengali) {
      let resp = `প্ল্যাটফর্মের প্রধান পেজগুলির ডিরেক্টরি (Platform Routes Directory):\n\n`;
      ROUTE_DIRECTORY.forEach((item) => {
        resp += `• [${item.routeName}](${item.routePath}): ${item.descEn}\n`;
      });
      return resp;
    } else if (isTamil) {
      let resp = `பிளாட்ஃபார்மின் முக்கிய பக்கங்களின் அடைவு (Platform Routes Directory):\n\n`;
      ROUTE_DIRECTORY.forEach((item) => {
        resp += `• [${item.routeName}](${item.routePath}): ${item.descEn}\n`;
      });
      return resp;
    } else {
      let resp = `Here is the directory of all main pages available on the platform:\n\n`;
      ROUTE_DIRECTORY.forEach((item) => {
        resp += `• [${item.routeName}](${item.routePath}): ${item.descEn}\n`;
      });
      return resp;
    }
  }

  return null;
};

export const sendChatMessageToBackend = async (message, history = [], language = 'en') => {
  const postChat = (url) =>
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, history, language }),
    });

  try {
    let response;
    try {
      response = await postChat(chatUrl());
    } catch (networkErr) {
      // Phone PWA vs. unreachable host → one retry against same-origin.
      if (!chatUrl().startsWith('/api')) {
        response = await postChat('/api/genai/chat');
      } else {
        throw networkErr;
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error ${response.status}: Failed to reach backend.`);
    }

    const data = await response.json();
    let reply = data.reply;

    // Check if backend returned canned redirect message due to guardrail
    const isCannedFallback =
      reply &&
      (reply.includes("I'm here to help with medical") ||
        reply.includes("मैं आपकी चिकित्सा") ||
        reply.includes("medical and health-related concerns"));

    if (isCannedFallback) {
      const dirResponse = getDirectionResponse(message, language);
      if (dirResponse) {
        return dirResponse;
      }
    }

    return reply;
  } catch (error) {
    console.error('Error sending message to GenAI backend:', error);
    const dirResponse = getDirectionResponse(message, language);
    if (dirResponse) {
      return dirResponse;
    }
    throw error;
  }
};
