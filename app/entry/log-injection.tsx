import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLogStore } from '../../stores/log-store';

// ─── Constants ────────────────────────────────────────────────────────────────

const TERRACOTTA = '#C4784B';
const DARK = '#1C0F09';
const BG = '#F0EAE4';

const MEDICATIONS = ['Ozempic', 'Wegovy', 'Mounjaro', 'Zepbound', 'Saxenda', 'Victoza'];
const DOSES = ['0.25mg', '0.5mg', '1mg', '1.7mg', '2mg', '2.4mg'];
const SITES = [
  'Left Abdomen',
  'Right Thigh',
  'Right Abdomen',
  'Left Thigh',
  'Left Upper Arm',
  'Right Upper Arm',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function todayLabel(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function GlassBorder({ r = 20 }: { r?: number }) {
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        {
          borderRadius: r,
          borderWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.65)',
          borderLeftColor: 'rgba(255,255,255,0.42)',
          borderRightColor: 'rgba(255,255,255,0.14)',
          borderBottomColor: 'rgba(255,255,255,0.08)',
        },
      ]}
    />
  );
}

function SectionLabel({ text }: { text: string }) {
  return (
    <View style={s.badge}>
      <Text style={s.badgeText}>{text}</Text>
    </View>
  );
}

function GlassCard({ children }: { children: React.ReactNode }) {
  return (
    <View style={s.cardShadow}>
      <View style={s.cardClip}>
        <BlurView intensity={78} tint="light" style={StyleSheet.absoluteFillObject} />
        <View style={[StyleSheet.absoluteFillObject, s.cardOverlay]} />
        <GlassBorder r={20} />
        <View style={s.cardContent}>{children}</View>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function LogInjectionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loading, addInjectionLog } = useLogStore();

  const [medication, setMedication] = useState('Ozempic');
  const [dose, setDose] = useState('0.5mg');
  const [site, setSite] = useState('Left Abdomen');
  const [batchNumber, setBatchNumber] = useState('');
  const [notes, setNotes] = useState('');

  const nextSite = SITES[(SITES.indexOf(site) + 1) % SITES.length];

  async function handleSave() {
    await addInjectionLog(
      parseFloat(dose),
      todayString(),
      undefined,
      site,
      notes.trim() || undefined,
    );
    router.back();
  }

  return (
    <KeyboardAvoidingView
      style={[s.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.75} style={s.backShadow}>
          <View style={s.backClip}>
            <BlurView intensity={76} tint="light" style={StyleSheet.absoluteFillObject} />
            <View style={[StyleSheet.absoluteFillObject, s.backOverlay]} />
            <GlassBorder r={20} />
            <Ionicons name="chevron-back" size={22} color={DARK} />
          </View>
        </TouchableOpacity>

        <Text style={s.headerTitle}>Log Injection</Text>

        <View style={s.headerSpacer} />
      </View>

      {/* ── Date label ── */}
      <Text style={s.dateLabel}>{todayLabel().toUpperCase()}</Text>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Medication Card ── */}
        <GlassCard>
          <SectionLabel text="MEDICATION" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.chipRow}
          >
            {MEDICATIONS.map((med) => {
              const active = med === medication;
              return (
                <TouchableOpacity
                  key={med}
                  onPress={() => setMedication(med)}
                  activeOpacity={0.75}
                  style={[s.chip, active ? s.chipActive : s.chipInactive]}
                >
                  <Text style={[s.chipText, active ? s.chipTextActive : s.chipTextInactive]}>
                    {med}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </GlassCard>

        {/* ── Dose Card ── */}
        <GlassCard>
          <SectionLabel text="DOSE" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.chipRow}
          >
            {DOSES.map((d) => {
              const active = d === dose;
              return (
                <TouchableOpacity
                  key={d}
                  onPress={() => setDose(d)}
                  activeOpacity={0.75}
                  style={[s.chip, active ? s.chipActive : s.chipInactive]}
                >
                  <Text style={[s.chipText, active ? s.chipTextActive : s.chipTextInactive]}>
                    {d}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </GlassCard>

        {/* ── Injection Site Card ── */}
        <GlassCard>
          <SectionLabel text="INJECTION SITE" />
          <View style={s.siteGrid}>
            {SITES.map((siteName) => {
              const active = siteName === site;
              return (
                <TouchableOpacity
                  key={siteName}
                  onPress={() => setSite(siteName)}
                  activeOpacity={0.75}
                  style={[
                    siteStyles.siteBtn,
                    active ? siteStyles.siteBtnActive : siteStyles.siteBtnInactive,
                  ]}
                >
                  <Text
                    style={[
                      siteStyles.siteBtnText,
                      active ? siteStyles.siteBtnTextActive : siteStyles.siteBtnTextInactive,
                    ]}
                  >
                    {siteName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Rotate suggestion */}
          <View style={s.rotateRow}>
            <Ionicons name="sync-outline" size={14} color={TERRACOTTA} style={s.rotateIcon} />
            <Text style={s.rotateLabel}>ROTATE TO </Text>
            <Text style={s.rotateValue}>{nextSite}</Text>
          </View>
        </GlassCard>

        {/* ── Batch & Notes Card ── */}
        <GlassCard>
          <TextInput
            style={s.textInput}
            placeholder="Batch # (optional)"
            placeholderTextColor="rgba(28,15,9,0.35)"
            value={batchNumber}
            onChangeText={setBatchNumber}
            maxLength={30}
            returnKeyType="next"
          />
          <View style={s.inputDivider} />
          <TextInput
            style={[s.textInput, s.notesInput]}
            placeholder="Add a note… (optional)"
            placeholderTextColor="rgba(28,15,9,0.35)"
            value={notes}
            onChangeText={setNotes}
            maxLength={200}
            multiline
            textAlignVertical="top"
          />
        </GlassCard>
      </ScrollView>

      {/* ── Save Button ── */}
      <View style={[s.saveWrapper, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <TouchableOpacity
          onPress={handleSave}
          activeOpacity={0.82}
          disabled={loading}
          style={[s.saveBtn, loading && s.saveBtnDisabled]}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <View style={s.saveBtnInner}>
              <FontAwesome5 name="syringe" size={16} color="#FFF" style={s.saveIcon} />
              <Text style={s.saveBtnText}>Save Injection</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const siteStyles = StyleSheet.create({
  siteBtn: {
    width: '48%',
    marginBottom: 10,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  siteBtnActive: {
    backgroundColor: TERRACOTTA,
    shadowColor: TERRACOTTA,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.38,
    shadowRadius: 10,
    elevation: 5,
  },
  siteBtnInactive: {
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  siteBtnText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  siteBtnTextActive: {
    color: '#FFFFFF',
  },
  siteBtnTextInactive: {
    color: DARK,
  },
});

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  backShadow: {
    shadowColor: DARK,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  backClip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backOverlay: {
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: DARK,
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 40,
  },

  // Date label
  dateLabel: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(28,15,9,0.45)',
    letterSpacing: 3.5,
    marginTop: 6,
    marginBottom: 18,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 14,
  },

  // Glass card
  cardShadow: {
    borderRadius: 20,
    shadowColor: DARK,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  cardClip: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  cardOverlay: {
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  cardContent: {
    padding: 18,
  },

  // Badge
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: TERRACOTTA,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 14,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 2,
  },

  // Chips
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 4,
  },
  chip: {
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  chipActive: {
    backgroundColor: TERRACOTTA,
  },
  chipInactive: {
    backgroundColor: 'rgba(28,15,9,0.07)',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  chipTextInactive: {
    color: 'rgba(28,15,9,0.55)',
  },

  // Site grid
  siteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 4,
  },

  // Rotate row
  rotateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  rotateIcon: {
    marginRight: 4,
  },
  rotateLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(28,15,9,0.45)',
    letterSpacing: 1.5,
  },
  rotateValue: {
    fontSize: 11,
    fontWeight: '700',
    color: TERRACOTTA,
    letterSpacing: 1,
  },

  // Text inputs
  textInput: {
    fontSize: 15,
    color: DARK,
    fontWeight: '500',
    paddingVertical: 6,
    minHeight: 36,
  },
  notesInput: {
    minHeight: 72,
    paddingTop: 10,
  },
  inputDivider: {
    height: 1,
    backgroundColor: 'rgba(28,15,9,0.1)',
    marginVertical: 10,
  },

  // Save button
  saveWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: 'transparent',
  },
  saveBtn: {
    height: 56,
    borderRadius: 28,
    backgroundColor: TERRACOTTA,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: TERRACOTTA,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 8,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  saveIcon: {
    marginTop: 1,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
