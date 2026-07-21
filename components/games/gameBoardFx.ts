import { Animated } from 'react-native';

/** 보드 짧은 확대 */
export function runBoardPulse(pulse: Animated.Value, peak = 1.04): void {
  pulse.setValue(1);
  Animated.sequence([
    Animated.timing(pulse, { toValue: peak, duration: 100, useNativeDriver: true }),
    Animated.spring(pulse, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
  ]).start();
}

/** 보드 좌우 흔들림 */
export function runBoardShake(shake: Animated.Value, intensity = 8): void {
  shake.setValue(0);
  Animated.sequence([
    Animated.timing(shake, { toValue: intensity, duration: 40, useNativeDriver: true }),
    Animated.timing(shake, { toValue: -intensity, duration: 50, useNativeDriver: true }),
    Animated.timing(shake, { toValue: intensity * 0.75, duration: 45, useNativeDriver: true }),
    Animated.timing(shake, { toValue: -intensity * 0.5, duration: 45, useNativeDriver: true }),
    Animated.timing(shake, { toValue: 0, duration: 40, useNativeDriver: true }),
  ]).start();
}

/** 칸 짧은 좌우 흔들림 */
export function runCellWiggle(wiggle: Animated.Value): void {
  wiggle.setValue(0);
  Animated.sequence([
    Animated.timing(wiggle, { toValue: 6, duration: 35, useNativeDriver: true }),
    Animated.timing(wiggle, { toValue: -5, duration: 40, useNativeDriver: true }),
    Animated.timing(wiggle, { toValue: 3, duration: 35, useNativeDriver: true }),
    Animated.timing(wiggle, { toValue: 0, duration: 30, useNativeDriver: true }),
  ]).start();
}

/** 칸 맞춤 팝 */
export function runCellPop(scale: Animated.Value): void {
  scale.setValue(0.82);
  Animated.spring(scale, { toValue: 1, friction: 4, tension: 140, useNativeDriver: true }).start();
}

/** 힌트·선택 강조 */
export function runCellPulse(scale: Animated.Value): void {
  scale.setValue(0.9);
  Animated.spring(scale, { toValue: 1, friction: 3, tension: 160, useNativeDriver: true }).start();
}
