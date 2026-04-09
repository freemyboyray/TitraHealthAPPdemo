import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useMemo } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

const ORANGE = '#FF742A';
const FF = 'Helvetica Neue';

function formatDateDisplay(d: string): string {
  try {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return d; }
}

export default function ReportPreviewScreen() {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ pdfUri: string; rangeStart: string; rangeEnd: string }>();
  const { pdfUri, rangeStart, rangeEnd } = params;

  const handleShare = async () => {
    if (!pdfUri) return;
    try {
      await Sharing.shareAsync(pdfUri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: 'Share Provider Report',
      });
    } catch {}
  };

  const handleDownload = async () => {
    // On iOS, share sheet includes "Save to Files". On Android, same.
    // So "Download" just opens the share sheet — the user picks where to save.
    handleShare();
  };

  const rangeLabel = rangeStart && rangeEnd
    ? `${formatDateDisplay(rangeStart)} – ${formatDateDisplay(rangeEnd)}`
    : '';

  // Build a file:// URI for the WebView to render the PDF
  const sourceUri = Platform.OS === 'ios'
    ? pdfUri ?? ''
    : `file://${pdfUri ?? ''}`;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Provider Report</Text>
          {rangeLabel ? <Text style={s.headerSub}>{rangeLabel}</Text> : null}
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* PDF Preview */}
      {pdfUri ? (
        <View style={s.webviewContainer}>
          <WebView
            source={{ uri: sourceUri }}
            style={s.webview}
            originWhitelist={['*']}
            scrollEnabled
            scalesPageToFit
            startInLoadingState
            renderLoading={() => (
              <View style={s.loadingOverlay}>
                <Text style={s.loadingText}>Loading preview...</Text>
              </View>
            )}
          />
        </View>
      ) : (
        <View style={s.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="rgba(255,255,255,0.3)" />
          <Text style={s.errorText}>Report not available</Text>
        </View>
      )}

      {/* Action Buttons */}
      <BlurView intensity={30} tint="dark" style={[s.footer, { paddingBottom: insets.bottom + 8 }]}>
        <View style={s.actionRow}>
          <TouchableOpacity style={s.secondaryBtn} onPress={handleDownload}>
            <Ionicons name="download-outline" size={20} color="#fff" />
            <Text style={s.secondaryBtnText}>Save</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.primaryBtn} onPress={handleShare}>
            <Ionicons name="share-outline" size={20} color="#fff" />
            <Text style={s.primaryBtnText}>Share with Provider</Text>
          </TouchableOpacity>
        </View>
      </BlurView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const createStyles = (c: AppColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { alignItems: 'center', flex: 1 },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    fontFamily: FF,
  },
  headerSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 2,
    fontFamily: FF,
  },

  webviewContainer: {
    flex: 1,
    margin: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: FF,
  },

  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  errorText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: FF,
  },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 50,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  secondaryBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
    fontFamily: FF,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 14,
    backgroundColor: ORANGE,
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    fontFamily: FF,
  },
});
