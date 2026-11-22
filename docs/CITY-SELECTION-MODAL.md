# اختيار المدينة — الدليل المرجعي (CityPickerModal + cityService)

توثيق كامل لنظام اختيار المدينة في تطبيق Slati Pro: مجموعة البيانات، طبقة الخدمة، ونافذة الاختيار المنبثقة، مع تدفق البيانات ودليل إضافة مدن جديدة.

## البنية

| الملف | الدور |
|---|---|
| `src/data/cities.js` | مجموعة المدن المدمجة (30 مدينة، ثلاثية اللغة en/fr/ar) |
| `src/services/cityService.js` | طبقة الخدمة: بحث، تطبيع عربي، تخزين، حساب مواقيت لمدينة |
| `src/components/CityPickerModal.js` | نافذة منبثقة (bottom sheet) للاختيار مع حقل بحث |
| `src/screens/SettingsScreen.js` | يستدعي النافذة ويحفظ الاختيار |
| `src/i18n.js` | مفاتيح الترجمة تحت `cityPicker.*` |

---

## 1. مخطط بيانات المدينة

كل مدينة في `CITIES` (من `src/data/cities.js`) تتبع هذا الشكل:

```js
{
  id: 'ma-khouribga',                    // slug فريد: '{رمز بلد بأحرف صغيرة}-{اسم}'
  name: { en: 'Khouribga', fr: 'Khouribga', ar: 'خريبكة' },
  country: { en: 'Morocco', fr: 'Maroc', ar: 'المغرب' },
  countryCode: 'MA',                     // ISO 3166-1 alpha-2 بأحرف كبيرة
  latitude: 32.8811,                     // درجات عشرية
  longitude: -6.9063,
  timezone: 'Africa/Casablanca',         // IANA tz name
  aliases: ['Khourigba'],                // اختياري: بدائل البحث
}
```

قواعد إلزامية (يتحقق منها `isValidCity` داخل الخدمة):
- `id` فريد بأحرف صغيرة — هو مفتاح التخزين الوحيد.
- `name` و `country` كائنات ثلاثية اللغة (`en` إلزامي عمليًا، والعرض يرتد إليه).
- `latitude`/`longitude` أرقام صالحة، و `timezone` اسم IANA صحيح (يُستخدم في `tz-lookup` التوازي وحساب الإزاحة).

## 2. مرجع `cityService.js`

### الثوابت

- `SELECTED_CITY_KEY = 'slati.selectedCity.v1'` — مفتاح AsyncStorage. القيمة المحفوظة هي **city id كنص**؛ وعند القراءة يُقبل أيضًا صيغة قديمة `{ id: ... }` كـ JSON للتوافق الخلفي.

### البحث والعرض

| الدالة | التوقيع | الوصف |
|---|---|---|
| `searchCities` | `(query, { language?, countryCode?, limit? = 50 }) → City[]` | بحث رمزي مع ترتيب ذكي (انظر أدناه). استعلام فارغ = كل المدن |
| `getCityById` | `(cityId) → City \| null` | بحث بحساسية غير حسّاسة لحالة الأحرف |
| `getCitiesByCountry` | `(countryCode?) → City[]` | تصفية برمز البلد، أو نسخة كاملة إذا أُهمل |
| `getCityName` | `(city, language = 'en') → string` | اسم المدينة باللغة المطلوبة مع ارتداد en→fr→ar |
| `getCountryName` | `(city, language = 'en') → string` | اسم البلد بنفس المنطق |
| `getCityLabel` | `(city, language = 'en') → string` | `"المدينة, البلد"` أو الاسم وحده |

**التطبيع العربي** (`normalizeText` — داخلي): يُطبَّق على الاستعلام والفهرس معًا فيبحث "الخرابكه" أو "khouribga" أو "خريبكة" بنفس النتيجة:
1. `NFD` + حذف علامات التشكيل اللاتينية (`\u0300-\u036f`) والعربية (`\u064b-\u065f\u0670\u0640`).
2. توحيد الحروف: `أإآٱ → ا`، `ى → ي`، `ة → ه`.
3. أي شيء غير `a-z0-9` أو حرف عربي يصبح مسافة، ثم ضغط المسافات.

