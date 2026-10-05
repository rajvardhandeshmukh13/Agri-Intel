// app/onboarding/page.tsx
// Farm onboarding wizard — 5 steps with precise field location & polygon boundary drawing.

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { useTranslation } from '@/lib/i18n/context';
import { useAuth } from '@/lib/auth/context';
import { saveStoredFarm, DISTRICT_COORDINATES, CROP_INPUT_COSTS, formatCropName } from '@/lib/utils/farm-storage';
import { generateBoxPolygon } from '@/lib/utils/geometry';
import type { CropName, SoilType, IrrigationType } from '@/lib/types/farm';

// Dynamically import FieldLocationPicker with SSR disabled (Leaflet requires window)
const FieldLocationPicker = dynamic(() => import('@/components/farm/FieldLocationPicker'), {
  ssr: false,
  loading: () => (
    <div className="h-64 bg-muted/40 rounded-xl flex flex-col items-center justify-center p-4 text-center animate-pulse border border-border">
      <span className="text-3xl mb-1">🗺️</span>
      <p className="text-xs text-muted-foreground">Loading interactive field map...</p>
    </div>
  ),
});

interface OnboardingState {
  crop: CropName | '';
  state: string;
  district: string;
  village: string;
  lat: number;
  lng: number;
  fieldGeoJson: GeoJSON.Polygon;
  areaHectares: string;
  sowingDate: string;
  soilType: SoilType | '';
  irrigationType: IrrigationType | '';
  inputCostPerHa: string;
}

const CROPS: { id: CropName; label: string; labelMr: string; labelHi: string; icon: string }[] = [
  { id: 'soybean', label: 'Soybean', labelMr: 'सोयाबीन', labelHi: 'सोयाबीन', icon: '🌿' },
  { id: 'sugarcane', label: 'Sugarcane', labelMr: 'ऊस', labelHi: 'गन्ना', icon: '🎋' },
  { id: 'wheat', label: 'Wheat', labelMr: 'गहू', labelHi: 'गेहूं', icon: '🌾' },
  { id: 'cotton', label: 'Cotton', labelMr: 'कापूस', labelHi: 'कपास', icon: '🪴' },
  { id: 'onion', label: 'Onion', labelMr: 'कांदा', labelHi: 'प्याज', icon: '🧅' },
  { id: 'tur', label: 'Tur (Pigeon Pea)', labelMr: 'तूर', labelHi: 'अरहर / तूर', icon: '🫘' },
  { id: 'jowar', label: 'Jowar', labelMr: 'ज्वारी', labelHi: 'ज्वार', icon: '🌽' },
];

const MAHARASHTRA_DISTRICTS = [
  'Latur', 'Nanded', 'Osmanabad', 'Solapur', 'Sangli', 'Satara',
  'Kolhapur', 'Pune', 'Ahmednagar', 'Nashik', 'Aurangabad',
  'Jalna', 'Beed', 'Parbhani', 'Hingoli', 'Buldhana', 'Washim', 'Yavatmal',
];

