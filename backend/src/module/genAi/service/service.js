import '../../../shared/config.js';
import { logError } from '../../../shared/logger.js';

/**
 * Medical Gen AI Service using Groq API - Conversational Doctor Mode
 *
 * IMPORTANT: This file now enforces two rules at the CODE level, not just
 * via the system prompt, because relying on the LLM to always follow
 * instructions is not reliable enough for these two rules:
 *
 *   1. Language rule: English/Hindi input -> same language response.
 *      Any other language input -> ALWAYS English response.
 *   2. Medical-only rule: If the message has no medical/health concern,
 *      never let the model answer the unrelated request (code, jokes,
 *      math, general knowledge, etc.) even partially.
 */

// ────────────────────────────────────────────────────────────────
// 1.// ────────────────────────────────────────────────────────────────
// 1. LANGUAGE DETECTION (heuristic, no external dependency)
// ────────────────────────────────────────────────────────────────

const HINDI_REGEX = /[\u0900-\u097F]/;   // Devanagari script
const BENGALI_REGEX = /[\u0980-\u09FF]/; // Bengali script
const TAMIL_REGEX = /[\u0B80-\u0BFF]/;   // Tamil script

// Common greeting/filler words from other major languages. This is a
// heuristic safety net for short inputs like "hola" that are pure ASCII
// and would otherwise be misclassified as English.
const OTHER_LANGUAGE_MARKERS = [
  'hola', 'gracias', 'buenos dias', 'buenas', 'como estas', 'que tal',
  'bonjour', 'merci', 'salut', 'comment allez', 'ca va',
  'hallo', 'guten tag', 'danke', 'wie geht',
  'ciao', 'grazie', 'come stai',
  'ola', 'obrigado', 'tudo bem',
  'merhaba', 'salam', 'selamat',
  'konnichiwa', 'arigato', 'ni hao', 'xie xie',
];

/**
 * Returns 'hi', 'bn', 'ta', 'other', or 'en'
 */
export function detectInputLanguage(text = '') {
  if (!text || !text.trim()) return 'en';

  if (HINDI_REGEX.test(text)) return 'hi';
  if (BENGALI_REGEX.test(text)) return 'bn';
  if (TAMIL_REGEX.test(text)) return 'ta';

  const lower = text.toLowerCase();

  // Accented Latin characters common in Spanish/French/German/Portuguese/etc.
  const hasAccentedLatinChars = /[À-ÖØ-öø-ÿ]/.test(text);

  // Other non-ASCII scripts (Arabic, CJK, Cyrillic, etc.)
  // eslint-disable-next-line no-control-regex
  const hasOtherNonAsciiScript =
    /[^\x00-\x7F]/.test(text) &&
    !HINDI_REGEX.test(text) &&
    !BENGALI_REGEX.test(text) &&
    !TAMIL_REGEX.test(text);

  const matchesOtherMarker = OTHER_LANGUAGE_MARKERS.some((w) => lower.includes(w));

  if (hasAccentedLatinChars || hasOtherNonAsciiScript || matchesOtherMarker) {
    return 'other';
  }

  return 'en';
}

// ────────────────────────────────────────────────────────────────
// 2. MEDICAL-INTENT DETECTION
// ────────────────────────────────────────────────────────────────

const MEDICAL_KEYWORDS_EN = [
  // Pain & symptoms
  'pain', 'ache', 'aches', 'aching', 'hurt', 'hurts', 'hurting', 'headache', 'migraine',
  'stomach', 'abdomen', 'belly', 'fever', 'temperature', 'cold', 'flu',
  'cough', 'coughing', 'vomit', 'vomiting', 'nausea', 'nauseous', 'dizzy', 'dizziness',
  'vertigo', 'rash', 'allergy', 'allergic', 'bleeding', 'blood', 'injury', 'injured',
  'wound', 'cut', 'bruise', 'swelling', 'swollen', 'symptom', 'symptoms', 'sick', 'illness', 'ill',
  'unwell', 'diarrhea', 'infection', 'burn', 'fracture', 'sprain', 'throat', 'chest', 'breathless',
  'breathing', 'breath', 'fatigue', 'tired', 'weakness', 'cramp', 'cramps', 'constipation', 'sore',
  'acid', 'acidity', 'gas', 'bloating', 'heartburn', 'stiff', 'stiffness', 'numb', 'numbness',
  'chills', 'sweat', 'sweating', 'sneezing', 'palpitations', 'insomnia', 'sleep', 'appetite',

  // Body parts & organs
  'head', 'eye', 'eyes', 'ear', 'ears', 'nose', 'mouth', 'tooth', 'teeth', 'tongue',
  'neck', 'shoulder', 'arm', 'hand', 'finger', 'back', 'spine', 'gut', 'bowel', 'hip',
  'leg', 'knee', 'foot', 'feet', 'toe', 'skin', 'heart', 'lung', 'lungs', 'liver',
  'kidney', 'kidneys', 'brain', 'muscle', 'muscles', 'joint', 'joints', 'bone', 'bones', 'vein',

  // Diseases, conditions & health topics
  'diabetes', 'diabetic', 'sugar', 'bp', 'hypertension', 'hypotension', 'pressure', 'asthma',
  'bronchitis', 'pneumonia', 'covid', 'corona', 'virus', 'viral', 'bacterial', 'cancer',
  'tumor', 'ulcer', 'stroke', 'seizure', 'epilepsy', 'thyroid', 'cholesterol', 'arthritis',
  'gout', 'stone', 'stones', 'jaundice', 'dengue', 'malaria', 'typhoid', 'anemia', 'pcos',
  'pcod', 'period', 'periods', 'menstruation', 'pregnant', 'pregnancy', 'health', 'healthy',
  'medical', 'wellness', 'lifestyle', 'diet', 'nutrition', 'exercise', 'habit', 'habits',

  // Healthcare, medication & triage
  'doctor', 'dr', 'doc', 'physician', 'nurse', 'hospital', 'clinic', 'medicine', 'medication',
  'med', 'meds', 'drug', 'pill', 'tablet', 'capsule', 'syrup', 'injection', 'vaccine', 'dose',
  'prescription', 'diagnos', 'diagnosis', 'treatment', 'remedy', 'cure', 'therapy', 'test',
  'report', 'scan', 'xray', 'mri', 'ultrasound', 'lab', 'patient', 'triage', 'first aid',
  'self-care', 'paracetamol', 'crocin', 'dolo', 'ibuprofen', 'aspirin', 'antacid', 'antibiotic'
];

