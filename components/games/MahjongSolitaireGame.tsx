import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Haptics from 'expo-haptics';

import { GameBurstOverlay } from '@/components/games/GameBurstOverlay';
import { MahjongSolitaireHelpSheet } from '@/components/games/MahjongSolitaireHelpSheet';
import { mahjongTileTint } from '@/components/games/mahjongTileColors';
import { runBoardPulse, runCellPop } from '@/components/games/gameBoardFx';
import type { AppTheme } from '@/constants/theme';
import { UI_RADIUS_CARD, UI_RADIUS_CARD_LG } from '@/constants/uiCornerRadius';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import {
  formatDurationMs,
  recordMahjongCleared,
  recordMahjongRunStarted,
} from '@/domain/games/records';
import {
  TILE_H,
  TILE_W,
  boardBounds,
  createMahjongGame,
  findMahjongHint,
  isTileFree,
  newMahjongGame,
  remainingCount,
  restartMahjongGame,
  tapMahjongTile,
  tileLabel,
  undoMahjong,
  useMahjongHint,
  type MahjongDifficulty,
  type MahjongState,
  type MahjongTile,
} from '@/domain/games/mahjongSolitaire';
import {
  clearMahjongProgress,
  loadMahjongProgress,
  saveMahjongProgress,
} from '@/services/gameProgressStore';
import { updateGameRecords } from '@/services/gameRecordsStore';

const DIFFICULTIES: MahjongDifficulty[] = ['easy', 'normal', 'hard'];
const LAYER_DEPTH = 0.34;

type BoardFx = { id: number; kind: 'match' | 'win' | 'stuck' };