**ترتيب النتائج** (rank تصاعدي):
- `0`: تطابق تام للاسم/الاسم المستعار بعد التطبيع.
- `1`: الاسم يبدأ بالاستعلام.
- `2`: كل كلمات الاستعلام موجودة في الاسم.
- `3`: تطابق في أي مكان (id، countryCode، البلد، الأسماء المستعارة).
عند تعادل الرتب: ترتيب أبجدي باسم المدينة بلغة العرض (`localeCompare`).

**ملاحظة أداء**: `SEARCH_INDEX` يُبنى مرة واحدة عند تحميل الوحدة — لا كلفة لكل بحث، ومجموعة 30 مدينة لا تحتاج تحسينات إضافية.

### التخزين

| الدالة | التوقيع | الوصف |
|---|---|---|
| `getSelectedCity` | `async () → City \| null` | يقرأ المفتاح ويُعيد كائن المدينة الكامل |
| `setSelectedCity` | `async (cityOrId) → City` | يتحقق من وجود المدينة ثم يخزّن `id`؛ **يرمي** `Error` لمدينة غير معروفة (الاسم البديل: `saveSelectedCity`) |
| `clearSelectedCity` | `async () → void` | يحذف المفتاح |

### الربط بحساب المواقيت

| الدالة | التوقيع | الوصف |
|---|---|---|
| `cityToManualLocation` | `(cityOrId, language = 'en') → ManualLocation` | يحوّل المدينة إلى كائن الموقع اليدوي: `{ cityId, city, country, label, latitude, longitude, timeZone }` — هو ما يُخزَّن في إعدادات التطبيق |
| `calculatePrayerTimesForCity` | `(cityOrId, settings?, date?) → { cityId, timeZone, utcOffset, date, times }` | يحسب المواقيت مباشرة من بيانات المدينة عبر `computePrayerTimes` مع `getDatePartsInTimeZone`/`getTimeZoneOffset` من `src/location.js`، وإعدادات افتراضية: `method: 'Morocco'`، `asr: 'standard'`، `highLatRule: 'middle-of-night'` |
| `getSelectedCityPrayerTimes` | `async (settings?, date?) → Result \| null` | مريحة: `getSelectedCity` ثم `calculatePrayerTimesForCity` |

## 3. نافذة الاختيار `CityPickerModal.js`

### Props

```jsx
<CityPickerModal
  visible={boolean}          // إظهار/إخفاء
  onClose={() => {}}         // الخلفية، زر الإغلاق، أو زر الرجوع (Android)
  onSelect={(city) => {}}    // يُستدعى بكائن المدينة الكامل عند الضغط
  selectedCityId={'ma-khouribga'}  // اختياري: يُبرز المدينة الحالية بعلامة ✓
/>
```

### السلوك والتصميم

- **Bottom sheet** شفاف الخلفية (`animationType="slide"`, `statusBarTranslucent`) مع مقبض سحب وزر إغلاق (أيقونة `close` من MaterialCommunityIcons).
- **حقل بحث** فوري: كل ضغطة تعيد الحساب عبر `useMemo(() => searchCities(query, { language }))` — بلا debounce (مجموعة صغيرة تجعله غير ضروري). زر ✕ لمسح الاستعلام.
- **`FlatList`** للنتائج مع `keyExtractor={item.id}` و `keyboardShouldPersistTaps="handled"`؛ صف كل مدينة: أيقونة موقع + الاسم + البلد + سهم اتجاهي حسب `isRTL` (أو ✓ إذا مختارة).
- **حالة فارغة** (أيقونة `map-marker-off-outline`) عند عدم وجود نتائج.
- **إعادة ضبط البحث** عند كل إغلاق (`useEffect` على `visible`).
- **RTL كامل**: تخطيط وترتيب أيقونات وأسلطة نص يتبدلون مع `isRTL` من `useI18n`، والأنماط تُبنى عبر `createStyles(colors, isRTL)` مؤمّنة بـ `useMemo`.
- **الثيم والترجمة والحواف الآمنة**: `useTheme` للألوان، `useI18n` للنصوص، `useSafeAreaInsets` لتباعد أسفل الشاشة.

