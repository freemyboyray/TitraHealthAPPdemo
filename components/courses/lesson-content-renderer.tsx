import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

const FF = 'Helvetica Neue';
const ORANGE = '#FF742A';

type Props = {
  bodyMarkdown: string | null;
  contentJson: any | null;
  contentType: string;
};

// ─── Simple Markdown Renderer ─────────────────────────────────────────────────
// Handles: ## headings, **bold**, - bullets, | tables, > blockquotes, paragraphs

function MarkdownRenderer({ text, colors }: { text: string; colors: AppColors }) {
  const s = useMemo(() => mdStyles(colors), [colors]);
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let key = 0;
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip empty lines
    if (!line.trim()) {
      if (inTable) inTable = false;
      continue;
    }

    // Table rows
    if (line.trim().startsWith('|')) {
      // Skip separator rows
      if (line.includes('---')) continue;

      const cells = line.split('|').filter(c => c.trim()).map(c => c.trim());
      if (!inTable) {
        // Header row
        inTable = true;
        elements.push(
          <View key={key++} style={s.tableRow}>
            {cells.map((cell, ci) => (
              <Text key={ci} style={[s.tableCell, s.tableHeader]}>{cell}</Text>
            ))}
          </View>,
        );
      } else {
        elements.push(
          <View key={key++} style={s.tableRow}>
            {cells.map((cell, ci) => (
              <Text key={ci} style={s.tableCell}>{renderInline(cell, colors)}</Text>
            ))}
          </View>,
        );
      }
      continue;
    }

    inTable = false;

    // Heading ##
    if (line.startsWith('## ')) {
      elements.push(
        <Text key={key++} style={s.heading}>{line.slice(3)}</Text>,
      );
      continue;
    }

    // Heading ###
    if (line.startsWith('### ')) {
      elements.push(
        <Text key={key++} style={s.subheading}>{line.slice(4)}</Text>,
      );
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      elements.push(
        <View key={key++} style={s.blockquote}>
          <Text style={s.blockquoteText}>{renderInline(line.slice(2), colors)}</Text>
        </View>,
      );
      continue;
    }

    // Bullet point (- or *)
    if (/^[-*]\s/.test(line.trimStart())) {
      const indent = line.length - line.trimStart().length;
      elements.push(
        <View key={key++} style={[s.bulletRow, indent > 0 && { paddingLeft: 16 }]}>
          <Text style={s.bulletDot}>{'  \u2022  '}</Text>
          <Text style={s.bulletText}>{renderInline(line.trimStart().slice(2), colors)}</Text>
        </View>,
      );
      continue;
    }

    // Numbered list
    if (/^\d+\.\s/.test(line.trimStart())) {
      const match = line.trimStart().match(/^(\d+)\.\s(.*)/)!;
      elements.push(
        <View key={key++} style={s.bulletRow}>
          <Text style={s.numberDot}>{match[1]}.  </Text>
          <Text style={s.bulletText}>{renderInline(match[2], colors)}</Text>
        </View>,
      );
      continue;
    }

    // Paragraph
    elements.push(
      <Text key={key++} style={s.paragraph}>{renderInline(line, colors)}</Text>,
    );
  }

  return <>{elements}</>;
}

// Inline formatting: **bold** and *italic*
function renderInline(text: string, colors: AppColors): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1]) {
      parts.push(
        <Text key={key++} style={{ fontWeight: '700', color: colors.textPrimary }}>
          {match[1]}
        </Text>,
      );
    } else if (match[2]) {
      parts.push(
        <Text key={key++} style={{ fontStyle: 'italic' }}>
          {match[2]}
        </Text>,
      );
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : <>{parts}</>;
}

// ─── Checklist Renderer ─────────────────────────────────────────────────────

