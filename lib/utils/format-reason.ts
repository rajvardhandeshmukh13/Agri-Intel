// lib/utils/format-reason.ts
// Localizes recommendation reasons into Marathi and Hindi with agricultural terminology.

import type { AppLocale } from '@/lib/i18n/context';

const CROP_TRANSLATIONS: Record<string, { en: string; mr: string; hi: string }> = {
  soybean: { en: 'Soybean', mr: 'सोयाबीन', hi: 'सोयाबीन' },
  wheat: { en: 'Wheat', mr: 'गहू', hi: 'गेहूं' },
  cotton: { en: 'Cotton', mr: 'कापूस', hi: 'कपास' },
  onion: { en: 'Onion', mr: 'कांदा', hi: 'प्याज' },
  tur: { en: 'Tur', mr: 'तूर', hi: 'अरहर / तूर' },
  jowar: { en: 'Jowar', mr: 'ज्वारी', hi: 'ज्वार' },
  sugarcane: { en: 'Sugarcane', mr: 'ऊस', hi: 'गन्ना' },
};

export function getCropTranslation(crop: string, locale: AppLocale): string {
  const key = (crop || 'soybean').toLowerCase();
  const entry = CROP_TRANSLATIONS[key];
  if (entry) {
    return entry[locale] || entry.en;
  }
  return crop.charAt(0).toUpperCase() + crop.slice(1);
}

/**
 * Localizes an individual recommendation reason string into the active locale.
 */
