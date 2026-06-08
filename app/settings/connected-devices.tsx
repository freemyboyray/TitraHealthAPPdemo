import { router } from 'expo-router';
import { useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const HEALTH_NAME = Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect';
const HEALTH_ROUTE = Platform.OS === 'ios' ? '/settings/apple-health' : '/settings/health-connect';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { useHealthKitStore } from '@/stores/healthkit-store';
import { DEVICE_CATEGORIES, type DeviceCategory, type DeviceProduct } from '@/constants/connected-devices';
import type { HKCategoryKey } from '@/lib/healthkit';
import { ChevronLeft, Heart, ChevronRight, Check } from 'lucide-react-native';
import { LucideIconByName } from '@/lib/lucide-icon-map';

function isCategoryLive(live: Set<HKCategoryKey>, keys: HKCategoryKey[]): boolean {
  return keys.some((k) => live.has(k));
}

function liveKeyCount(live: Set<HKCategoryKey>, keys: HKCategoryKey[]): number {
  return keys.filter((k) => live.has(k)).length;
}

// ─── How-it-works step ──────────────────────────────────────────────────────

function FlowStep({ number, label, sub, colors }: {
  number: string; label: string; sub: string; colors: AppColors;
}) {
  const w = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
      <View style={{
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: w(0.06),
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ color: colors.orange, fontSize: 16, fontWeight: '800' }}>{number}</Text>
      </View>
      <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700', textAlign: 'center' }}>
        {label}
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: 11, textAlign: 'center', lineHeight: 15 }}>
        {sub}
      </Text>
    </View>
  );
}

// ─── Data type chip ─────────────────────────────────────────────────────────

function DataChip({ label, live, accent, colors }: {
  label: string; live: boolean; accent: string; colors: AppColors;
}) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: live ? `${accent}18` : (colors.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'),
      borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
    }}>
      {live && <Check size={10} color={accent} strokeWidth={3} />}
      <Text style={{
        color: live ? accent : colors.textMuted,
        fontSize: 11, fontWeight: '600',
      }}>{label}</Text>
    </View>
  );
}

// ─── Product card ───────────────────────────────────────────────────────────