const MEDICAL_KEYWORDS_HI = [
  'दर्द', 'सिरदर्द', 'पेट', 'बुखार', 'खांसी', 'उल्टी', 'जी मिचलाना', 'मिचली',
  'चक्कर', 'एलर्जी', 'खून', 'चोट', 'सूजन', 'बीमार', 'तबियत', 'डॉक्टर',
  'दवा', 'दवाई', 'दस्त', 'संक्रमण', 'जलन', 'फ्रैक्चर', 'मोच', 'माइग्रेन', 'फ्लू',
  'गला', 'सांस', 'थकान', 'कमजोर', 'ऐंठन', 'कब्ज', 'त्वचा', 'लक्षण',
  'आंख', 'कान', 'नाक', 'दांत', 'पीठ', 'सीना', 'छाती', 'हाथ', 'पैर', 'घुटना',
  'दिल', 'शुगर', 'डायबिटीज', 'बीपी', 'ब्लड प्रेशर', 'इन्फेक्शन', 'इलाज', 'उपचार',
  'अस्पताल', 'जांच', 'रिपोर्ट', 'स्वास्थ्य', 'सेहत', 'आहार', 'व्यायाम'
];

const MEDICAL_KEYWORDS_BN = [
  'ব্যথা', 'মাথাব্যথা', 'পেট', 'জ্বর', 'কাশি', 'বমি', 'মাথা ঘোরা', 'অ্যালার্জি',
  'রক্ত', 'ক্ষত', 'ফোলা', 'অসুস্থ', 'রোগী', 'ডাক্তার', 'ওষুধ', 'ইনফেকশন',
  'হার্ট', 'ফুসফুস', 'গলা', 'শ্বাস', 'ক্লান্তি', 'দুর্বলতা', 'চোখ', 'কান',
  'নাক', 'দাঁত', 'হাত', 'পা', 'ডায়াবেটিস', 'প্রেসার', 'হাসপাতাল', 'পরীক্ষা',
  'রিপোর্ট', 'স্বাস্থ্য', 'চিকিৎসা', 'উপশম'
];

const MEDICAL_KEYWORDS_TA = [
  'வலி', 'தலைவலி', 'வயிறு', 'காய்ச்சல்', 'இருமல்', 'வாந்தி', 'மயக்கம்', 'அலர்ஜி',
  'இரத்தம்', 'காயம்', 'வீக்கம்', 'நோயாளி', 'மருத்துவர்', 'மருந்து', 'தொற்று',
  'இதயம்', 'நுரையீரல்', 'தொண்டை', 'மூச்சு', 'சோர்வு', 'பலவீனம்', 'கண்', 'காது',
  'மூக்கு', 'பல்', 'கை', 'கால்', 'நீரிழிவு', 'பிரஷர்', 'மருத்துவமனை', 'பரிசோதனை',
  'அறிக்கை', 'சுகாதாரம்', 'சிகிச்சை'
];

const MEDICAL_KEYWORDS_EN_REGEX = new RegExp(
  '\\b(' + MEDICAL_KEYWORDS_EN.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b',
  'i'
);

const FUZZY_SYMPTOM_PATTERNS = [
  'headac', 'stomach', 'fever', 'cough', 'pain', 'ache', 'sick', 'hurt', 'ill',
  'vomit', 'nause', 'dizz', 'bleed', 'wound', 'injur', 'swell', 'sore', 'fatig',
  'tired', 'weak', 'throat', 'chest', 'breath', 'diarrh', 'cramp', 'constip',
  'burn', 'cold', 'flu', 'sugar', 'pressur', 'diabet', 'doctor', 'medicin', 'pill', 'tablet'
];

export function hasMedicalIntent(text = '') {
  if (!text || !text.trim()) return false;
  const lower = text.toLowerCase();
  const matchesHindi = MEDICAL_KEYWORDS_HI.some((k) => text.includes(k));
  if (matchesHindi) return true;
  const matchesBengali = MEDICAL_KEYWORDS_BN.some((k) => text.includes(k));
  if (matchesBengali) return true;
  const matchesTamil = MEDICAL_KEYWORDS_TA.some((k) => text.includes(k));
  if (matchesTamil) return true;

  if (FUZZY_SYMPTOM_PATTERNS.some((pattern) => lower.includes(pattern))) {
    return true;
  }

  return MEDICAL_KEYWORDS_EN_REGEX.test(lower);
}