function ChecklistRenderer({ items, colors }: { items: string[]; colors: AppColors }) {
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const s = useMemo(() => checkStyles(colors), [colors]);

  const toggle = (i: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <View style={s.container}>
      <Text style={s.checkTitle}>Checklist</Text>
      {items.map((item, i) => (
        <Pressable key={i} style={s.checkRow} onPress={() => toggle(i)}>
          <Ionicons
            name={checked.has(i) ? 'checkbox' : 'square-outline'}
            size={20}
            color={checked.has(i) ? '#27AE60' : 'rgba(255,255,255,0.3)'}
          />
          <Text style={[s.checkText, checked.has(i) && s.checkTextDone]}>{item}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function LessonContentRenderer({ bodyMarkdown, contentJson, contentType }: Props) {
  const { colors } = useAppTheme();

  return (
    <View>
      {/* Render markdown body */}
      {bodyMarkdown && <MarkdownRenderer text={bodyMarkdown} colors={colors} />}

      {/* Render interactive content based on type */}
      {contentType === 'checklist' && contentJson?.items && (
        <ChecklistRenderer items={contentJson.items} colors={colors} />
      )}

      {contentType === 'exercise' && contentJson?.journalPrompt && (
        <View style={{
          marginTop: 20,
          padding: 16,
          borderRadius: 16,
          backgroundColor: colors.isDark ? 'rgba(155,89,182,0.12)' : 'rgba(155,89,182,0.08)',
          borderWidth: 0.5,
          borderColor: 'rgba(155,89,182,0.3)',
        }}>
          <Text style={{
            fontSize: 12,
            fontWeight: '700',
            color: '#9B59B6',
            fontFamily: FF,
            letterSpacing: 1,
            marginBottom: 8,
          }}>JOURNAL PROMPT</Text>
          <Text style={{
            fontSize: 14,
            color: colors.textPrimary,
            fontFamily: FF,
            lineHeight: 21,
            fontStyle: 'italic',
          }}>{contentJson.journalPrompt}</Text>
        </View>
      )}

      {contentType === 'exercise' && contentJson?.commonThoughts && (
        <View style={{ marginTop: 16 }}>
          <Text style={{
            fontSize: 12,
            fontWeight: '700',
            color: ORANGE,
            fontFamily: FF,
            letterSpacing: 1,
            marginBottom: 10,
          }}>COMMON THOUGHTS TO EXAMINE</Text>
          {contentJson.commonThoughts.map((thought: string, i: number) => (
            <View key={i} style={{
              padding: 12,
              borderRadius: 12,
              backgroundColor: colors.isDark ? 'rgba(255,116,42,0.08)' : 'rgba(255,116,42,0.06)',
              marginBottom: 8,
            }}>
              <Text style={{
                fontSize: 13,
                color: colors.textPrimary,
                fontFamily: FF,
                fontStyle: 'italic',
              }}>"{thought}"</Text>
            </View>
          ))}
        </View>
      )}

      {contentType === 'breathing' && contentJson?.breathingPhases && (
        <View style={{
          marginTop: 20,
          padding: 16,
          borderRadius: 16,
          backgroundColor: colors.isDark ? 'rgba(39,174,96,0.12)' : 'rgba(39,174,96,0.08)',
          borderWidth: 0.5,
          borderColor: 'rgba(39,174,96,0.3)',
        }}>
          <Text style={{
            fontSize: 12,
            fontWeight: '700',
            color: '#27AE60',
            fontFamily: FF,
            letterSpacing: 1,
            marginBottom: 10,
          }}>GUIDED EXERCISE</Text>
          {contentJson.breathingPhases.map((phase: { instruction: string; durationSec: number }, i: number) => (
            <View key={i} style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 10,
              marginBottom: 8,
            }}>
              <Text style={{
                fontSize: 11,
                fontWeight: '700',
                color: 'rgba(39,174,96,0.6)',
                fontFamily: FF,
                width: 32,
              }}>{phase.durationSec}s</Text>
              <Text style={{
                fontSize: 13,
                color: colors.textPrimary,
                fontFamily: FF,
                flex: 1,
                lineHeight: 19,
              }}>{phase.instruction}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const mdStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    heading: {
      fontSize: 18,
      fontWeight: '800',
      color: c.textPrimary,
      fontFamily: FF,
      marginTop: 20,
      marginBottom: 8,
      letterSpacing: -0.3,
    },
    subheading: {
      fontSize: 15,
      fontWeight: '700',
      color: c.textPrimary,
      fontFamily: FF,
      marginTop: 16,
      marginBottom: 6,
    },
    paragraph: {
      fontSize: 14,
      color: w(0.7),
      fontFamily: FF,
      lineHeight: 22,
      marginBottom: 10,
    },
    bulletRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 6,
    },
    bulletDot: {
      fontSize: 14,
      color: ORANGE,
      fontFamily: FF,
      lineHeight: 22,
    },
    numberDot: {
      fontSize: 14,
      fontWeight: '700',
      color: ORANGE,
      fontFamily: FF,
      lineHeight: 22,
      width: 24,
    },
    bulletText: {
      fontSize: 14,
      color: w(0.7),
      fontFamily: FF,
      lineHeight: 22,
      flex: 1,
    },
    blockquote: {
      borderLeftWidth: 3,
      borderLeftColor: ORANGE,
      paddingLeft: 14,
      marginVertical: 12,
      paddingVertical: 4,
    },
    blockquoteText: {
      fontSize: 14,
      color: w(0.65),
      fontFamily: FF,
      lineHeight: 22,
      fontStyle: 'italic',
    },
    tableRow: {
      flexDirection: 'row',
      borderBottomWidth: 0.5,
      borderBottomColor: w(0.1),
      paddingVertical: 6,
    },
    tableCell: {
      flex: 1,
      fontSize: 12,
      color: w(0.6),
      fontFamily: FF,
    },
    tableHeader: {
      fontWeight: '700',
      color: c.textPrimary,
    },
  });
};

const checkStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    container: {
      marginTop: 20,
      padding: 16,
      borderRadius: 16,
      backgroundColor: w(0.04),
      borderWidth: 0.5,
      borderColor: w(0.08),
    },
    checkTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: ORANGE,
      fontFamily: FF,
      letterSpacing: 1,
      marginBottom: 12,
    },
    checkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 8,
    },
    checkText: {
      fontSize: 13,
      color: c.textPrimary,
      fontFamily: FF,
      flex: 1,
      lineHeight: 19,
    },
    checkTextDone: {
      textDecorationLine: 'line-through',
      color: w(0.35),
    },
  });
};
