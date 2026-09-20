import React, { useState, useEffect, useRef } from 'react';
import { FilePlus2, Cross, MapPin, AlertCircle, ChevronDown, ChevronRight } from "lucide-react";

/* Pick the string for the active conversation language. */
const T = (en, hi, bn, ta) => ({ en, hi, bn, ta });
const pick = (obj, lang) => obj[lang] || obj.en;

/* PWA breakpoint — expandable options + hover preview apply ONLY here.
   Desktop (website UI) keeps the original one-tap behavior untouched. */
const PWA_QUERY = '(max-width: 768px)';
const isPwaViewport = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia(PWA_QUERY).matches;

const ACTIONS = [
  {
    id: 'direction',
    icon: MapPin,
    className: 'direction',
    label: T('App Direction Help', 'दिशा सहायता (Directions)', 'দিকনির্দেশ সাহায্য', 'வழிசெலுத்தல் உதவி'),
    query: T(
      'Where can I find Document Upload, Socrates Form, ABHA ID, and Code Search pages on this platform?',
      'मुझे प्लेटफ़ॉर्म नेविगेशन और दिशा सहायता चाहिए: दस्तावेज़ अपलोड, सुकरात फॉर्म, आभा आईडी और कोड सर्च कहाँ मिलेंगे?',
      'আমার প্ল্যাটফর্ম নেভিগেশন ও দিকনির্দেশ সাহায্য প্রয়োজন: ডকুমেন্ট আপলোড, সাক্রেটিস ফর্ম, আভা আইডি এবং কোড সার্চ কোথায় পাব?',
      'எனக்கு பிளாட்ஃபார்ம் வழிசெலுத்தல் உதவி தேவை: ஆவணப் பதிவேற்றம், சாக்ரடீஸ் படிவம், ஆபா ஐடி மற்றும் குறியீடு தேடல் எங்கே கிடைக்கும்?'
    ),
    options: [
      {
        label: T('Upload Documents', 'दस्तावेज़ अपलोड', 'ডকুমেন্ট আপলোড', 'ஆவணப் பதிவேற்றம்'),
        query: T(
          'Where do I upload my medical documents on this platform?',
          'मैं इस प्लेटफ़ॉर्म पर अपने मेडिकल दस्तावेज़ कहाँ अपलोड करूं?',
          'এই প্ল্যাটফর্মে আমার মেডিকেল ডকুমেন্ট কোথায় আপলোড করব?',
          'இந்த தளத்தில் என் மருத்துவ ஆவணங்களை எங்கே பதிவேற்றுவது?'
        ),
      },
      {
        label: T('Socrates Form', 'सुकरात फॉर्म', 'সক্রেটিস ফর্ম', 'சாக்ரடீஸ் படிவம்'),
        query: T(
          'Where is the Socrates pain assessment form?',
          'सुकरात दर्द मूल्यांकन फॉर्म कहाँ है?',
          'সক্রেটিস ব্যথা মূল্যায়ন ফর্ম কোথায়?',
          'சாக்ரடீஸ் வலி மதிப்பீட்டு படிவம் எங்கே?'
        ),
      },
      {
        label: T('ABHA ID', 'आभा आईडी', 'আভা আইডি', 'ஆபா ஐடி'),
        query: T(
          'Where can I find my ABHA ID on this platform?',
          'मुझे मेरी आभा आईडी इस प्लेटफ़ॉर्म पर कहाँ मिलेगी?',
          'এই প্ল্যাটফর্মে আমার আভা আইডি কোথায় পাব?',
          'இந்த தளத்தில் எனது ஆபா ஐடி எங்கே கிடைக்கும்?'
        ),
      },
    ],
  },
  {
    id: 'emergency',
    icon: AlertCircle,
    className: 'emergency',
    label: T('Medical Emergency', 'आपातकालीन (Emergency)', 'জরুরি (Emergency)', 'அவசரம் (Emergency)'),
    query: T(
      'I have a medical emergency: severe chest pain and dizziness. What should I do?',
      'मुझे आपातकालीन समस्या है: बहुत तेज़ सीने में दर्द और चक्कर आ रहे हैं। मुझे क्या करना चाहिए?',
      'আমার জরুরি চিকিৎসা সমস্যা: তীব্র বুকে ব্যথা এবং মাথা ঘোরাচ্ছে। আমার কী করা উচিত?',
      'எனக்கு அவசர மருத்துவப் பிரச்சனை: கடுமையான நெஞ்சு வலி மற்றும் தலைச்சுற்றல் உள்ளது. நான் என்ன செய்ய வேண்டும்?'
    ),
    options: [
      {
        label: T('Chest Pain', 'सीने में दर्द', 'বুকে ব্যথা', 'நெஞ்சு வலி'),
        query: T(
          'I have severe chest pain. What should I do right now?',
          'मुझे तेज़ सीने में दर्द है। मुझे अभी क्या करना चाहिए?',
          'আমার তীব্র বুকে ব্যথা হচ্ছে। এখনই কী করব?',
          'எனக்கு கடுமையான நெஞ்சு வலி உள்ளது. இப்போது என்ன செய்ய வேண்டும்?'
        ),
      },
      {
        label: T('Breathing Trouble', 'सांस की दिक्कत', 'শ্বাসকষ্ট', 'மூச்சுத் திணறல்'),
        query: T(
          'I am having difficulty breathing. What should I do?',
          'मुझे सांस लेने में दिक्कत हो रही है। मुझे क्या करना चाहिए?',
          'আমার শ্বাস নিতে কষ্ট হচ্ছে। আমার কী করা উচিত?',
          'எனக்கு மூச்சு விட சிரமமாக உள்ளது. நான் என்ன செய்ய வேண்டும்?'
        ),
      },
      {
        label: T('High Fever', 'तेज़ बुखार', 'তীব্র জ্বর', 'கடும் காய்ச்சல்'),
        query: T(
          'I have a very high fever with chills. Is it an emergency?',
          'मुझे ठंड लगने के साथ बहुत तेज़ बुखार है। क्या यह आपातकाल है?',
          'কাঁপুনি দিয়ে আমার খুব জ্বর এসেছে। এটা কি জরুরি অবস্থা?',
          'எனக்கு நடுக்கத்துடன் கடுமையான காய்ச்சல் உள்ளது. இது அவசரநிலையா?'
        ),
      },
    ],
  },
  {
    id: 'consultation',
    icon: FilePlus2,
    className: 'consultation',
    label: T('Symptom Consultation', 'लक्षण परामर्श', 'লক্ষণ পরামর্শ', 'அறிகுறி ஆலோசனை'),
    query: T(
      'I have had a mild fever and persistent cough for 2 days. What consultation advice can you give?',
      'मुझे पिछले 2 दिनों से हल्का बुखार और खांसी है। आप मुझे क्या सलाह और देखभाल देंगे?',
      'আমার গত ২ দিন ধরে মৃদু জ্বর এবং কাশি রয়েছে। আপনি আমাকে কী পরামর্শ দেবেন?',
      'எனக்கு 2 நாட்களாக லேசான காய்ச்சல் மற்றும் இருமல் உள்ளது. எனக்கு என்ன ஆலோசனை தருவீர்கள்?'
    ),
    options: [
      {
        label: T('Fever & Cough', 'बुखार-खांसी', 'জ্বর-কাশি', 'காய்ச்சல்-இருமல்'),
        query: T(
          'I have had a mild fever and persistent cough for 2 days. What consultation advice can you give?',
          'मुझे पिछले 2 दिनों से हल्का बुखार और खांसी है। आप मुझे क्या सलाह और देखभाल देंगे?',
          'আমার গত ২ দিন ধরে মৃদু জ্বর এবং কাশি রয়েছে। আপনি আমাকে কী পরামর্শ দেবেন?',
          'எனக்கு 2 நாட்களாக லேசான காய்ச்சல் மற்றும் இருமல் உள்ளது. எனக்கு என்ன ஆலோசனை தருவீர்கள்?'
        ),
      },
      {
        label: T('Headache', 'सिरदर्द', 'মাথাব্যথা', 'தலைவலி'),
        query: T(
          'I have had a headache since this morning. What should I do?',
          'मुझे सुबह से सिरदर्द है। मुझे क्या करना चाहिए?',
          'সকাল থেকে আমার মাথাব্যথা করছে। আমার কী করা উচিত?',
          'காலை முதல் எனக்கு தலைவலி உள்ளது. நான் என்ன செய்ய வேண்டும்?'
        ),
      },
      {
        label: T('Stomach Pain', 'पेट दर्द', 'পেটে ব্যথা', 'வயிற்று வலி'),
        query: T(
          'I have stomach pain after eating. What care do you suggest?',
          'खाने के बाद मेरे पेट में दर्द है। आप क्या सलाह और देखभाल देंगे?',
          'খাওয়ার পর আমার পেটে ব্যথা হচ্ছে। আপনি কী পরামর্শ দেবেন?',
          'சாப்பிட்ட பிறகு வயிறு வலிக்கிறது. என்ன பராமரிப்பு பரிந்துரைக்கிறீர்கள்?'
        ),
      },
    ],
  },
  {
    id: 'medtalk',
    icon: Cross,
    className: 'medtalk',
    label: T('Daily Med Talk', 'स्वास्थ्य टिप्स', 'স্বাস্থ্য টিপস', 'சுகாதார குறிப்புகள்'),
    query: T(
      'What are key daily health habits, food, rest and lifestyle tips?',
      'दैनिक स्वास्थ्य आदतें, अच्छा भोजन और आराम की सलाह दें।',
      'দৈনন্দিন স্বাস্থ্য অভ্যাস, পুষ্টিকর খাবার এবং বিশ্রামের পরামর্শ দিন।',
      'தினசரி சுகாதார பழக்கவழக்கங்கள், நல்ல உணவு மற்றும் ஓய்வு பற்றிய குறிப்புகளைத் தரவும்.'
    ),
    options: [
      {
        label: T('Food Habits', 'भोजन आदतें', 'খাদ্যাভ্যাস', 'உணவுப் பழக்கம்'),
        query: T(
          'What healthy daily food habits should I follow?',
          'मुझे रोज़ कौन सी स्वस्थ भोजन आदतें अपनानी चाहिए?',
          'আমার প্রতিদিন কী স্বাস্থ্যকর খাদ্যাভ্যাস মেনে চলা উচিত?',
          'நான் தினமும் பின்பற்ற வேண்டிய ஆரோக்கியமான உணவுப் பழக்கங்கள் என்ன?'
        ),
      },
      {
        label: T('Sleep & Rest', 'नींद और आराम', 'ঘুম ও বিশ্রাম', 'தூக்கம்-ஓய்வு'),
        query: T(
          'How much sleep and rest do I need daily to stay healthy?',
          'स्वस्थ रहने के लिए मुझे रोज़ कितनी नींद और आराम चाहिए?',
          'সুস্থ থাকতে প্রতিদিন আমার কতটা ঘুম ও বিশ্রাম দরকার?',
          'ஆரோக்கியமாக இருக்க தினமும் எனக்கு எவ்வளவு தூக்கம் மற்றும் ஓய்வு தேவை?'
        ),
      },
      {
        label: T('Exercise', 'व्यायाम', 'ব্যায়াম', 'உடற்பயிற்சி'),
        query: T(
          'What light daily exercise do you recommend for me?',
          'मेरे लिए रोज़ कौन सा हल्का व्यायाम सही रहेगा?',
          'আমার জন্য প্রতিদিন কী হালকা ব্যায়াম ভালো হবে?',
          'எனக்கு தினமும் என்ன லேசான உடற்பயிற்சியைப் பரிந்துரைக்கிறீர்கள்?'
        ),
      },
    ],
  },
];

