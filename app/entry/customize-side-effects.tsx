import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ACTIVE_EFFECTS_KEY,
  CATEGORY_LABELS,
  CUSTOM_EFFECTS_KEY,
  SIDE_EFFECTS,
  type SideEffectCategory,
} from '../../constants/side-effects';

const BG = '#000000';
const ORANGE = '#FF742A';
const GREEN = '#5DB87B';
const DARK = '#FFFFFF';

const SHADOW = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 8 } as const,
  shadowOpacity: 0.12,
  shadowRadius: 24,
  elevation: 8,
};

const CATEGORIES: SideEffectCategory[] = ['digestive', 'appetite', 'physical', 'mental'];

function GB({ r = 24 }: { r?: number }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        borderRadius: r, borderWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.13)',
        borderLeftColor: 'rgba(255,255,255,0.08)',
        borderRightColor: 'rgba(255,255,255,0.03)',
        borderBottomColor: 'rgba(255,255,255,0.02)',
      }}
    />
  );
}

type CustomEffect = { id: string; label: string };

export default function CustomizeSideEffectsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [enabled, setEnabled] = useState<Set<string>>(new Set());
  const [customDefs, setCustomDefs] = useState<CustomEffect[]>([]);
  const [newEffectText, setNewEffectText] = useState('');
  const [showAddInput, setShowAddInput] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    async function load() {
      const [storedIds, storedCustom] = await Promise.all([
        AsyncStorage.getItem(ACTIVE_EFFECTS_KEY),
        AsyncStorage.getItem(CUSTOM_EFFECTS_KEY),
      ]);
      const ids: string[] = storedIds
        ? JSON.parse(storedIds)
        : SIDE_EFFECTS.filter((e) => e.defaultEnabled).map((e) => e.id);
      const customs: CustomEffect[] = storedCustom ? JSON.parse(storedCustom) : [];
      setEnabled(new Set(ids));
      setCustomDefs(customs);
    }
    load();
  }, []);

  function toggleEffect(id: string) {
    setEnabled((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function addCustomEffect() {
    const label = newEffectText.trim();
    if (!label) return;
    const id = `custom_${Date.now()}`;
    setCustomDefs((prev) => [...prev, { id, label }]);
    setEnabled((prev) => new Set([...prev, id]));
    setNewEffectText('');
    setShowAddInput(false);
  }

  function removeCustomEffect(id: string) {
    setCustomDefs((prev) => prev.filter((c) => c.id !== id));
    setEnabled((prev) => { const next = new Set(prev); next.delete(id); return next; });
  }

  async function handleSave() {
    await AsyncStorage.setItem(ACTIVE_EFFECTS_KEY, JSON.stringify([...enabled]));
    await AsyncStorage.setItem(CUSTOM_EFFECTS_KEY, JSON.stringify(customDefs));
    router.back();
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: BG }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 20, paddingTop: insets.top + 10, paddingBottom: 14,
          backgroundColor: BG,
        }}
      >
        <TouchableOpacity style={s.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <BlurView intensity={75} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)' }]} />
          <GB r={20} />
          <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>

        <Text style={{ fontSize: 18, fontWeight: '800', color: DARK }}>Customize Side Effects</Text>

        <TouchableOpacity
          style={s.headerBtn}
          onPress={() => { setShowAddInput(true); setTimeout(() => inputRef.current?.focus(), 100); }}
          activeOpacity={0.7}
        >
          <BlurView intensity={75} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)' }]} />
          <GB r={20} />
          <Ionicons name="add" size={22} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Built-in effects grouped by category */}
        {CATEGORIES.map((cat) => {
          const effects = SIDE_EFFECTS.filter((e) => e.category === cat);
          return (
            <View key={cat} style={{ marginBottom: 8 }}>
              <Text style={s.sectionHeader}>{CATEGORY_LABELS[cat].toUpperCase()}</Text>
              <View style={[s.card]}>
                <BlurView intensity={78} tint="dark" style={StyleSheet.absoluteFillObject} />
                <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.04)' }]} />
                <GB r={20} />
                <View style={{ paddingHorizontal: 20 }}>
                  {effects.map((effect, idx) => {
                    const isLast = idx === effects.length - 1;
                    const on = enabled.has(effect.id);
                    return (
                      <View
                        key={effect.id}
                        style={[s.row, { borderBottomWidth: isLast ? 0 : 1, borderBottomColor: 'rgba(255,255,255,0.06)' }]}
                      >
                        <Text style={{ fontSize: 15, fontWeight: '500', color: DARK, flex: 1 }}>
                          {effect.label}
                        </Text>
                        <Switch
                          value={on}
                          onValueChange={() => toggleEffect(effect.id)}
                          trackColor={{ false: 'rgba(255,255,255,0.12)', true: GREEN }}
                          thumbColor={on ? '#FFFFFF' : '#888888'}
                          ios_backgroundColor="rgba(255,255,255,0.12)"
                        />
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
          );
        })}

        {/* Custom effects */}
        {customDefs.length > 0 && (
          <View style={{ marginBottom: 8 }}>
            <Text style={s.sectionHeader}>CUSTOM</Text>
            <View style={[s.card]}>
              <BlurView intensity={78} tint="dark" style={StyleSheet.absoluteFillObject} />
              <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.04)' }]} />
              <GB r={20} />
              <View style={{ paddingHorizontal: 20 }}>
                {customDefs.map((c, idx) => {
                  const isLast = idx === customDefs.length - 1;
                  const on = enabled.has(c.id);
                  return (
                    <View
                      key={c.id}
                      style={[s.row, { borderBottomWidth: isLast ? 0 : 1, borderBottomColor: 'rgba(255,255,255,0.06)' }]}
                    >
                      <Text style={{ fontSize: 15, fontWeight: '500', color: DARK, flex: 1 }}>{c.label}</Text>
                      <Switch
                        value={on}
                        onValueChange={() => toggleEffect(c.id)}
                        trackColor={{ false: 'rgba(255,255,255,0.12)', true: GREEN }}
                        thumbColor={on ? '#FFFFFF' : '#888888'}
                        ios_backgroundColor="rgba(255,255,255,0.12)"
                      />
                      <TouchableOpacity
                        onPress={() => removeCustomEffect(c.id)}
                        style={{ marginLeft: 12, padding: 4 }}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="trash-outline" size={16} color="rgba(255,80,80,0.7)" />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* Add new */}
        <View style={{ marginTop: 16, alignItems: 'center' }}>
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', marginBottom: 14, textAlign: 'center' }}>
            Any other side effects you'd like to track?
          </Text>

          {showAddInput ? (
            <View style={{ width: '100%', flexDirection: 'row', gap: 10 }}>
              <TextInput
                ref={inputRef}
                style={s.textInput}
                value={newEffectText}
                onChangeText={setNewEffectText}
                placeholder="e.g. Dry Mouth"
                placeholderTextColor="rgba(255,255,255,0.25)"
                returnKeyType="done"
                onSubmitEditing={addCustomEffect}
                autoCapitalize="words"
              />
              <TouchableOpacity
                style={[s.addBtn, { opacity: newEffectText.trim() ? 1 : 0.4 }]}
                onPress={addCustomEffect}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFF' }}>Add</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={s.outlineBtn}
              onPress={() => { setShowAddInput(true); setTimeout(() => inputRef.current?.focus(), 100); }}
              activeOpacity={0.75}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.6)', letterSpacing: 0.2 }}>
                Add a new side effect
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Save CTA */}
      <View
        style={{
          paddingHorizontal: 20, paddingTop: 12,
          paddingBottom: insets.bottom + 16,
          backgroundColor: BG,
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.06)',
        }}
      >
        <TouchableOpacity
          style={{
            backgroundColor: ORANGE, borderRadius: 28, paddingVertical: 17,
            alignItems: 'center', justifyContent: 'center',
            shadowColor: ORANGE, shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.35, shadowRadius: 20, elevation: 10,
          }}
          onPress={handleSave}
          activeOpacity={0.8}
        >
          <Text style={{ fontSize: 16, fontWeight: '800', color: '#FFF', letterSpacing: 0.4 }}>Save</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  headerBtn: {
    width: 40, height: 40, borderRadius: 20, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    ...SHADOW, shadowOpacity: 0.08, shadowRadius: 12,
  },
  sectionHeader: {
    fontSize: 11, fontWeight: '700', color: '#5A5754',
    letterSpacing: 3.5, textTransform: 'uppercase',
    marginBottom: 10, marginLeft: 4,
  },
  card: {
    borderRadius: 20, overflow: 'hidden', backgroundColor: '#111111',
    ...SHADOW,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14,
  },
  outlineBtn: {
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 24, paddingVertical: 12, paddingHorizontal: 24,
  },
  textInput: {
    flex: 1, height: 48, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 16, fontSize: 15, fontWeight: '600', color: '#FFFFFF',
  },
  addBtn: {
    height: 48, paddingHorizontal: 20, borderRadius: 14,
    backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center',
  },
});
