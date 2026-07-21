import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Haptics from 'expo-haptics';

import { BlockPuzzleHelpSheet } from '@/components/games/BlockPuzzleHelpSheet';
import { blockPieceTint } from '@/components/games/blockPuzzleColors';
import { GameBurstOverlay } from '@/components/games/GameBurstOverlay';
import { runBoardPulse, runBoardShake } from '@/components/games/gameBoardFx';
import type { AppTheme } from '@/constants/theme';
import { UI_RADIUS_CARD, UI_RADIUS_CARD_LG } from '@/constants/uiCornerRadius';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import {
  recordBlockPuzzleGameOver,
  recordBlockPuzzleRunStarted,
} from '@/domain/games/records';
import {
  COLS,
  VISIBLE_ROWS,
  createBlockPuzzleGame,
  hardDropBlockPuzzle,
  moveBlockPuzzleLeft,
  moveBlockPuzzleRight,
  mulberry32,
  newBlockPuzzleGame,
  pieceCells,
  restartBlockPuzzleGame,
  rotateBlockPuzzle,
  softDropBlockPuzzle,
  tickBlockPuzzle,
  type BlockPuzzleDifficulty,
  type BlockPuzzleEvent,
  type BlockPuzzleState,
  type TetrominoType,
  visibleBoard,
} from '@/domain/games/blockPuzzle';
import {
  clearBlockPuzzleProgress,
  loadBlockPuzzleProgress,
  saveBlockPuzzleProgress,
} from '@/services/gameProgressStore';
import { updateGameRecords } from '@/services/gameRecordsStore';

const DIFFICULTIES: BlockPuzzleDifficulty[] = ['easy', 'normal', 'hard'];
const TICK_MS = 50;

type BoardFx = { id: number; kind: 'lines' | 'gameover'; subtitle?: string };

function BlockCell({
  id,
  cellSize,
  theme,
  empty,
}: {
  id: number;
  cellSize: number;
  theme: AppTheme;
  empty: boolean;
}) {
  if (empty) {
    return (
      <View
        style={{
          width: cellSize - 1,
          height: cellSize - 1,
          margin: 0.5,
          borderRadius: 3,
          backgroundColor: theme.bgElevated,
          borderColor: theme.border,
          borderWidth: StyleSheet.hairlineWidth,
        }}
      />
    );
  }
  const tint = blockPieceTint(theme, id);
  return (
    <View
      style={{
        width: cellSize - 1,
        height: cellSize - 1,
        margin: 0.5,
        borderRadius: 3,
        backgroundColor: tint.bg,
        borderColor: tint.border,
        borderWidth: 2,
        overflow: 'hidden',
      }}>
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '38%',
          backgroundColor: tint.shine,
          opacity: theme.colorScheme === 'dark' ? 0.28 : 0.2,
          borderTopLeftRadius: 2,
          borderTopRightRadius: 2,
        }}
      />
    </View>
  );
}