function ProductCard({ product, accent, colors, isLast }: {
  product: DeviceProduct; accent: string; colors: AppColors; isLast: boolean;
}) {
  const w = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return (
    <View style={{
      paddingHorizontal: 16, paddingVertical: 14,
      borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderSubtle,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '600' }}>
            {product.name}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>
            {product.note}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text style={{ color: accent, fontSize: 15, fontWeight: '700' }}>
            {product.price}
          </Text>
          {product.companionApp !== 'Built-in' && (
            <Text style={{ color: w(0.3), fontSize: 10, fontWeight: '600' }}>
              via {product.companionApp}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── Category section ───────────────────────────────────────────────────────

function CategorySection({ cat, liveCategories, colors }: {
  cat: DeviceCategory; liveCategories: Set<HKCategoryKey>; colors: AppColors;
}) {
  const w = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  const live = isCategoryLive(liveCategories, cat.hkKeys);
  const count = liveKeyCount(liveCategories, cat.hkKeys);

  return (
    <View style={{
      backgroundColor: colors.surface,
      borderRadius: 20, overflow: 'hidden', marginBottom: 16,
      borderWidth: 1,
      borderTopColor: w(0.13), borderLeftColor: colors.borderSubtle,
      borderRightColor: w(0.03), borderBottomColor: w(0.02),
    }}>
      {/* Colored accent bar */}
      <View style={{ height: 3, backgroundColor: cat.accent, opacity: live ? 1 : 0.3 }} />

      {/* Category header */}
      <View style={{ padding: 16, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{
            width: 44, height: 44, borderRadius: 14,
            backgroundColor: `${cat.accent}18`,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <LucideIconByName name={cat.icon} size={22} color={cat.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', letterSpacing: -0.3 }}>
                {cat.title}
              </Text>
              {live && (
                <View style={{
                  backgroundColor: 'rgba(52,199,89,0.15)',
                  borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2,
                }}>
                  <Text style={{ color: '#34C759', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>
                    {count}/{cat.hkKeys.length} LIVE
                  </Text>
                </View>
              )}
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>
              {cat.subtitle}
            </Text>
          </View>
        </View>

        {/* Why it matters */}
        <Text style={{
          color: colors.textSecondary, fontSize: 14, lineHeight: 20,
          marginTop: 12, paddingLeft: 56,
        }}>
          {cat.whyItMatters}
        </Text>

        {/* Data type chips */}
        <View style={{
          flexDirection: 'row', flexWrap: 'wrap', gap: 6,
          marginTop: 10, paddingLeft: 56,
        }}>
          {cat.dataTypes.map((dt, i) => (
            <DataChip
              key={dt}
              label={dt}
              live={i < cat.hkKeys.length && liveCategories.has(cat.hkKeys[i])}
              accent={cat.accent}
              colors={colors}
            />
          ))}
        </View>
      </View>

      {/* Products divider */}
      <View style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: colors.borderSubtle,
        marginHorizontal: 16,
      }} />

      {/* Section label */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
        <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 }}>
          RECOMMENDED
        </Text>
      </View>

      {/* Product rows */}
      {cat.products.map((product, i) => (
        <ProductCard
          key={product.name}
          product={product}
          accent={cat.accent}
          colors={colors}
          isLast={i === cat.products.length - 1}
        />
      ))}
    </View>
  );
}

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function ConnectedDevicesScreen() {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { liveCategories } = useHealthKitStore();

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <ChevronLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>CONNECTED DEVICES</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={s.heroSection}>
          <Text style={s.heroTitle}>Unlock deeper insights</Text>
          <Text style={s.heroBody}>
            Connect your devices to {HEALTH_NAME}. Titra reads the data automatically, no extra setup.
          </Text>
        </View>

        {/* How it works */}
        <View style={s.howCard}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <FlowStep number="1" label="Pair device" sub="Use the maker's app" colors={colors} />
            <FlowStep number="2" label="Sync to Health" sub={`Enable ${HEALTH_NAME} sharing`} colors={colors} />
            <FlowStep number="3" label="See it in Titra" sub="Data flows automatically" colors={colors} />
          </View>
        </View>

        {/* Categories */}
        {DEVICE_CATEGORIES.map((cat) => (
          <CategorySection
            key={cat.id}
            cat={cat}
            liveCategories={liveCategories}
            colors={colors}
          />
        ))}

        {/* Health settings link */}
        <TouchableOpacity
          style={s.healthLink}
          onPress={() => router.push(HEALTH_ROUTE as any)}
          activeOpacity={0.7}
        >
          <View style={s.healthLinkIcon}>
            <Heart size={16} color={Platform.OS === 'ios' ? '#FF3B30' : '#4285F4'} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.healthLinkLabel}>{HEALTH_NAME} Settings</Text>
            <Text style={s.healthLinkSub}>See all data types and connection status</Text>
          </View>
          <ChevronRight size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Footer */}
        <Text style={s.footerNote}>
          Any device that syncs to {HEALTH_NAME} works with Titra. Prices are approximate and may vary.
          All trademarks are property of their respective owners.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 16,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderSubtle,
    },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { color: c.textPrimary, fontSize: 15, fontWeight: '700', letterSpacing: 3.5 },

    scroll: { flex: 1 },
    content: { padding: 16, paddingBottom: 80 },

    /* Hero */
    heroSection: { marginBottom: 20, paddingHorizontal: 4 },
    heroTitle: {
      color: c.textPrimary, fontSize: 28, fontWeight: '800',
      letterSpacing: -0.8, marginBottom: 6,
    },
    heroBody: {
      color: c.textSecondary, fontSize: 16, lineHeight: 23,
    },

    /* How it works */
    howCard: {
      backgroundColor: c.surface,
      borderRadius: 16, padding: 18,
      borderWidth: 1,
      borderTopColor: w(0.13), borderLeftColor: c.borderSubtle,
      borderRightColor: w(0.03), borderBottomColor: w(0.02),
      marginBottom: 24,
    },

    /* Apple Health link */
    healthLink: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: c.surface,
      borderRadius: 16, padding: 16,
      borderWidth: 1,
      borderTopColor: w(0.13), borderLeftColor: c.borderSubtle,
      borderRightColor: w(0.03), borderBottomColor: w(0.02),
      marginBottom: 12,
    },
    healthLinkIcon: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: 'rgba(255,59,48,0.12)',
      alignItems: 'center', justifyContent: 'center',
    },
    healthLinkLabel: { color: c.textPrimary, fontSize: 15, fontWeight: '700' },
    healthLinkSub: { color: c.textMuted, fontSize: 13, marginTop: 1 },

    /* Footer */
    footerNote: {
      color: c.textMuted, fontSize: 12, lineHeight: 17,
      textAlign: 'center', marginTop: 8, paddingHorizontal: 8,
    },
  });
};