export function localizeReason(reason: string, locale: AppLocale, crop = 'soybean'): string {
  if (locale === 'en') return reason;

  const cropName = getCropTranslation(crop, locale);

  // 1. Price trend patterns
  if (/price trend is relatively stable/i.test(reason) || /prices are relatively stable/i.test(reason)) {
    return locale === 'mr'
      ? `${cropName}चे भाव सध्या तुलनेने स्थिर आहेत — थोडी वाट पाहण्याची संधी आहे`
      : `${cropName} के भाव अभी अपेक्षाकृत स्थिर हैं — प्रतीक्षा करने का मध्यम अवसर है`;
  }
  if (/prices have softened recently/i.test(reason)) {
    const match = reason.match(/\(([-\d.]+)%\)/);
    const pct = match ? match[1] : '';
    return locale === 'mr'
      ? `${cropName}चे भाव नुकतेच थोडे घसरले आहेत${pct ? ` (${pct}%)` : ''} — लवकर विक्री केल्याने पुढील तोट्याची जोखीम कमी होते`
      : `${cropName} की कीमतों में हाल ही में गिरावट आई है${pct ? ` (${pct}%)` : ''} — जल्दी बेचने से नुकसान का जोखिम कम होता है`;
  }
  if (/prices are rising/i.test(reason)) {
    const match = reason.match(/\(([-\d.]+)%\)/);
    const pct = match ? match[1] : '';
    return locale === 'mr'
      ? `${cropName}चे भाव वाढत आहेत${pct ? ` (${pct}%)` : ''} — माल रोखून ठेवल्यास चांगला नफा मिळू शकतो`
      : `${cropName} की कीमतें बढ़ रही हैं${pct ? ` (${pct}%)` : ''} — माल रोके रखने से अधिक लाभ की संभावना है`;
  }

  // 2. Arrivals patterns
  if (/mandi arrivals are stable/i.test(reason) || /arrivals are stable/i.test(reason)) {
    return locale === 'mr'
      ? 'मंडईतील आवक स्थिर आहे — बाजारात पुरवठ्याचा तत्काळ कोणताही दबाव नाही'
      : 'मंडी में आवक स्थिर है — बाजार में आपूर्ति का कोई तत्काल दबाव नहीं है';
  }
  if (/arrivals at mandis are rising/i.test(reason) || /arrivals are rising/i.test(reason)) {
    return locale === 'mr'
      ? 'मंडईत आवक वाढत आहे — पुढील २ आठवड्यांत पुरवठा वाढल्याने भाव थोडे कमी होऊ शकतात'
      : 'मंडी में आवक बढ़ रही है — अगले 2 हफ्तों में आपूर्ति बढ़ने से भाव थोड़े नरम हो सकते हैं';
  }
  if (/market arrivals are low/i.test(reason) || /arrivals are low/i.test(reason)) {
    return locale === 'mr'
      ? 'मंडईतील आवक कमी आहे — पुरवठा कमी असल्याने भावाला चांगला आधार मिळू शकतो'
      : 'मंडी में आवक कम है — कम आपूर्ति से कीमतों को समर्थन मिल सकता है';
  }

  // 3. Weather patterns
  if (/weather outlook is favorable/i.test(reason) || /favorable for the next/i.test(reason)) {
    return locale === 'mr'
      ? 'पुढील ७ दिवसांचे हवामान अनुकूल आहे — वाहतूक करण्यासाठी चांगला कालावधी आहे'
      : 'अगले 7 दिनों के लिए मौसम अनुकूल है — परिवहन के लिए अच्छा समय है';
  }
  if (/some rain expected/i.test(reason)) {
    return locale === 'mr'
      ? 'या आठवड्यात पावसाची शक्यता आहे — वाहतुकीचे नियोजन काळजीपूर्वक करा'
      : 'इस सप्ताह बारिश की संभावना है — परिवहन का समय सावधानी से तय करें';
  }
  if (/heavy rain forecast/i.test(reason)) {
    return locale === 'mr'
      ? 'पुढील ५ दिवसांत मुसळधार पावसाचा अंदाज आहे — काढणी किंवा वाहतुकीत अडथळा येऊ शकतो'
      : 'अगले 5 दिनों में भारी बारिश का अनुमान है — कटाई या परिवहन में बाधा आ सकती है';
  }

  // 4. Mandi net price pattern
  // e.g. "Pune offers the best estimated net price after transport — ₹7,143/qtl"
  const mandiMatch = reason.match(/(.+) offers the best estimated net price after transport — (₹[\d,]+)\/qtl/i);
  if (mandiMatch) {
    const mandiName = mandiMatch[1]?.trim() || '';
    const price = mandiMatch[2]?.trim() || '';
    return locale === 'mr'
      ? `वाहतूक खर्च वजा जाता ${mandiName} मंडईत सर्वोत्तम अंदाजित निव्वळ भाव (${price}/क्विंटल) मिळतो`
      : `परिवहन खर्च घटाने के बाद ${mandiName} मंडी में सबसे अच्छा अनुमानित शुद्ध भाव (${price}/क्विंटल) मिल रहा है`;
  }

  // 5. Strategy patterns
  if (/selling now locks in/i.test(reason) || /selling now/i.test(reason)) {
    return locale === 'mr'
      ? 'आत्ताच विक्री केल्याने चालू चांगला बाजारभाव सुरक्षित होतो आणि माल साठवण्याचा धोका टळतो'
      : 'अभी बेचने से मौजूदा अच्छा भाव पक्का होता है और माल रोके रखने का जोखिम नहीं रहता';
  }
  if (/waiting ~7 days/i.test(reason) || /wait ~7 days/i.test(reason)) {
    return locale === 'mr'
      ? 'सुमारे ७ दिवस थांबल्यास वाहतूक व साठवणूक जोखीम विचारात घेऊनही जास्त निव्वळ नफा मिळण्याचा अंदाज आहे'
      : 'लगभग 7 दिन रुकने पर परिवहन और जोखिम के बावजूद अधिक शुद्ध लाभ मिलने का अनुमान है';
  }
  if (/14-day hold/i.test(reason) || /wait ~14 days/i.test(reason)) {
    return locale === 'mr'
      ? 'हवामान आणि बाजार स्थिर राहिल्यास १४ दिवस थांबल्यास जास्तीत जास्त फायदा होण्याची शक्यता आहे'
      : 'मौसम और बाजार स्थिर रहने पर 14 दिन रुकने से अधिकतम लाभ की संभावना है';
  }

  return reason;
}