const GREETING_REGEX = /^(hi|hello|hey|namaste|greetings|good\s*(morning|afternoon|evening)|howdy|hola|hi\s*doc|hello\s*doc|can\s*you\s*help\s*me|i\s*need\s*help|help\s*me|नमस्ते|प्रणाम|हेलो|হ্যালো|নমস্কার|வணக்கம்)\b/i;

export function isGreeting(text = '') {
  if (!text) return false;
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  return (
    ['नमस्ते', 'प्रणाम', 'हेलो', 'হ্যালো', 'নমস্কার', 'வணக்கம்', 'hi', 'hello', 'hey', 'namaste', 'help'].includes(trimmed) ||
    ['नमस्ते', 'प्रणाम', 'हेलो', 'হ্যালো', 'নমস্কার', 'வணக்கம்', 'hi', 'hello', 'hey', 'namaste', 'help'].includes(lower) ||
    GREETING_REGEX.test(trimmed)
  );
}

export function hasActiveMedicalHistory(history = []) {
  if (!Array.isArray(history) || history.length === 0) return false;
  return history.some((msg) => {
    if (!msg || !msg.content) return false;
    return msg.role === 'user' && hasMedicalIntent(msg.content);
  });
}

// ────────────────────────────────────────────────────────────────
// 2.5 DIRECTION & NAVIGATION INTENT DETECTION
// ────────────────────────────────────────────────────────────────

export function hasDirectionIntent(text = '') {
  if (!text || !text.trim()) return false;
  const lower = text.toLowerCase();

  if (/\/(dashboard|uploadDoc|docs|basicInfo|profile|abha|abhaId|consent|socrates|namaste-code|icd-code|kindle|kindlemain|health-code|doctor|login|register)/i.test(lower)) {
    return true;
  }

  const FEATURE_REGEX = /\b(profile|account|upload|document|documents|docs|lab report|report|reports|prescription|file|basic info|basicinfo|personal info|abha|abha id|abha card|consent|privacy|permission|socrates|symptom form|symptom log|namaste|namaste code|ayush|ayurveda|icd|icd code|icd-11|kindle|health code|doctor|doctor dashboard|patient data|consultation|consultations|alerts|directory|dashboard|login|register)\b/i;
  const DIRECTION_REGEX = /\b(navigate|navigation|direction|directions|guide|where|how|find|show|open|view|see|reach|access|location|link|url|route|routes|page|pages|section|tab|screen|rasta|kahan|kaha|kaise)\b/i;

  if (FEATURE_REGEX.test(lower)) return true;
  if (DIRECTION_REGEX.test(lower)) return true;

  return false;
}

export function hasMedicalContext(userMessage = '', history = []) {
  if (hasDirectionIntent(userMessage)) return true;
  if (hasMedicalIntent(userMessage)) return true;
  if (isGreeting(userMessage)) return true;
  if (hasActiveMedicalHistory(history) && !hasOffTopicRequest(userMessage)) return true;
  return false;
}

// ────────────────────────────────────────────────────────────────
// 3. OFF-TOPIC / NON-MEDICAL REQUEST DETECTION
// ────────────────────────────────────────────────────────────────

const OFF_TOPIC_PATTERNS = [
  /\bjava\b/i, /\bpython\b/i, /\bc\+\+\b/i, /\bc\s*code\b/i, /\bc#\b/i,
  /\bjavascript\b/i, /\btypescript\b/i, /\bhtml\b/i, /\bcss\b/i, /\bsql\b/i,
  /\bcoding\b/i, /\bprogram(ming)?\b/i, /\balgorithm\b/i,
  /\bscript\b/i, /\bfunction\b/i,
  /\bjoke\b/i, /\bpoem\b/i, /\bsong\b/i, /\bstory\b/i, /\bessay\b/i,
  /\bmath\b/i, /\bequation\b/i, /\bsolve\s.*=/i, /\bhomework\b/i,
  /\bfootball\b/i, /\bcricket\b/i, /\bmatch\s*score\b/i, /\bmovie\b/i,
  /\bpolitic/i, /\bpresident\b/i, /\belection\b/i, /\btranslate\b/i,
  /\brecipe\b/i, /\bwrite\s+(me\s+)?(a|an)\s+(poem|story|essay|song|code)\b/i,
];

export function hasOffTopicRequest(text = '') {
  if (!text) return false;
  if (hasDirectionIntent(text)) return false;
  return OFF_TOPIC_PATTERNS.some((re) => re.test(text));
}

// ────────────────────────────────────────────────────────────────
// 4. CANNED REDIRECT MESSAGE
// ────────────────────────────────────────────────────────────────