function MahjongTileView({
  tile,
  selected,
  hinted,
  free,
  left,
  top,
  w,
  h,
  theme,
  sf,
  onPress,
  styles,
  popTick,
}: {
  tile: MahjongTile;
  selected: boolean;
  hinted: boolean;
  free: boolean;
  left: number;
  top: number;
  w: number;
  h: number;
  theme: AppTheme;
  sf: (n: number) => number;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  popTick: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const colors = mahjongTileTint(theme, tile.kind);

  useEffect(() => {
    if (popTick <= 0) return;
    runCellPop(scale);
  }, [popTick, scale]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left,
        top,
        width: w,
        height: h,
        zIndex: tile.layer * 10 + 1,
        transform: [{ scale: selected ? 1.06 : 1 }],
        opacity: free ? 1 : 0.78,
      }}>
      <Pressable
        onPress={onPress}
        disabled={!free}
        style={[
          styles.tile,
          {
            backgroundColor: colors.bg,
            borderColor: selected || hinted ? theme.green : colors.border,
            borderWidth: selected || hinted ? 2 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={tileLabel(tile.kind)}>
        <Text style={[styles.tileText, { fontSize: sf(w > 34 ? 15 : 13), color: colors.text }]}>
          {tileLabel(tile.kind)}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export function MahjongSolitaireGame({
  wide = false,
  split = false,
  fill = false,
  viewportHeight = 800,
}: {
  wide?: boolean;
  split?: boolean;
  fill?: boolean;
  viewportHeight?: number;
}) {
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const compact = !wide && !split;
  const [playArea, setPlayArea] = useState({ w: 0, h: 0 });
  const styles = useMemo(
    () => makeStyles(theme, scaleFont, wide, compact),
    [theme, scaleFont, wide, compact],
  );

  const [difficulty, setDifficulty] = useState<MahjongDifficulty>('normal');
  const [state, setState] = useState<MahjongState>(() => createMahjongGame('normal'));
  const [helpOpen, setHelpOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [boardFx, setBoardFx] = useState<BoardFx | null>(null);
  const [hintIds, setHintIds] = useState<string[]>([]);
  const [popTick, setPopTick] = useState(0);
  const elapsedBaseRef = useRef(0);
  const tickBaseRef = useRef(Date.now());
  const recordedClearRef = useRef(false);
  const boardPulse = useRef(new Animated.Value(1)).current;
  const fxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const liveElapsed = useCallback(() => {
    if (state.status !== 'playing') return elapsedMs;
    return elapsedBaseRef.current + (Date.now() - tickBaseRef.current);
  }, [elapsedMs, state.status]);

  const beginTimer = useCallback((baseMs = 0) => {
    elapsedBaseRef.current = baseMs;
    tickBaseRef.current = Date.now();
    setElapsedMs(baseMs);
    recordedClearRef.current = false;
  }, []);

  const clearFxTimer = useCallback(() => {
    if (fxTimer.current) {
      clearTimeout(fxTimer.current);
      fxTimer.current = null;
    }
  }, []);

  const triggerBoardFx = useCallback(
    (kind: BoardFx['kind']) => {
      clearFxTimer();
      if (kind === 'win') runBoardPulse(boardPulse, 1.05);
      else runBoardPulse(boardPulse, 1.03);
      setBoardFx({ id: Date.now(), kind });
      fxTimer.current = setTimeout(() => {
        setBoardFx(null);
        fxTimer.current = null;
      }, kind === 'win' ? 1400 : 900);
    },
    [clearFxTimer, boardPulse],
  );

  useEffect(
    () => () => {
      clearFxTimer();
      if (hintTimer.current) clearTimeout(hintTimer.current);
    },
    [clearFxTimer],
  );

  useEffect(() => {
    let cancelled = false;
    void loadMahjongProgress().then((progress) => {
      if (cancelled) return;
      if (progress) {
        setDifficulty(progress.difficulty);
        setState(progress.state);
        beginTimer(progress.elapsedMs);
      } else {
        beginTimer(0);
        void updateGameRecords((r) => recordMahjongRunStarted(r));
      }
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [beginTimer]);

  useEffect(() => {
    if (!hydrated || state.status !== 'playing') return;
    const id = setInterval(() => {
      setElapsedMs(elapsedBaseRef.current + (Date.now() - tickBaseRef.current));
    }, 500);
    return () => clearInterval(id);
  }, [hydrated, state.status, difficulty]);

  useEffect(() => {
    if (!hydrated) return;
    const ms =
      state.status === 'playing'
        ? elapsedBaseRef.current + (Date.now() - tickBaseRef.current)
        : elapsedBaseRef.current;
    void saveMahjongProgress(state, ms);
  }, [state, hydrated]);

  useEffect(() => {
    if (!hydrated || state.status !== 'cleared' || recordedClearRef.current) return;
    recordedClearRef.current = true;
    const finalMs = liveElapsed();
    setElapsedMs(finalMs);
    triggerBoardFx('win');
    void updateGameRecords((r) => recordMahjongCleared(r, state.difficulty, finalMs, state.score));
    void clearMahjongProgress();
  }, [hydrated, state.status, state.difficulty, state.score, liveElapsed, triggerBoardFx]);

  useEffect(() => {
    if (!hydrated || state.status !== 'stuck') return;
    triggerBoardFx('stuck');
  }, [hydrated, state.status, triggerBoardFx]);

  const onDifficulty = useCallback(
    (d: MahjongDifficulty) => {
      setDifficulty(d);
      setState(newMahjongGame(d));
      beginTimer(0);
      setHintIds([]);
      void clearMahjongProgress();
      void updateGameRecords((r) => recordMahjongRunStarted(r));
    },
    [beginTimer],
  );

  const onNewGame = useCallback(() => {
    setState(restartMahjongGame(state));
    beginTimer(0);
    setHintIds([]);
    recordedClearRef.current = false;
    void clearMahjongProgress();
    void updateGameRecords((r) => recordMahjongRunStarted(r));
  }, [state, beginTimer]);

  const onTap = useCallback(
    (tileId: string) => {
      setState((prev) => {
        const next = tapMahjongTile(prev, tileId);
        if (next.matches > prev.matches) {
          queueMicrotask(() => {
            setPopTick(Date.now());
            triggerBoardFx('match');
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          });
        } else {
          void Haptics.selectionAsync().catch(() => {});
        }
        return next;
      });
      setHintIds([]);
    },
    [triggerBoardFx],
  );

  const onHint = useCallback(() => {
    setState((prev) => {
      const hint = findMahjongHint(prev);
      const next = useMahjongHint(prev);
      if (next.hintsRemaining < prev.hintsRemaining && hint) {
        setHintIds([hint.a, hint.b]);
        if (hintTimer.current) clearTimeout(hintTimer.current);
        hintTimer.current = setTimeout(() => setHintIds([]), 1500);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      return next;
    });
  }, []);

  const onUndo = useCallback(() => {
    setState((prev) => undoMahjong(prev));
    setHintIds([]);
  }, []);

  const onPlayAreaLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setPlayArea((p) =>
      Math.abs(p.w - width) < 1 && Math.abs(p.h - height) < 1 ? p : { w: width, h: height },
    );
  }, []);

  const bounds = useMemo(() => boardBounds(state), [state]);
  const boardW = bounds.maxX - bounds.minX;
  const boardH = bounds.maxY - bounds.minY;
  const maxLayer = useMemo(
    () => state.tiles.filter((t) => !t.removed).reduce((m, t) => Math.max(m, t.layer), 0),
    [state.tiles],
  );
  const reservedChrome = compact ? 210 : split ? 0 : 190;
  const fallbackW = wide ? 420 : Math.min(380, viewportHeight * 0.92);
  const fallbackH = Math.max(
    280,
    Math.min(viewportHeight - reservedChrome, viewportHeight * 0.58),
  );
  const availW = playArea.w > 0 ? playArea.w : fallbackW;
  const availH = playArea.h > 0 ? playArea.h : fallbackH;
  const depthUnits = maxLayer * LAYER_DEPTH;
  const unit = Math.min(availW / (boardW + depthUnits), availH / (boardH + depthUnits));
  const layerStep = unit * LAYER_DEPTH;
  const depthPad = maxLayer * layerStep;
  const tileW = TILE_W * unit;
  const tileH = TILE_H * unit;
  const canvasW = boardW * unit + depthPad;
  const canvasH = boardH * unit + depthPad;

  const sortedTiles = useMemo(
    () =>
      [...state.tiles]
        .filter((t) => !t.removed)
        .sort((a, b) => a.layer - b.layer || a.y - b.y || a.x - b.x),
    [state.tiles],
  );

  const headerBar = (
    <View style={styles.headerBar}>
      <View style={styles.diffRow}>
        {DIFFICULTIES.map((d) => {
          const active = difficulty === d;
          const label =
            d === 'easy'
              ? t('gameMahjongDiffEasy')
              : d === 'normal'
                ? t('gameMahjongDiffNormal')
                : t('gameMahjongDiffHard');
          return (
            <Pressable
              key={d}
              onPress={() => onDifficulty(d)}
              style={[styles.diffChip, active && styles.diffChipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={label}>
              <Text style={[styles.diffChipText, active && styles.diffChipTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.headerActions}>
        <Pressable
          onPress={onNewGame}
          style={styles.headerIconBtn}
          accessibilityRole="button"
          accessibilityLabel={t('gameMahjongNewGame')}>
          <FontAwesome name="refresh" size={15} color={theme.textMuted} />
        </Pressable>
        <Pressable
          onPress={() => setHelpOpen(true)}
          style={styles.headerIconBtn}
          accessibilityRole="button"
          accessibilityLabel={t('gameMahjongHelpShowA11y')}>
          <FontAwesome name="question-circle" size={16} color={theme.green} />
        </Pressable>
      </View>
    </View>
  );

  const statsRow = (
    <View style={styles.statsRow}>
      <Stat label={t('gameMahjongScore')} value={String(state.score)} styles={styles} />
      <Stat label={t('gameMahjongRemaining')} value={String(remainingCount(state))} styles={styles} />
      <Stat label={t('gameMahjongTime')} value={formatDurationMs(elapsedMs)} styles={styles} />
    </View>
  );

  const boardView = (
    <Animated.View
      style={[
        styles.boardOuter,
        { width: canvasW, height: canvasH, transform: [{ scale: boardPulse }] },
      ]}>
      <View style={[styles.boardInner, { width: canvasW, height: canvasH }]}>
        {sortedTiles.map((tile) => {
          const free = isTileFree(state, tile.id);
          const layerOff = tile.layer * layerStep;
          const left = (tile.x - bounds.minX) * unit + layerOff;
          const top = (tile.y - bounds.minY) * unit - layerOff;
          return (
            <MahjongTileView
              key={tile.id}
              tile={tile}
              selected={state.selectedId === tile.id}
              hinted={hintIds.includes(tile.id)}
              free={free}
              left={left}
              top={top}
              w={tileW - 2}
              h={tileH - 2}
              theme={theme}
              sf={scaleFont}
              onPress={() => onTap(tile.id)}
              styles={styles}
              popTick={popTick}
            />
          );
        })}
      </View>
      <GameBurstOverlay
        visible={boardFx?.kind === 'match'}
        kind="hit"
        theme={theme}
        sf={scaleFont}
        title={t('gameMahjongMatchFx')}
      />
      <GameBurstOverlay
        visible={boardFx?.kind === 'win'}
        kind="win"
        theme={theme}
        sf={scaleFont}
        title={t('gameMahjongCleared')}
        subtitle={t('gameMahjongClearedScore', { score: state.score })}
        big
      />
      <GameBurstOverlay
        visible={boardFx?.kind === 'stuck'}
        kind="fail"
        theme={theme}
        sf={scaleFont}
        title={t('gameMahjongStuck')}
        subtitle={t('gameMahjongStuckBody')}
        big
      />
    </Animated.View>
  );

  const actions = (
    <View style={styles.actions}>
      <ActionBtn
        icon="lightbulb-o"
        label={t('gameMahjongHint', { count: state.hintsRemaining })}
        onPress={onHint}
        disabled={state.status !== 'playing' || state.hintsRemaining <= 0}
        styles={styles}
        theme={theme}
      />
      <ActionBtn
        icon="undo"
        label={t('gameMahjongUndo')}
        onPress={onUndo}
        disabled={state.history.length === 0 || state.status === 'cleared'}
        styles={styles}
        theme={theme}
      />
    </View>
  );

  const playAreaView = (
    <View style={styles.playArea} onLayout={onPlayAreaLayout}>
      {boardView}
    </View>
  );

  const body = split ? (
    <View style={styles.splitRow}>
      {playAreaView}
      <View style={styles.splitSide}>
        {headerBar}
        {statsRow}
        {actions}
      </View>
    </View>
  ) : fill ? (
    <View style={styles.fillRoot}>
      {headerBar}
      {statsRow}
      {playAreaView}
      {actions}
    </View>
  ) : (
    <View style={styles.stack}>
      {headerBar}
      {statsRow}
      {playAreaView}
      {actions}
    </View>
  );

  return (
    <>
      {body}
      <MahjongSolitaireHelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}

function Stat({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function ActionBtn({
  icon,
  label,
  onPress,
  disabled,
  styles,
  theme,
}: {
  icon: ComponentProps<typeof FontAwesome>['name'];
  label: string;
  onPress: () => void;
  disabled?: boolean;
  styles: ReturnType<typeof makeStyles>;
  theme: AppTheme;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionBtn,
        disabled && styles.actionBtnDisabled,
        pressed && !disabled && styles.actionBtnPressed,
      ]}
      accessibilityRole="button">
      <FontAwesome name={icon} size={14} color={disabled ? theme.textDim : theme.green} />
      <Text style={[styles.actionBtnText, disabled && styles.actionBtnTextDisabled]}>{label}</Text>
    </Pressable>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number, wide: boolean, compact: boolean) {
  return StyleSheet.create({
    stack: { gap: compact ? 8 : 10, alignItems: 'stretch' },
    fillRoot: { flex: 1, minHeight: 0, gap: compact ? 6 : 8 },
    playArea: {
      flex: 1,
      minHeight: 0,
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    splitRow: { flex: 1, flexDirection: 'row', gap: 16, minHeight: 0 },
    splitSide: { width: wide ? 260 : 220, gap: 10, justifyContent: 'center' },
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexShrink: 0,
    },
    headerActions: {
      flexDirection: 'row',
      gap: 6,
      marginLeft: 'auto',
    },
    headerIconBtn: {
      width: compact ? 34 : 36,
      height: compact ? 34 : 36,
      borderRadius: UI_RADIUS_CARD,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    diffRow: {
      flex: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: compact ? 6 : 8,
      alignItems: 'center',
    },
    diffChip: {
      paddingHorizontal: compact ? 10 : 12,
      paddingVertical: compact ? 6 : 8,
      borderRadius: UI_RADIUS_CARD,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    diffChipActive: { borderColor: theme.greenBorder, backgroundColor: theme.greenDim },
    diffChipText: { fontSize: sf(compact ? 12 : 13), fontWeight: '700', color: theme.textMuted },
    diffChipTextActive: { color: theme.green },
    statsRow: { flexDirection: 'row', gap: compact ? 6 : 8, flexShrink: 0 },
    stat: {
      flex: 1,
      minWidth: 0,
      paddingVertical: compact ? 6 : 8,
      paddingHorizontal: compact ? 4 : 8,
      borderRadius: UI_RADIUS_CARD,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      alignItems: 'center',
      gap: 2,
    },
    statLabel: { fontSize: sf(10), fontWeight: '600', color: theme.textMuted },
    statValue: { fontSize: sf(wide ? 16 : compact ? 13 : 14), fontWeight: '800', color: theme.text },
    boardOuter: { position: 'relative' },
    boardInner: {
      position: 'relative',
      borderRadius: UI_RADIUS_CARD_LG,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
      overflow: 'visible',
    },
    tile: {
      flex: 1,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tileText: { fontWeight: '800' },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      justifyContent: 'center',
      alignSelf: 'stretch',
      flexShrink: 0,
    },
    actionBtn: {
      flex: 1,
      minWidth: 120,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: compact ? 10 : 12,
      paddingHorizontal: 12,
      borderRadius: UI_RADIUS_CARD,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
    },
    actionBtnDisabled: { opacity: 0.45 },
    actionBtnPressed: { opacity: 0.88 },
    actionBtnText: { fontSize: sf(13), fontWeight: '700', color: theme.green },
    actionBtnTextDisabled: { color: theme.textDim },
  });
}