### مفاتيح i18n المستخدمة

| المفتاح | الاستخدام |
|---|---|
| `cityPicker.title` | عنوان النافذة |
| `cityPicker.subtitle` | سطر الشرح تحت العنوان |
| `cityPicker.search` | placeholder حقل البحث |
| `cityPicker.close` | accessibilityLabel لزر الإغلاق |
| `cityPicker.empty` | عنوان حالة "لا نتائج" |
| `cityPicker.emptyHint` | نص إرشادي تحت العنوان |

(مضمنة بالثلاث لغات في `src/i18n.js`.)

## 4. تدفق البيانات الكامل

```
SettingsScreen
  ├─ يفتح <CityPickerModal> عند طلب تغيير المدينة
  └─ onSelect(city) → selectDatasetCity():
       1. location = cityToManualLocation(city, language)
       2. updateSettings({ manualLocation: location, ... })   ← مصدر الحقيقة للعرض
       3. saveSelectedCity(city.id)                            ← تخزين دائم مستقل (.catch متسامح)
            ↓
PrayerTimesScreen (وأي شاشة أخرى)
  └─ يقرأ settings.manualLocation
       (lat/lng/timeZone/label) ويحسب المواقيت عبر محرك src/prayerTimes.js
```

- **`settings.manualLocation`** هو مصدر الحقيقة للتشغيل الفوري في الجلسة؛ **`AsyncStorage` عبر `saveSelectedCity`** هو الأرشيف الدائم الذي تُستعاد منه `getSelectedCity()`/`getSelectedCityPrayerTimes()` عند إقلاع لاحق.
- اختيار مدينة يلغي الحاجة لإذن الموقع الجغرافي: `timeZone` من بيانات المدينة بدل `tz-lookup` عند الإحداثيات.

## 5. كيفية إضافة مدينة جديدة

1. أضف كائنًا جديدًا في `CITIES` بـ `src/data/cities.js` ملتزمًا بالمخطط أعلاه (id فريد بصيغة slug، أسماء ثلاثية، ISO code، إحداثيات عشرية، IANA timezone).
2. تحقق من:
   - `timezone` صحيح لذلك الموقع (الأخطاء هنا تزيح كل المواقيت).
   - لا تكرار في `id` أو اسم إنجليزي مطابق لمدينة أخرى (يربك البحث).
3. أضف أسماء بديلة مفيدة في `aliases` (تهجئات فرنسية شائعة في المغرب/الجزائر/تونس، أو أسماء قديمة).
4. لا حاجة لأي تعديل في الخدمة أو النافذة: الفهرس والبحث والتخزين تعمل تلقائيًا على المجموعة الجديدة.
5. (اختياري) إن كانت المدينة أول ممثل لبلد جديد، أضف `country` بالثلاث لغات مرة واحدة وستُستخدم لكل مدن البلد.

## 6. حدود معروفة

- 30 مدينة فقط مدمجة — البحث لا يرجع نتائج خارج المجموعة (لا geocoding شبكي؛ التطبيق يعمل أوفلاين بالكامل).
- لا أحداث `onChange` خارجية داخل النافذة: الشاشة المستدعية مسؤولة عن حفظ الاختيار في `onSelect`.
- `searchCities` يقارن كلمات كاملة بعد التطبيع (لا مطابقة جزئية داخل الكلمة إلا عبر `includes` على السلسلة المدمجة) — أسماء قصيرة شائعة قد تُظهر نتائج كثيرة برتبة 3.