function getRedirectMessage(language) {
  if (language === 'hi') {
    return 'मैं आपकी चिकित्सा (Medical Concerns) और प्लेटफ़ॉर्म नेविगेशन / दिशा सहायता (App Direction & Navigation) के लिए यहाँ हूँ। कृपया अपने लक्षण बताएं या प्लेटफ़ॉर्म के किसी पेज के बारे में पूछें (जैसे: /uploadDoc, /socrates, /namaste-code, /abha)।';
  }
  if (language === 'bn') {
    return 'আমি আপনার চিকিৎসা সংক্রান্ত প্রশ্ন (Medical Concerns) এবং প্ল্যাটফর্ম নেভিগেশন সহায়তার (App Navigation) জন্য এখানে আছি। অনুগ্রহ করে আপনার লক্ষণ বলুন বা প্ল্যাটফর্মের যেকোনো পেজের কথা জিজ্ঞাসা করুন (যেমন: /uploadDoc, /socrates, /namaste-code, /abha)।';
  }
  if (language === 'ta') {
    return 'உங்கள் மருத்துவ கேள்விகள் (Medical Concerns) மற்றும் பிளாட்ஃபார்ம் வழிசெலுத்தல் உதவிக்கு (App Navigation) நான் இங்கே இருக்கிறேன். தயவுசெய்து உங்கள் அறிகுறிகளைக் கூறவும் அல்லது பிளாட்ஃபார்ம் பக்கங்களைப் பற்றி கேட்கவும் (எ.கா: /uploadDoc, /socrates, /namaste-code, /abha).';
  }
  return "I'm here to help with medical concerns and platform direction assistance. Please describe your health symptoms or ask about finding pages/features on the platform (e.g., Upload Documents /uploadDoc, Socrates Form /socrates, NAMASTE Codes /namaste-code, ABHA ID /abha).";
}

// ────────────────────────────────────────────────────────────────
// 5. RESPONSE POST-PROCESSING SAFETY NET
// ────────────────────────────────────────────────────────────────