function MiniPreview({
  type,
  theme,
  cell,
  styles,
}: {
  type: TetrominoType;
  theme: AppTheme;
  cell: number;
  styles: ReturnType<typeof makeStyles>;
}) {
  const cells = pieceCells({ type, rotation: 0, r: 0, c: 0 });
  const ids = new Set(cells.map(({ r, c }) => `${r},${c}`));
  const rows = 4;
  const cols = 4;
  return (
    <View style={[styles.previewGrid, { width: cols * cell, height: rows * cell }]}>
      {Array.from({ length: rows }, (_, r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {Array.from({ length: cols }, (_, c) => {
            const id = ids.has(`${r},${c}`) ? typeToDisplayId(type) : 0;
            const tint = id ? blockPieceTint(theme, id) : null;
            return (
              <View
                key={c}
                style={[
                  styles.miniCell,
                  {
                    width: cell - 2,
                    height: cell - 2,
                    margin: 1,
                    backgroundColor: tint?.bg ?? 'transparent',
                    borderColor: tint?.border ?? 'transparent',
                    borderWidth: id ? 2 : 0,
                  },
                ]}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

function typeToDisplayId(type: TetrominoType): number {
  const map: Record<TetrominoType, number> = {
    I: 1,
    O: 2,
    T: 3,
    S: 4,
    Z: 5,
    J: 6,
    L: 7,
  };
  return map[type];
}

export function BlockPuzzleGame({
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
  const measuredBoard =
    playArea.w > 0 && playArea.h > 0
      ? Math.floor(Math.min(playArea.w - 4, (playArea.h * COLS) / VISIBLE_ROWS))
      : 0;
  const reservedChrome = compact ? 148 : split ? 0 : 160;
  const fallbackBoard = split
    ? Math.max(280, Math.min(400, Math.floor(viewportHeight * 0.52)))
    : wide
      ? 360
      : Math.max(
          240,
          Math.min(
            360,
            Math.floor(Math.min(viewportHeight - reservedChrome, viewportHeight * 0.58) * (COLS / VISIBLE_ROWS)),
          ),
        );
  const boardWidth = measuredBoard > 0 ? measuredBoard : fallbackBoard;
  const cellSize = Math.floor(boardWidth / COLS);
  const boardHeight = cellSize * VISIBLE_ROWS;
  const styles = useMemo(
    () => makeStyles(theme, scaleFont, wide, compact, boardWidth),
    [theme, scaleFont, wide, compact, boardWidth],
  );

  const [difficulty, setDifficulty] = useState<BlockPuzzleDifficulty>('normal');
  const [state, setState] = useState<BlockPuzzleState>(() => createBlockPuzzleGame('normal'));
  const [helpOpen, setHelpOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [boardFx, setBoardFx] = useState<BoardFx | null>(null);
  const recordedGameOverRef = useRef(false);
  const rngRef = useRef(mulberry32(4242));
  const boardPulse = useRef(new Animated.Value(1)).current;
  const boardShake = useRef(new Animated.Value(0)).current;
  const fxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFxTimer = useCallback(() => {
    if (fxTimer.current) {
      clearTimeout(fxTimer.current);
      fxTimer.current = null;
    }
  }, []);

  const handleEvents = useCallback(
    (events: BlockPuzzleEvent[]) => {
      for (const ev of events) {
        if (ev.kind === 'lines') {
          runBoardPulse(boardPulse, ev.count >= 4 ? 1.06 : 1.04);
          clearFxTimer();
          setBoardFx({
            id: Date.now(),
            kind: 'lines',
            subtitle: t('gameBlockPuzzleLinePoints', { points: ev.points }),
          });
          fxTimer.current = setTimeout(() => {
            setBoardFx(null);
            fxTimer.current = null;
          }, 700);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        } else if (ev.kind === 'gameover') {
          runBoardShake(boardShake, 10);
          clearFxTimer();
          setBoardFx({ id: Date.now(), kind: 'gameover' });
          fxTimer.current = setTimeout(() => {
            setBoardFx(null);
            fxTimer.current = null;
          }, 1400);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        }
      }
    },
    [boardPulse, boardShake, clearFxTimer, t],
  );

  useEffect(() => () => clearFxTimer(), [clearFxTimer]);

  useEffect(() => {
    let cancelled = false;
    void loadBlockPuzzleProgress().then((progress) => {
      if (cancelled) return;
      if (progress) {
        setDifficulty(progress.difficulty);
        setState(progress.state);
      } else {
        void updateGameRecords((r) => recordBlockPuzzleRunStarted(r));
      }
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void saveBlockPuzzleProgress(state);
  }, [state, hydrated]);

  useEffect(() => {
    if (!hydrated || state.status !== 'gameover' || recordedGameOverRef.current) return;
    recordedGameOverRef.current = true;
    void updateGameRecords((r) =>
      recordBlockPuzzleGameOver(r, state.difficulty, state.score, state.lines, state.level),
    );
    void clearBlockPuzzleProgress();
  }, [hydrated, state.status, state.difficulty, state.score, state.lines, state.level]);

  useEffect(() => {
    if (!hydrated || state.status !== 'playing') return;
    const id = setInterval(() => {
      setState((prev) => {
        if (prev.status !== 'playing') return prev;
        const step = tickBlockPuzzle(prev, TICK_MS, rngRef.current);
        if (step.events.length > 0) {
          queueMicrotask(() => handleEvents(step.events));
        }
        return step.state;
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [hydrated, state.status, handleEvents]);

  const onDifficulty = useCallback((d: BlockPuzzleDifficulty) => {
    setDifficulty(d);
    setState(newBlockPuzzleGame(d));
    recordedGameOverRef.current = false;
    void clearBlockPuzzleProgress();
    void updateGameRecords((r) => recordBlockPuzzleRunStarted(r));
  }, []);

  const onNewGame = useCallback(() => {
    setState((prev) => restartBlockPuzzleGame(prev));
    recordedGameOverRef.current = false;
    void clearBlockPuzzleProgress();
    void updateGameRecords((r) => recordBlockPuzzleRunStarted(r));
  }, []);

  const onLeft = useCallback(() => {
    setState((prev) => {
      const step = moveBlockPuzzleLeft(prev);
      if (step.state !== prev) void Haptics.selectionAsync().catch(() => {});
      return step.state;
    });
  }, []);

  const onRight = useCallback(() => {
    setState((prev) => {
      const step = moveBlockPuzzleRight(prev);
      if (step.state !== prev) void Haptics.selectionAsync().catch(() => {});
      return step.state;
    });
  }, []);

  const onRotate = useCallback(() => {
    setState((prev) => {
      const step = rotateBlockPuzzle(prev);
      if (step.state.piece?.rotation !== prev.piece?.rotation) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      return step.state;
    });
  }, []);

  const onSoftDrop = useCallback(() => {
    setState((prev) => {
      const step = softDropBlockPuzzle(prev, rngRef.current);
      if (step.events.length > 0) queueMicrotask(() => handleEvents(step.events));
      return step.state;
    });
  }, [handleEvents]);

  const onHardDrop = useCallback(() => {
    setState((prev) => {
      const step = hardDropBlockPuzzle(prev, rngRef.current);
      if (step.events.length > 0) queueMicrotask(() => handleEvents(step.events));
      return step.state;
    });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, [handleEvents]);

  const boardGestures = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => state.status === 'playing',
        onMoveShouldSetPanResponder: (_, g) =>
          state.status === 'playing' && (Math.abs(g.dx) > 10 || Math.abs(g.dy) > 10),
        onPanResponderRelease: (_, g) => {
          const { dx, dy } = g;
          if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
          if (Math.abs(dx) >= Math.abs(dy)) {
            if (dx > 0) onRight();
            else onLeft();
          } else if (dy > 0) {
            onSoftDrop();
          } else {
            onRotate();
          }
        },
      }),
    [state.status, onLeft, onRight, onSoftDrop, onRotate],
  );

  const onPlayAreaLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setPlayArea((prev) =>
      Math.abs(prev.w - width) < 1 && Math.abs(prev.h - height) < 1
        ? prev
        : { w: width, h: height },
    );
  }, []);

  const grid = useMemo(() => visibleBoard(state), [state]);

  const headerBar = (
    <View style={styles.headerBar}>
      <View style={styles.diffRow}>
        {DIFFICULTIES.map((d) => {
          const active = difficulty === d;
          const label =
            d === 'easy'
              ? t('gameBlockPuzzleDiffEasy')
              : d === 'normal'
                ? t('gameBlockPuzzleDiffNormal')
                : t('gameBlockPuzzleDiffHard');
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
          accessibilityLabel={t('gameBlockPuzzleNewGame')}>
          <FontAwesome name="refresh" size={15} color={theme.textMuted} />
        </Pressable>
        <Pressable
          onPress={() => setHelpOpen(true)}
          style={styles.headerIconBtn}
          accessibilityRole="button"
          accessibilityLabel={t('gameBlockPuzzleHelpShowA11y')}>
          <FontAwesome name="question-circle" size={16} color={theme.green} />
        </Pressable>
      </View>
    </View>
  );

  const statsRow = (
    <View style={styles.statsRow}>
      <Stat icon="star" label={t('gameBlockPuzzleScore')} value={String(state.score)} theme={theme} styles={styles} />
      <Stat icon="minus" label={t('gameBlockPuzzleLines')} value={String(state.lines)} theme={theme} styles={styles} />
      <Stat icon="flag" label={t('gameBlockPuzzleLevel')} value={String(state.level)} theme={theme} styles={styles} />
      {!split ? (
        <View style={styles.nextBoxInline}>
          <Text style={styles.nextLabel}>{t('gameBlockPuzzleNext')}</Text>
          <MiniPreview
            type={state.next}
            theme={theme}
            cell={Math.max(10, Math.floor(cellSize * 0.28))}
            styles={styles}
          />
        </View>
      ) : null}
    </View>
  );

  const nextPreview = (
    <View style={styles.nextBox}>
      <Text style={styles.nextLabel}>{t('gameBlockPuzzleNext')}</Text>
      <MiniPreview
        type={state.next}
        theme={theme}
        cell={Math.max(12, Math.floor(cellSize * 0.34))}
        styles={styles}
      />
    </View>
  );

  const boardView = (
    <Animated.View
      {...boardGestures.panHandlers}
      style={[
        styles.boardWrap,
        {
          width: boardWidth,
          height: boardHeight,
          transform: [{ scale: boardPulse }, { translateX: boardShake }],
        },
      ]}>
      <View style={[styles.board, { width: boardWidth, height: boardHeight }]}>
        {grid.map((row, r) => (
          <View key={r} style={styles.boardRow}>
            {row.map((id, c) => (
              <BlockCell key={c} id={id} cellSize={cellSize} theme={theme} empty={id === 0} />
            ))}
          </View>
        ))}
      </View>
      <GameBurstOverlay
        visible={boardFx?.kind === 'lines'}
        kind="hit"
        theme={theme}
        sf={scaleFont}
        title={t('gameBlockPuzzleLineFx')}
        subtitle={boardFx?.subtitle}
      />
      <GameBurstOverlay
        visible={boardFx?.kind === 'gameover'}
        kind="fail"
        theme={theme}
        sf={scaleFont}
        title={t('gameBlockPuzzleGameOver')}
        subtitle={t('gameBlockPuzzleGameOverScore', { score: state.score })}
        big
      />
    </Animated.View>
  );

  const controlDock = (
    <View style={[styles.controlDock, split && styles.controlDockSplit]}>
      <View style={styles.actionZone}>
        <ControlBtn
          icon="rotate-right"
          label={t('gameBlockPuzzleRotateA11y')}
          onPress={onRotate}
          disabled={state.status !== 'playing'}
          theme={theme}
          styles={styles}
          primary
          large
        />
        <ControlBtn
          icon="bolt"
          label={t('gameBlockPuzzleHardDropA11y')}
          onPress={onHardDrop}
          disabled={state.status !== 'playing'}
          theme={theme}
          styles={styles}
          accent
          large
        />
      </View>
      <View style={styles.moveZone}>
        <View style={styles.moveRow}>
          <ControlBtn
            icon="arrow-left"
            label={t('gameBlockPuzzleMoveLeftA11y')}
            onPress={onLeft}
            disabled={state.status !== 'playing'}
            theme={theme}
            styles={styles}
            large
          />
          <ControlBtn
            icon="arrow-down"
            label={t('gameBlockPuzzleSoftDropA11y')}
            onPress={onSoftDrop}
            disabled={state.status !== 'playing'}
            theme={theme}
            styles={styles}
            large
          />
          <ControlBtn
            icon="arrow-right"
            label={t('gameBlockPuzzleMoveRightA11y')}
            onPress={onRight}
            disabled={state.status !== 'playing'}
            theme={theme}
            styles={styles}
            large
          />
        </View>
      </View>
    </View>
  );

  const body = split ? (
    <View style={styles.splitRow}>
      <View style={styles.splitBoard} onLayout={onPlayAreaLayout}>
        {boardView}
      </View>
      <View style={styles.splitSide}>
        {headerBar}
        {statsRow}
        {nextPreview}
        {controlDock}
      </View>
    </View>
  ) : fill ? (
    <View style={styles.fillRoot}>
      {headerBar}
      {statsRow}
      <View style={styles.playArea} onLayout={onPlayAreaLayout}>
        {boardView}
      </View>
      {controlDock}
    </View>
  ) : (
    <View style={styles.stack}>
      {headerBar}
      {statsRow}
      <View style={styles.playAreaStacked} onLayout={onPlayAreaLayout}>
        {boardView}
      </View>
      {controlDock}
    </View>
  );

  return (
    <>
      {body}
      <BlockPuzzleHelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}

function Stat({
  icon,
  label,
  value,
  theme,
  styles,
}: {
  icon: ComponentProps<typeof FontAwesome>['name'];
  label: string;
  value: string;
  theme: AppTheme;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.stat}>
      <FontAwesome name={icon} size={11} color={theme.textDim} />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function ControlBtn({
  icon,
  label,
  onPress,
  disabled,
  theme,
  styles,
  primary,
  accent,
  large,
}: {
  icon: ComponentProps<typeof FontAwesome>['name'];
  label: string;
  onPress: () => void;
  disabled: boolean;
  theme: AppTheme;
  styles: ReturnType<typeof makeStyles>;
  primary?: boolean;
  accent?: boolean;
  large?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.ctrlBtn,
        large && styles.ctrlBtnLarge,
        primary && styles.ctrlBtnPrimary,
        accent && styles.ctrlBtnAccent,
        disabled && styles.ctrlBtnDisabled,
        pressed && !disabled && styles.ctrlBtnPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}>
      <FontAwesome
        name={icon}
        size={large ? (primary ? 20 : 18) : primary ? 18 : 16}
        color={accent ? theme.warning : primary ? theme.green : theme.text}
      />
    </Pressable>
  );
}

function makeStyles(
  theme: AppTheme,
  sf: (n: number) => number,
  wide: boolean,
  compact: boolean,
  boardWidth: number,
) {
  const gap = compact ? 6 : wide ? 12 : 10;
  const ctrlSize = compact ? 56 : wide ? 50 : 48;
  return StyleSheet.create({
    stack: {
      gap,
      alignItems: 'stretch',
    },
    fillRoot: {
      flex: 1,
      minHeight: 0,
      gap,
    },
    playArea: {
      flex: 1,
      minHeight: 0,
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
    },
    playAreaStacked: {
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: boardWidth * (VISIBLE_ROWS / COLS),
    },
    splitRow: {
      flex: 1,
      flexDirection: 'row',
      gap: 20,
      minHeight: 0,
    },
    splitBoard: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    splitSide: {
      width: Math.min(280, Math.max(220, boardWidth * 0.55)),
      gap: 10,
      justifyContent: 'center',
    },
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
    diffChipActive: {
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
    },
    diffChipText: {
      fontSize: sf(compact ? 12 : 13),
      fontWeight: '600',
      color: theme.textMuted,
    },
    diffChipTextActive: {
      color: theme.green,
    },
    statsRow: {
      flexDirection: 'row',
      gap: compact ? 6 : 8,
      flexShrink: 0,
    },
    stat: {
      flex: 1,
      minWidth: 0,
      paddingVertical: compact ? 5 : 8,
      paddingHorizontal: compact ? 4 : 8,
      borderRadius: UI_RADIUS_CARD,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      alignItems: 'center',
      gap: 1,
    },
    statLabel: {
      fontSize: sf(10),
      fontWeight: '600',
      color: theme.textMuted,
    },
    statValue: {
      fontSize: sf(compact ? 14 : wide ? 17 : 15),
      fontWeight: '800',
      color: theme.text,
    },
    boardWrap: {
      position: 'relative',
      borderRadius: UI_RADIUS_CARD_LG,
      overflow: 'hidden',
    },
    board: {
      borderRadius: UI_RADIUS_CARD_LG,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
      overflow: 'hidden',
    },
    boardRow: {
      flexDirection: 'row',
    },
    controlDock: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: compact ? 10 : 16,
      flexShrink: 0,
      paddingTop: 2,
      width: '100%',
    },
    controlDockSplit: {
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: 10,
    },
    moveZone: {
      flex: 1,
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    moveRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: compact ? 6 : 8,
    },
    actionZone: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: compact ? 6 : 8,
    },
    nextBoxInline: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      paddingVertical: compact ? 4 : 6,
      paddingHorizontal: compact ? 6 : 8,
      borderRadius: UI_RADIUS_CARD,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      minWidth: compact ? 52 : 60,
    },
    nextBox: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingVertical: compact ? 6 : 8,
      paddingHorizontal: compact ? 8 : 10,
      borderRadius: UI_RADIUS_CARD,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      minWidth: compact ? 68 : 76,
    },
    nextLabel: {
      fontSize: sf(10),
      fontWeight: '700',
      color: theme.textMuted,
    },
    previewGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    miniCell: {
      borderRadius: 2,
    },
    ctrlBtn: {
      width: ctrlSize,
      height: ctrlSize,
      borderRadius: UI_RADIUS_CARD,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctrlBtnLarge: {
      width: ctrlSize,
      height: ctrlSize,
    },
    ctrlBtnPrimary: {
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
    },
    ctrlBtnAccent: {
      borderColor: theme.warning,
      backgroundColor: theme.warningDim,
    },
    ctrlBtnDisabled: {
      opacity: 0.45,
    },
    ctrlBtnPressed: {
      opacity: 0.85,
    },
  });
}