export default function OnboardingPage() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { user } = useAuth();
  const [step, setStep] = useState(1);

  const [form, setForm] = useState<OnboardingState>({
    crop: '',
    state: 'Maharashtra',
    district: '',
    village: '',
    lat: 18.2333,
    lng: 76.7167,
    fieldGeoJson: generateBoxPolygon(18.2333, 76.7167),
    areaHectares: '3.5',
    sowingDate: '2024-06-20',
    soilType: 'black',
    irrigationType: 'rainfed',
    inputCostPerHa: '18000',
  });

  const totalSteps = 5;

  function update<K extends keyof OnboardingState>(field: K, value: OnboardingState[K]) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // When district updates, sync coordinates if available
      if (field === 'district' && typeof value === 'string' && DISTRICT_COORDINATES[value]) {
        const coords = DISTRICT_COORDINATES[value];
        next.lat = coords.lat;
        next.lng = coords.lng;
        next.fieldGeoJson = generateBoxPolygon(coords.lat, coords.lng);
      }
      // When crop updates, sync default input costs
      if (field === 'crop' && typeof value === 'string' && CROP_INPUT_COSTS[value]) {
        next.inputCostPerHa = String(CROP_INPUT_COSTS[value]);
      }
      return next;
    });
  }

  function handleLocationChange(result: {
    lat: number;
    lng: number;
    polygon: GeoJSON.Polygon;
    areaHectares: number;
  }) {
    setForm((prev) => ({
      ...prev,
      lat: result.lat,
      lng: result.lng,
      fieldGeoJson: result.polygon,
      areaHectares: result.areaHectares > 0 ? String(result.areaHectares) : prev.areaHectares,
    }));
  }

  function canProceed() {
    if (step === 1) return !!form.crop;
    if (step === 2) return !!form.district;
    if (step === 3) return !!form.lat && !!form.lng && !!form.fieldGeoJson;
    if (step === 4) return !!form.areaHectares && !!form.sowingDate;
    return true;
  }

  async function handleSubmit() {
    const parsedArea = parseFloat(form.areaHectares) || 3.5;
    const profile = {
      ...form,
      areaHectares: parsedArea,
      inputCostPerHa: parseFloat(form.inputCostPerHa) || 18000,
      inputCosts: parseFloat(form.inputCostPerHa) || 18000,
      id: `farm-${Date.now()}`,
      userId: user?.id || 'local-user',
      name: form.village ? `${form.village} Farm` : 'My Farm',
      commodity: form.crop,
      createdAt: new Date().toISOString(),
    };

    saveStoredFarm(profile);
    router.push('/dashboard');
  }

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌾</span>
            <h1 className="text-xl font-bold text-primary" style={{ fontFamily: 'Outfit, sans-serif' }}>
              AgriIntel
            </h1>
          </div>
          <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">
            {t('common.appName')}
          </span>
        </div>

        <h2 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Outfit, sans-serif' }}>
          {t('onboarding.title')}
        </h2>
        <p className="text-xs text-muted-foreground">
          Step {step} of {totalSteps}
        </p>

        {/* Progress bar */}
        <div className="flex gap-1.5 mt-3">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'flex-1 h-1.5 rounded-full transition-all duration-300',
                i < step ? 'bg-primary' : 'bg-muted'
              )}
            />
          ))}
        </div>
      </div>

      {/* Step 1: Crop Selection */}
      {step === 1 && (
        <div className="space-y-3 flex-1">
          <div>
            <p className="text-base font-semibold">{t('onboarding.cropLabel')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Select your primary seasonal crop</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {CROPS.map((crop) => {
              const subLabel = locale === 'mr' ? crop.labelMr : locale === 'hi' ? crop.labelHi : crop.label;
              return (
                <button
                  key={crop.id}
                  id={`crop-${crop.id}`}
                  onClick={() => update('crop', crop.id)}
                  className={cn(
                    'p-4 rounded-2xl border-2 text-left transition-all duration-200 cursor-pointer',
                    form.crop === crop.id
                      ? 'border-primary bg-primary/10 shadow-sm'
                      : 'border-border bg-card hover:border-primary/40'
                  )}
                >
                  <span className="text-2xl block mb-1">{crop.icon}</span>
                  <p className="text-sm font-semibold">{crop.label}</p>
                  <p className="text-xs text-muted-foreground">{subLabel}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 2: Location & District */}
      {step === 2 && (
        <div className="space-y-4 flex-1">
          <div>
            <p className="text-base font-semibold">{t('onboarding.step2')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Choose your district in Maharashtra</p>
          </div>
          <div>
            <label htmlFor="district" className="text-xs font-medium text-muted-foreground block mb-1">
              {t('onboarding.districtLabel')}
            </label>
            <select
              id="district"
              value={form.district}
              onChange={(e) => update('district', e.target.value)}
              className="w-full px-3 py-3 rounded-xl border border-border bg-card text-foreground text-sm outline-none focus:border-primary transition-colors"
            >
              <option value="">Select District</option>
              {MAHARASHTRA_DISTRICTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="village" className="text-xs font-medium text-muted-foreground block mb-1">
              {t('onboarding.villageLabel')} (Optional)
            </label>
            <input
              id="village"
              type="text"
              placeholder="e.g. Ausa, Renapur"
              value={form.village}
              onChange={(e) => update('village', e.target.value)}
              className="w-full px-3 py-3 rounded-xl border border-border bg-card text-foreground text-sm outline-none focus:border-primary transition-colors"
            />
          </div>
        </div>
      )}

      {/* Step 3: Precise Farm Location & Polygon Boundary */}
      {step === 3 && (
        <div className="space-y-3 flex-1">
          <div>
            <p className="text-base font-semibold">Select / Draw Your Actual Field</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Use GPS, tap map to place your pin, or draw your exact field boundaries.
            </p>
          </div>

          <FieldLocationPicker
            initialLat={form.lat}
            initialLng={form.lng}
            initialPolygon={form.fieldGeoJson}
            district={form.district}
            onLocationChange={handleLocationChange}
          />
        </div>
      )}

      {/* Step 4: Farm Details */}
      {step === 4 && (
        <div className="space-y-4 flex-1">
          <div>
            <p className="text-base font-semibold">{t('onboarding.step3')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Enter sowing dates and agricultural practices</p>
          </div>

          <div>
            <label htmlFor="area" className="text-xs font-medium text-muted-foreground block mb-1">
              {t('onboarding.areaLabel')}
            </label>
            <input
              id="area"
              type="number"
              step="0.1"
              min="0.1"
              value={form.areaHectares}
              onChange={(e) => update('areaHectares', e.target.value)}
              className="w-full px-3 py-3 rounded-xl border border-border bg-card text-foreground text-sm outline-none focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label htmlFor="sowingDate" className="text-xs font-medium text-muted-foreground block mb-1">
              {t('onboarding.sowingDateLabel')}
            </label>
            <input
              id="sowingDate"
              type="date"
              value={form.sowingDate}
              onChange={(e) => update('sowingDate', e.target.value)}
              className="w-full px-3 py-3 rounded-xl border border-border bg-card text-foreground text-sm outline-none focus:border-primary transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="soil" className="text-xs font-medium text-muted-foreground block mb-1">
                {t('onboarding.soilTypeLabel')}
              </label>
              <select
                id="soil"
                value={form.soilType}
                onChange={(e) => update('soilType', e.target.value as SoilType)}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-foreground text-xs outline-none focus:border-primary"
              >
                <option value="black">{t('onboarding.black')}</option>
                <option value="red">{t('onboarding.red')}</option>
                <option value="alluvial">{t('onboarding.alluvial')}</option>
                <option value="loamy">{t('onboarding.loamy')}</option>
                <option value="sandy">{t('onboarding.sandy')}</option>
              </select>
            </div>

            <div>
              <label htmlFor="irrigation" className="text-xs font-medium text-muted-foreground block mb-1">
                {t('onboarding.irrigationLabel')}
              </label>
              <select
                id="irrigation"
                value={form.irrigationType}
                onChange={(e) => update('irrigationType', e.target.value as IrrigationType)}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-foreground text-xs outline-none focus:border-primary"
              >
                <option value="rainfed">{t('onboarding.rainfed')}</option>
                <option value="irrigated">{t('onboarding.irrigated')}</option>
                <option value="partial">{t('onboarding.partial')}</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="inputCost" className="text-xs font-medium text-muted-foreground block mb-1">
              {t('onboarding.inputCostLabel')}
            </label>
            <input
              id="inputCost"
              type="number"
              step="500"
              placeholder="18000"
              value={form.inputCostPerHa}
              onChange={(e) => update('inputCostPerHa', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm outline-none focus:border-primary"
            />
          </div>
        </div>
      )}

      {/* Step 5: Confirmation */}
      {step === 5 && (
        <div className="space-y-4 flex-1">
          <div className="text-center py-2">
            <span className="text-4xl block mb-2">🌱</span>
            <p className="text-lg font-bold" style={{ fontFamily: 'Outfit, sans-serif' }}>
              {t('onboarding.step4')}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t('onboarding.doneMessage')}
            </p>
          </div>

          <Card className="border border-border bg-card/60">
            <CardContent className="p-4 space-y-3 text-xs">
              <div className="flex justify-between border-b border-border/50 pb-2">
                <span className="text-muted-foreground">Crop</span>
                <span className="font-semibold">{formatCropName(form.crop, locale)}</span>
              </div>
              <div className="flex justify-between border-b border-border/50 pb-2">
                <span className="text-muted-foreground">Location</span>
                <span className="font-semibold">
                  {form.village ? `${form.village}, ` : ''}{form.district}, {form.state}
                </span>
              </div>
              <div className="flex justify-between border-b border-border/50 pb-2">
                <span className="text-muted-foreground">Coordinates</span>
                <span className="font-mono text-[11px]">
                  {form.lat.toFixed(4)}, {form.lng.toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between border-b border-border/50 pb-2">
                <span className="text-muted-foreground">Field Boundary</span>
                <span className="font-semibold text-emerald-600">
                  {form.fieldGeoJson.coordinates[0].length - 1} vertices (GeoJSON Polygon)
                </span>
              </div>
              <div className="flex justify-between border-b border-border/50 pb-2">
                <span className="text-muted-foreground">Calculated Area</span>
                <span className="font-semibold">{form.areaHectares} ha</span>
              </div>
              <div className="flex justify-between border-b border-border/50 pb-2">
                <span className="text-muted-foreground">Sowing Date</span>
                <span className="font-semibold">{form.sowingDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Soil & Irrigation</span>
                <span className="font-semibold capitalize">
                  {form.soilType} · {form.irrigationType}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex gap-3 mt-6 pt-4 border-t border-border">
        {step > 1 && (
          <Button
            variant="outline"
            onClick={() => setStep((s) => s - 1)}
            className="flex-1"
          >
            {t('common.back')}
          </Button>
        )}
        {step < totalSteps ? (
          <Button
            id={`step-${step}-next`}
            onClick={() => setStep((s) => s + 1)}
            disabled={!canProceed()}
            className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {t('common.next')}
          </Button>
        ) : (
          <Button
            id="finish-setup-btn"
            onClick={handleSubmit}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
          >
            {t('common.submit')}
          </Button>
        )}
      </div>
    </div>
  );
}