export const QuickActions = ({ onSelectAction, onPreviewAction, language = 'en' }) => {
  // PWA-only feature gate: desktop keeps the original one-tap behavior.
  const [isPwa, setIsPwa] = useState(isPwaViewport);
  // Which of the 4 chips is expanded to show its recommendation options.
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    onPreviewActionRef.current = onPreviewAction;
  });

  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(PWA_QUERY);
    const onChange = (e) => {
      setIsPwa(e.matches);
      if (!e.matches) {
        setExpanded(null);
        onPreviewActionRef.current?.(null);
      }
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Keep a ref so the media-query listener always calls the latest callback.
  const onPreviewActionRef = useRef(onPreviewAction);

  // Leaving hover/focus always restores the user's own input text.
  useEffect(() => {
    if (!expanded) onPreviewActionRef.current?.(null);
  }, [expanded]);

  const handleChipClick = (action) => {
    if (!isPwa) {
      // Website UI: unchanged — tap fills the input directly.
      onSelectAction(pick(action.query, language));
      return;
    }
    // PWA: tap expands the recommendation-type options for this chip.
    onPreviewActionRef.current?.(null);
    setExpanded((prev) => (prev === action.id ? null : action.id));
  };

  const handleOptionSelect = (option) => {
    onSelectAction(pick(option.query, language));
    setExpanded(null);
  };

  return (
    <div className="quick-actions-bar">
      {ACTIONS.map((action) => {
        const Icon = action.icon;
        const isOpen = expanded === action.id;
        return (
          <div key={action.id} className="action-chip-wrap">
            <button
              type="button"
              className={`action-chip ${action.className}`}
              aria-expanded={isPwa ? isOpen : undefined}
              onClick={() => handleChipClick(action)}
            >
              <Icon size={18} />
              <span>{pick(action.label, language)}</span>
              {isPwa && (
                <ChevronDown size={16} className={`chip-chevron${isOpen ? ' open' : ''}`} />
              )}
            </button>
            {isPwa && isOpen && (
              <div className="action-suboptions" role="listbox" aria-label={pick(action.label, language)}>
                {action.options.map((option) => (
                  <button
                    key={option.label.en}
                    type="button"
                    role="option"
                    aria-selected="false"
                    className="action-suboption"
                    onMouseEnter={() => onPreviewActionRef.current?.(pick(option.query, language))}
                    onMouseLeave={() => onPreviewActionRef.current?.(null)}
                    onFocus={() => onPreviewActionRef.current?.(pick(option.query, language))}
                    onBlur={() => onPreviewActionRef.current?.(null)}
                    onClick={() => handleOptionSelect(option)}
                  >
                    <ChevronRight size={15} />
                    <span>{pick(option.label, language)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default QuickActions;
