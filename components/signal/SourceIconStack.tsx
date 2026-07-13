import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { newsSourceAccent } from '@/constants/newsSourceAccent';
import type { AppTheme } from '@/constants/theme';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { markSourceIconFailed } from '@/services/sourceIcon';

export type SourceIconEntry = {
  sourceName: string;
  url?: string | null;
};

type Props = {
  sources: SourceIconEntry[];
  maxVisible?: number;
  size?: number;
};

const OVERLAP_RATIO = 0.42;

function dedupeSources(sources: SourceIconEntry[]): SourceIconEntry[] {
  const seen = new Set<string>();
  const out: SourceIconEntry[] = [];
  for (const entry of sources) {
    const name = entry.sourceName?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ sourceName: name, url: entry.url });
  }
  return out;
}

function SourceIconMark({
  sourceName,
  url,
  size,
  ringColor,
}: {
  sourceName: string;
  url?: string | null;
  size: number;
  ringColor: string;
}) {
  const { theme } = useSignalTheme();
  const accent = useMemo(() => newsSourceAccent(sourceName, theme, url), [sourceName, theme, url]);
  const iconUrl = accent.iconUrl?.trim() || null;
  const [iconFailed, setIconFailed] = useState(!iconUrl);

  useEffect(() => {
    setIconFailed(!iconUrl);
  }, [iconUrl, sourceName]);

  const showIcon = Boolean(iconUrl) && !iconFailed;
  const radius = Math.round(size / 2);

  return (
    <View
      style={[
        markStyles.mark,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: accent.dim,
          borderColor: ringColor,
        },
      ]}>
      {showIcon && iconUrl ? (
        <Image
          source={{ uri: iconUrl }}
          style={{ width: size - 6, height: size - 6, borderRadius: radius - 3 }}
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={80}
          onError={() => {
            markSourceIconFailed(iconUrl);
            setIconFailed(true);
          }}
        />
      ) : (
        <Text
          style={[
            markStyles.glyph,
            {
              fontSize: Math.max(7, Math.round(size * 0.34)),
              lineHeight: Math.max(9, Math.round(size * 0.4)),
              color: accent.accent,
            },
          ]}
          numberOfLines={1}>
          {accent.glyph}
        </Text>
      )}
    </View>
  );
}

const markStyles = StyleSheet.create({
  mark: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    overflow: 'hidden',
  },
  glyph: {
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});

export function SourceIcon({
  sourceName,
  url,
  size = 22,
}: {
  sourceName: string;
  url?: string | null;
  size?: number;
}) {
  const { theme } = useSignalTheme();
  return (
    <SourceIconMark
      sourceName={sourceName}
      url={url}
      size={size}
      ringColor={theme.card}
    />
  );
}

export function SourceIconStack({ sources, maxVisible = 4, size = 22 }: Props) {
  const { theme } = useSignalTheme();
  const unique = useMemo(() => dedupeSources(sources), [sources]);
  const visible = unique.slice(0, maxVisible);
  const overflow = Math.max(0, unique.length - visible.length);
  const step = Math.max(10, Math.round(size * (1 - OVERLAP_RATIO)));
  const ringColor = theme.card;
  const width =
    visible.length === 0
      ? 0
      : size + step * Math.max(0, visible.length + (overflow > 0 ? 1 : 0) - 1);

  if (visible.length === 0) return null;

  const a11yLabel = unique.map((entry) => entry.sourceName).join(', ');

  return (
    <View
      style={[styles.stack, { width, height: size }]}
      accessibilityLabel={a11yLabel}
      importantForAccessibility="yes">
      {visible.map((entry, index) => (
        <View
          key={`${entry.sourceName}-${index}`}
          style={[styles.item, { left: index * step, zIndex: index + 1 }]}>
          <SourceIconMark
            sourceName={entry.sourceName}
            url={entry.url}
            size={size}
            ringColor={ringColor}
          />
        </View>
      ))}
      {overflow > 0 ? (
        <View style={[styles.item, { left: visible.length * step, zIndex: visible.length + 1 }]}>
          <View
            style={[
              styles.overflow,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                borderColor: ringColor,
                backgroundColor: theme.bgElevated,
              },
            ]}>
            <Text style={[styles.overflowText, { fontSize: Math.max(8, Math.round(size * 0.32)) }]}>
              +{overflow}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

export function digestSourceIconEntries(
  sourceRefs: Array<{ sourceName?: string | null; url?: string | null }>,
  fallbackSources: string[] = [],
): SourceIconEntry[] {
  const fromRefs = sourceRefs
    .map((ref) => ({
      sourceName: String(ref.sourceName || '').trim(),
      url: ref.url,
    }))
    .filter((entry) => entry.sourceName.length > 0);
  if (fromRefs.length > 0) return fromRefs;
  return fallbackSources
    .map((name) => ({ sourceName: String(name || '').trim() }))
    .filter((entry) => entry.sourceName.length > 0);
}

export function briefingSourceIconEntries(
  sourceRefs: Array<{ sourceName?: string | null; url?: string | null }>,
): SourceIconEntry[] {
  return sourceRefs
    .map((ref) => ({
      sourceName: String(ref.sourceName || '').trim(),
      url: ref.url,
    }))
    .filter((entry) => entry.sourceName.length > 0);
}

const styles = StyleSheet.create({
  stack: {
    position: 'relative',
    flexShrink: 0,
  },
  item: {
    position: 'absolute',
    top: 0,
  },
  overflow: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  overflowText: {
    fontWeight: '600',
    color: '#9AA3B2',
  },
});