function stripCodeBlocks(reply = '') {
  if (!reply) return reply;
  return reply.replace(/```[\s\S]*?```/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

function looksLikeWrongLanguage(reply, expectedLanguage) {
  if (!reply) return false;
  if (expectedLanguage === 'hi' || expectedLanguage === 'bn' || expectedLanguage === 'ta') return false;

  const sanitized = reply
    .replace(/[\u2000-\u206F\u2200-\u22FF\u25A0-\u25FF\uFEFF]/g, '')
    .replace(/[°™®©]/g, '');

  const hasAccentedLatinChars = /[À-ÖØ-öø-ÿ]/.test(sanitized);
  // eslint-disable-next-line no-control-regex
  const hasForeignScript =
    /[^\x00-\x7F]/.test(sanitized) &&
    !HINDI_REGEX.test(sanitized) &&
    !BENGALI_REGEX.test(sanitized) &&
    !TAMIL_REGEX.test(sanitized);

  return hasAccentedLatinChars || hasForeignScript;
}

// ────────────────────────────────────────────────────────────────
// 6. SYSTEM PROMPT
// ────────────────────────────────────────────────────────────────

export const buildSystemPrompt = (language = 'en') => {
  if (language === 'hi') {
    return `आप एक अत्यधिक सहानुभूतिपूर्ण, शांत और विशेषज्ञ मेडिकल एवं प्लेटफ़ॉर्म नेविगेशन एआई असिस्टेंट हैं। आपका उद्देश्य मरीज की समस्या समझना और प्लेटफ़ॉर्म पर दिशा सहायता (Direction Assistance) प्रदान करना है।

प्लेटफ़ॉर्म नेविगेशन डायरेक्टरी (PLATFORM ROUTES DIRECTORY - FROM AppRoutes.jsx):
1. **मुख्य डैशबोर्ड (User Dashboard)**: \`/dashboard\` -> मुख्य लैंडिंग पेज, स्वास्थ्य समरी और अलर्ट।
2. **दस्तावेज़ अपलोड (Upload Documents)**: \`/uploadDoc\` (या \`/docs\`) -> लेब रिपोर्ट, डॉक्टर पर्चे और मेडिकल फाइलें अपलोड करें।
3. **बुनियादी जानकारी (Basic Info)**: \`/basicInfo\` -> व्यक्तिगत स्वास्थ्य जानकारी दर्ज करें।
4. **यूजर प्रोफाइल (User Profile)**: \`/profile\` -> प्रोफाइल विवरण एवं खाता सेटिंग्स।
5. **आभा आईडी (ABHA ID Management)**: \`/abha\` (या \`/abhaId\`) -> ABHA कार्ड निर्माण, सत्यापन और स्थिति।
6. **डेटा सहमति (Consent Management)**: \`/consent\` -> मेडिकल डेटा साझा करने की अनुमति प्रबंधित करें।
7. **सुकरात लक्षण फॉर्म (Socrates Symptom Form)**: \`/socrates\` -> विस्तृत लक्षण (SOCRATES framework) दर्ज करने का क्लिनिकल फॉर्म।
8. **नमस्ते कोड खोज (NAMASTE Code Search)**: \`/namaste-code\` -> आयुष (आयुर्वेद, सिद्ध, यूनानी) स्वास्थ्य शब्दावली एवं कोड खोज।
9. **ICD-11 कोड खोज (ICD-11 Code Search)**: \`/icd-code\` -> अंतरराष्ट्रीय बीमारी वर्गीकरण कोड खोज।
10. **हेल्थ कोड / किंडल (Health Code Portal)**: \`/kindle\` (या \`/kindlemain\`, \`/health-code\`) -> एकीकृत मेडिकल कोड पोर्टल।
11. **एआई असिस्टेंट (AI Assistant)**: \`/genai\` -> यह एआई चैटबॉट।
12. **डॉक्टर पोर्टल और डैशबोर्ड (Doctor Portal)**: \`/doctor\`

दिशा सहायता (DIRECTION ASSISTANCE) के नियम:
- यदि उपयोगकर्ता पूछे कि किसी पेज या सुविधा तक कैसे पहुँचें या कहाँ जाएँ:
  1. स्पष्ट और सरल हिंदी में कदम-दर-कदम रास्ता बताएं।
  2. exact URL / Route path जैसे \`/uploadDoc\`, \`/socrates\`, \`/namaste-code\` का उल्लेख करें।
  3. क्लिक करने योग्य लिंक दें: \`[पेज का नाम](/route)\` (उदाहरण: \`[Upload Documents Page](/uploadDoc)\`)।

चिकित्सा परामर्श (MEDICAL TRIAGE) के नियम:
1. लक्षण पूछने पर एक समय में केवल 1 प्रश्न ही पूछें।
2. हिंदी भाषा में उत्तर दें।
3. दर्द की जगह (location) न पूछें।`;
  }

  if (language === 'bn') {
    return `আপনি একজন অত্যন্ত সহানুভূতিশীল, শান্ত এবং বিশেষজ্ঞ মেডিকেল ও প্ল্যাটফর্ম নেভিগেশন এআই অ্যাসিস্ট্যান্ট। আপনার লক্ষ্য হলো রোগীর স্বাস্থ্য সমস্যা বোঝা এবং প্ল্যাটফর্মে নেভিগেশন সহায়তা প্রদান করা।

প্ল্যাটফর্ম নেভিগেশন ডিরেক্টরি (PLATFORM ROUTES DIRECTORY - FROM AppRoutes.jsx):
1. **User Dashboard**: \`/dashboard\` -> মূল ড্যাশবোর্ড এবং স্বাস্থ্য সামারি।
2. **Upload Medical Documents**: \`/uploadDoc\` -> ল্যাব রিপোর্ট ও প্রেসক্রিপশন আপলোড।
3. **Basic Info**: \`/basicInfo\` -> ব্যক্তিগত ও স্বাস্থ্য সংক্রান্ত তথ্য।
4. **User Profile**: \`/profile\` -> প্রোফাইল তথ্য ও অ্যাকাউন্ট সেটিংস।
5. **ABHA ID Management**: \`/abha\` -> ABHA আইডি এবং হেলথ কার্ড।
6. **Consent Management**: \`/consent\` -> ডেটা শেয়ারিং অনুমোদন।
7. **Socrates Symptom Form**: \`/socrates\` -> লক্ষণ মূল্যায়নের ক্লিনিক্যাল ফর্ম।
8. **NAMASTE Code Search**: \`/namaste-code\` -> আয়ুশ স্বাস্থ্য কোড অনুসন্ধান।
9. **ICD-11 Code Search**: \`/icd-code\` -> আন্তর্জাতিক রোগের কোড অনুসন্ধান।
10. **Kindle / Health Code Portal**: \`/kindle\` -> হেলথ কোড পোর্টাল।
11. **AI Assistant Chatbot**: \`/genai\` -> এআই চ্যাটবট।

নেভিগেশন সহায়তার নিয়ম:
- ব্যবহারকারী কোনো পেজের ঠিকানা জানতে চাইলে পরিষ্কার বাংলা ভাষায় সঠিক URL (\`/uploadDoc\`, \`/socrates\` ইত্যাদি) এবং ক্লিকযোগ্য লিংক \`[Page Name](/route)\` প্রদান করুন।

চিকিৎসা পরামর্শের নিয়ম:
1. লক্ষণ জানতে চাওয়া হলে প্রতি ধাপে শুধুমাত্র ১টি করে প্রশ্ন করুন।
2. স্পষ্ট বাংলা ভাষায় (Bengali script) উত্তর দিন।
3. ব্যথার সুনির্দিষ্ট অবস্থান জানতে চাইবেন না।`;
  }

  if (language === 'ta') {
    return `நீங்கள் ஒரு பரிவுமிக்க, அமைதியான மற்றும் நிபுணத்துவமிக்க மருத்துவ & பிளாட்ஃபார்ம் வழிசெலுத்தல் AI உதவியாளர். நோயாளியின் அறிகுறிகளைப் புரிந்துகொள்வதும், பிளாட்ஃபார்மில் வழிசெலுத்தல் உதவியை வழங்குவதும் உங்கள் இலக்காகும்.

பிளாட்ஃபார்ம் வழிசெலுத்தல் அடைவு (PLATFORM ROUTES DIRECTORY - FROM AppRoutes.jsx):
1. **User Dashboard**: \`/dashboard\` -> முதன்மை பக்கம் மற்றும் சுகாதார சுருக்கம்.
2. **Upload Medical Documents**: \`/uploadDoc\` -> அறிக்கைகள் & மருந்துக் சீட்டுகளைப் பதிவேற்றவும்.
3. **Basic Info**: \`/basicInfo\` -> தனிப்பட்ட சுகாதார விவரங்கள்.
4. **User Profile**: \`/profile\` -> சுயவிவரக் கணக்கு அமைப்புகள்.
5. **ABHA ID Management**: \`/abha\` -> ABHA அட்டை & அடையாள மேலாண்மை.
6. **Consent Management**: \`/consent\` -> தரவு பகிர்வு ஒப்புதல்.
7. **Socrates Symptom Form**: \`/socrates\` -> அறிகுறிகள் படிவம்.
8. **NAMASTE Code Search**: \`/namaste-code\` -> ஆயுஷ் குறியீடு தேடல்.
9. **ICD-11 Code Search**: \`/icd-code\` -> சர்வதேச நோய் குறியீடு தேடல்.
10. **Kindle / Health Code Portal**: \`/kindle\` -> மருத்துவக் குறியீடு போர்ட்டல்.
11. **AI Assistant Chatbot**: \`/genai\` -> AI உதவியாளர்.

வழிசெலுத்தல் உதவி விதிகள்:
- பயனர்கள் குறிப்பிட்ட பக்கத்தைத் தேடும்போது, தெளிவான தமிழில் சரியான URL (\`/uploadDoc\`, \`/socrates\` போன்றவை) மற்றும் கிளிக் செய்யக்கூடிய லிங்க் \`[Page Name](/route)\` வழங்கவும்.

மருத்துவ ஆலோசனை விதிகள்:
1. அறிகுறிகளைக் கேட்கும்போது ஒரு நேரத்தில் 1 கேள்வியை மட்டுமே கேட்கவும்.
2. தெளிவான தமிழ் மொழியில் (Tamil script) பதிலளிக்கவும்.
3. வலி இருக்கும் இடத்தை சுட்டிக்காட்டக் கேட்க வேண்டாம்.`;
  }

  return `You are an empathetic, calm, and knowledgeable Medical & Platform Navigation AI Assistant. Your goal is to provide symptom guidance and directional navigation assistance for the platform based on AppRoutes.

PLATFORM NAVIGATION DIRECTORY (EXACT ROUTES FROM AppRoutes.jsx):
1. **User Dashboard / Home**: \`/dashboard\` -> Main landing page showing user health summary, quick stats, active alerts, and recent records.
2. **Upload Medical Documents**: \`/uploadDoc\` (or \`/docs\`) -> Page to upload lab reports, prescriptions, and medical scans.
3. **Basic Information**: \`/basicInfo\` -> Form to record and update personal, demographic, and baseline health details.
4. **User Profile**: \`/profile\` -> View and edit account information, user settings, and profile details.
5. **ABHA ID Management**: \`/abha\` (or \`/abhaId\`) -> Create, link, verify, and view ABHA (Ayushman Bharat Health Account) card & ID status.
6. **Consent Management**: \`/consent\` -> Manage data access permissions for sharing health records with doctors.
7. **Socrates Symptom Form**: \`/socrates\` -> Detailed clinical symptom assessment form following the SOCRATES framework.
8. **NAMASTE Code Search**: \`/namaste-code\` -> Ayush (Ayurveda, Siddha, Unani) terminology and standardized health code lookup.
9. **ICD-11 Code Search**: \`/icd-code\` -> International Classification of Diseases (ICD-11) search & dual coding tool.
10. **Kindle / Health Code Portal**: \`/kindle\` (or \`/kindlemain\`, \`/health-code\`) -> Unified medical coding search interface.
11. **AI Assistant Chatbot**: \`/genai\` -> Interactive AI health assistant (current page).
12. **Doctor Portal & Dashboard**: \`/doctor\`
    - Patient Data: \`/doctor/patient-data\`
    - Socrates Forms: \`/doctor/socrates-forms\`
    - Consultations: \`/doctor/consultations\`
    - Emergency Alerts: \`/doctor/alerts\`
    - Doctor Directory: \`/doctor/directory\`

DIRECTION ASSISTANCE RULES:
- When the user asks how to find, navigate to, or open any feature or page on the platform:
  1. Provide clear step-by-step navigation instructions.
  2. Always state the exact URL route path (e.g., \`/uploadDoc\`, \`/socrates\`, \`/namaste-code\`, \`/abha\`).
  3. Include clickable markdown links in the format \`[Page Name](/route)\` (e.g. \`[Upload Documents Page](/uploadDoc)\`).
  4. Briefly describe what features are available on that page.

MEDICAL SYMPTOM RULES:
1. ASK FOR DETAILS ONE BY ONE (STRICT SINGLE QUESTION RULE per response turn).
2. Empathetic, short, and clear guidance.
3. Never ask for pain location/position.`;
};

function getContextualFallback(userMessage = '', effectiveLanguage = 'en', greeting = false, directionIntent = false) {
  const lower = userMessage.toLowerCase();

  if (greeting) {
    if (effectiveLanguage === 'hi') {
      return 'नमस्ते! मैं आपका एआई मेडिकल असिस्टेंट हूँ। आज मैं आपके स्वास्थ्य, लक्षणों या प्लेटफ़ॉर्म नेविगेशन में आपकी क्या सहायता कर सकता हूँ?';
    }
    if (effectiveLanguage === 'bn') {
      return 'হ্যালো! আমি আপনার এআই মেডিকেল অ্যাসিস্ট্যান্ট। আজ আপনার স্বাস্থ্য, উপসর্গ বা প্ল্যাটফর্ম নেভিগেশনে কীভাবে সাহায্য করতে পারি?';
    }
    if (effectiveLanguage === 'ta') {
      return 'வணக்கம்! நான் உங்கள் AI மருத்துவ உதவியாளர். இன்று உங்கள் உடல்நலம், அறிகுறிகள் அல்லது பிளாட்ஃபார்ம் வழிகாட்டுதலில் நான் எவ்வாறு உதவ முடியும்?';
    }
    return 'Hello! I am your AI Medical Assistant. How can I assist you with your health symptoms or finding features on the platform today?';
  }

  if (directionIntent) {
    return getRedirectMessage(effectiveLanguage);
  }

  if (lower.includes('headache') || lower.includes('सिरदर्द') || lower.includes('migraine')) {
    if (effectiveLanguage === 'hi') {
      return 'सिरदर्द के लिए: कृपया शांत वातावरण में विश्राम करें और पर्याप्त पानी पिएं। यह सिरदर्द कब से है, और क्या आपको मतली, चक्कर या रोशनी से संवेदनशीलता महसूस हो रही है? आप [Socrates Form](/socrates) पर भी अपने लक्षण दर्ज कर सकते हैं।';
    }
    return 'I understand you are experiencing a headache. To help guide you better: How long have you had this headache, and is it a sharp or dull throbbing pain? Are you also having any fever, nausea, or light sensitivity? You can also log your symptoms in the [Socrates Symptom Form](/socrates).';
  }

  if (lower.includes('fever') || lower.includes('बुखार') || lower.includes('temperature')) {
    if (effectiveLanguage === 'hi') {
      return 'बुखार के लिए: अपना तापमान मापें, पर्याप्त विश्राम करें और पानी पिएं। क्या आपको ठंड, खांसी या शरीर में दर्द भी महसूस हो रहा है? यदि बुखार अधिक है या बना रहता है, तो कृपया डॉक्टर से सलाह लें।';
    }
    return 'I understand you are feeling feverish. Please monitor your body temperature, rest comfortably, and stay hydrated. Do you also have chills, cough, or body aches? If your fever is high or persistent, please consult a medical doctor.';
  }

  if (lower.includes('stomach') || lower.includes('पेट') || lower.includes('belly') || lower.includes('acid')) {
    if (effectiveLanguage === 'hi') {
      return 'पेट की समस्या के लिए: हल्का भोजन लें और मसालेदार खाने से बचें। क्या आपको पेट में दर्द, गैस, मतली या कब्ज की शिकायत है?';
    }
    return 'I notice you mentioned stomach discomfort. Please consider light meals and hydration. Are you experiencing abdominal pain, acidity, nausea, or bloating?';
  }

  if (lower.includes('cough') || lower.includes('खांसी') || lower.includes('cold')) {
    if (effectiveLanguage === 'hi') {
      return 'खांसी और सर्दी के लिए: गुनगुना पानी पिएं और पर्याप्त विश्राम करें। क्या आपकी खांसी सूखी है या बलगम आ रहा है? सांस लेने में कोई परेशानी है?';
    }
    return 'For cough and cold: Try drinking warm fluids and resting. Is it a dry cough or with phlegm, and are you experiencing any difficulty breathing?';
  }

  if (effectiveLanguage === 'hi') {
    return 'नमस्ते! मैं आपका एआई मेडिकल असिस्टेंट हूँ। आपके द्वारा बताए गए स्वास्थ्य विषय के संबंध में: कृपया अपने लक्षणों के बारे में थोड़ा और विस्तार से बताएं (जैसे कि यह कब शुरू हुआ और कितना तीव्र है), ताकि मैं सही मार्गदर्शन कर सकूं।';
  }
  if (effectiveLanguage === 'bn') {
    return 'হ্যালো! আমি আপনার এআই মেডিকেল অ্যাসিস্ট্যান্ট। অনুগ্রহ করে আপনার লক্ষণসমূহ সম্পর্কে আরও কিছু তথ্য জানান (যেমন কতদিন ধরে সমস্যা হচ্ছে), যাতে আমি আপনাকে সঠিক নির্দেশনা প্রদান করতে পারি।';
  }
  if (effectiveLanguage === 'ta') {
    return 'வணக்கம்! நான் உங்கள் AI மருத்துவ உதவியாளர். உங்கள் அறிகுறிகளைப் பற்றி மேலும் சில விவரங்களைப் பகிரவும், அதனால் நான் உங்களுக்குச் சரியான வழிகாட்டலை வழங்க முடியும்.';
  }

  return 'Hello! I am your AI Medical Assistant. Based on your symptoms, please describe how long you have felt this way and any specific discomfort you are having so I can assist you effectively. You can also use our [Socrates Form](/socrates) to log your clinical details.';
}

// ────────────────────────────────────────────────────────────────
// 7. MAIN ENTRY POINT
// ────────────────────────────────────────────────────────────────

export const analyzeWithAi = async (userMessage, history = [], language = 'en') => {
  const detectedLang = detectInputLanguage(userMessage);
  const medicalIntent = hasMedicalIntent(userMessage);
  const directionIntent = hasDirectionIntent(userMessage);
  const greeting = isGreeting(userMessage);
  const activeHistory = hasActiveMedicalHistory(history);
  const medicalContext = hasMedicalContext(userMessage, history);
  const offTopic = hasOffTopicRequest(userMessage);

  console.log('[medicalGenAiService] guardrail check', {
    userMessage,
    detectedLang,
    medicalIntent,
    directionIntent,
    greeting,
    activeHistory,
    medicalContext,
    offTopic,
  });

  if (offTopic && !medicalContext && !directionIntent) {
    console.log('[medicalGenAiService] BLOCKED — off-topic request detected, LLM not called');
    const replyLanguage =
      detectedLang !== 'en' && detectedLang !== 'other'
        ? detectedLang
        : ['hi', 'bn', 'ta'].includes(language)
        ? language
        : 'en';
    return getRedirectMessage(replyLanguage);
  }

  // Determine effective language for AI response
  let effectiveLanguage = 'en';
  if (['hi', 'bn', 'ta'].includes(detectedLang)) {
    effectiveLanguage = detectedLang;
  } else if (['hi', 'bn', 'ta'].includes(language) && detectedLang !== 'other') {
    effectiveLanguage = language;
  }

  const groqEndpoint = process.env.GROQ_ENDPOINT || 'https://api.groq.com/openai/v1/chat/completions';
  const apiKey = process.env.GROQ_API_KEY;
  const primaryModel = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

  const candidateModels = [
    primaryModel,
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'qwen/qwen3.8-27b',
  ].filter((m, i, arr) => m && arr.indexOf(m) === i);

  const reminderParts = [];
  if (detectedLang === 'other') {
    reminderParts.push(
      'REMINDER: The user wrote in a language other than English, Hindi, Bengali, or Tamil. You MUST respond ONLY in English.'
    );
  } else if (effectiveLanguage === 'hi') {
    reminderParts.push('REMINDER: Respond in Hindi (Devanagari script).');
  } else if (effectiveLanguage === 'bn') {
    reminderParts.push('REMINDER: Respond in Bengali (Bengali script).');
  } else if (effectiveLanguage === 'ta') {
    reminderParts.push('REMINDER: Respond in Tamil (Tamil script).');
  } else {
    reminderParts.push('REMINDER: Respond in English.');
  }

  if (greeting && !medicalIntent && !activeHistory) {
    reminderParts.push(
      'REMINDER: The user greeted you. Respond warmly as an empathetic Medical AI Assistant, briefly state your role, and ask how you can help with their health or medical symptoms today.'
    );
  } else if (activeHistory && !medicalIntent && !offTopic) {
    reminderParts.push(
      'REMINDER: The user is answering your previous question about their symptoms. Continue the ongoing medical consultation and triage naturally.'
    );
  }

  if (directionIntent) {
    reminderParts.push(
      'REMINDER: The user is asking for platform navigation or direction assistance. Provide exact route names (e.g., /uploadDoc, /socrates, /namaste-code, /abha, /doctor), clear step-by-step navigation instructions, and clickable markdown links like [Page Name](/route).'
    );
  }

  if (offTopic) {
    reminderParts.push(
      'REMINDER: This message mixes a medical concern with an unrelated request. You MUST answer ONLY the medical part.'
    );
  }

  const reminderText = reminderParts.length ? '\n\n' + reminderParts.join('\n') : '';
  const systemPromptContent = buildSystemPrompt(effectiveLanguage) + reminderText;

  const systemMessage = { role: 'system', content: systemPromptContent };

  const formattedHistory = (history || []).map((msg) => ({
    role: msg.role === 'user' ? 'user' : 'assistant',
    content: msg.content,
  }));

  const allMessages = [
    systemMessage,
    ...formattedHistory,
    { role: 'user', content: userMessage },
  ];

  if (!apiKey) {
    console.warn('[medicalGenAiService] GROQ_API_KEY is not configured. Returning contextual fallback.');
    return getContextualFallback(userMessage, effectiveLanguage, greeting, directionIntent);
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };

  console.log('[medicalGenAiService] CALLING LLM (medical context detected)', {
    effectiveLanguage,
    greeting,
    activeHistory,
    offTopic,
    modelsToTry: candidateModels,
  });

  let aiReply = null;
  let lastError = null;

  for (const currentModel of candidateModels) {
    try {
      const response = await fetch(groqEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: currentModel,
          messages: allMessages,
          temperature: 0.6,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorDetail = response.statusText;
        try {
          const parsed = JSON.parse(errorText);
          errorDetail = parsed.error?.message || errorText;
        } catch {
          errorDetail = errorText;
        }
        throw new Error(`Groq API error (${response.status}) [${currentModel}]: ${errorDetail}`);
      }

      const data = await response.json();
      aiReply =
        data.choices?.[0]?.message?.content ||
        data.message?.content ||
        data.response ||
        (typeof data === 'string' ? data : JSON.stringify(data));

      if (aiReply && aiReply.trim().length > 0) {
        console.log(`[medicalGenAiService] Successfully generated reply using model: ${currentModel}`);
        break;
      }
    } catch (err) {
      lastError = err;
      console.warn(`[medicalGenAiService] Model '${currentModel}' failed: ${err.message}. Trying next candidate...`);
    }
  }

  if (!aiReply) {
    console.error('All Groq candidate models failed. Last error:', lastError?.message);
    if (lastError) {
      logError(lastError, { service: 'analyzeWithAi', groqEndpoint, candidateModels });
    }
    return getContextualFallback(userMessage, effectiveLanguage, greeting, directionIntent);
  }

  if (offTopic) {
    aiReply = stripCodeBlocks(aiReply);
  }

  if (looksLikeWrongLanguage(aiReply, effectiveLanguage)) {
    aiReply =
      getRedirectMessage(effectiveLanguage) +
      (effectiveLanguage === 'hi'
        ? ' कृपया अपने लक्षण दोबारा बताएं।'
        : effectiveLanguage === 'bn'
        ? ' অনুগ্রহ করে আপনার लक्षणগুলো আবার বলুন।'
        : effectiveLanguage === 'ta'
        ? ' தயவுசெய்து உங்கள் அறிகுறிகளை மீண்டும் கூறவும்.'
        : ' Could you tell me more about your symptoms?');
  }

  return aiReply;
};
