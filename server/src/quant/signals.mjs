import { computeFactors, roundOrNull } from './factors.mjs';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function addReason(out, code) {
  if (!code || out.includes(code)) return;
  out.push(code);
}

// Each sub-score is centered at 50 (neutral) and bounded to [0, 100] so the
// composite stays interpretable and no single factor can dominate.
function trendScore(factors, reasons) {
  let score = 50;
  if (factors.vsSma20Pct != null) score += clamp(factors.vsSma20Pct * 1.6, -22, 22);
  if (factors.vsSma60Pct != null) score += clamp(factors.vsSma60Pct * 1.1, -18, 18);
  if (factors.sma20VsSma60Pct != null) score += clamp(factors.sma20VsSma60Pct * 2.0, -12, 12);

  if (factors.vsSma20Pct != null && factors.vsSma60Pct != null) {
    if (factors.vsSma20Pct > 0 && factors.vsSma60Pct > 0) addReason(reasons, 'trend_up');
    else if (factors.vsSma20Pct < 0 && factors.vsSma60Pct < 0) addReason(reasons, 'trend_down');
  }
  if (factors.sma20VsSma60Pct != null) {
    if (factors.sma20VsSma60Pct >= 1) addReason(reasons, 'golden_cross_zone');
    else if (factors.sma20VsSma60Pct <= -1) addReason(reasons, 'dead_cross_zone');
  }
  return clamp(Math.round(score), 0, 100);
}

function momentumScore(factors, reasons) {
  let score = 50;
  if (factors.return20d != null) score += clamp(factors.return20d * 1.4, -24, 24);
  if (factors.return60d != null) score += clamp(factors.return60d * 0.7, -18, 18);
  if (factors.return5d != null) score += clamp(factors.return5d * 0.8, -10, 10);

  if (factors.return20d != null && factors.return20d >= 8) addReason(reasons, 'momentum_strong');
  else if (factors.return20d != null && factors.return20d <= -8) addReason(reasons, 'momentum_weak');
  if (factors.vsHigh52wPct != null && factors.vsHigh52wPct >= -3) addReason(reasons, 'near_52w_high');
  if (factors.vsLow52wPct != null && factors.vsLow52wPct <= 5) addReason(reasons, 'near_52w_low');
  return clamp(Math.round(score), 0, 100);
}

// Contrarian overlay: rewards oversold mean-reversion candidates and trims
// overbought chases. Centered at 50.
function meanReversionScore(factors, reasons) {
  const rsi = factors.rsi14;
  if (rsi == null) return 50;
  let score = 50;
  if (rsi >= 75) {
    score -= 22;
    addReason(reasons, 'overbought');
  } else if (rsi >= 68) {
    score -= 12;
    addReason(reasons, 'overbought_mild');
  } else if (rsi <= 25) {
    score += 20;
    addReason(reasons, 'oversold');
  } else if (rsi <= 32) {
    score += 10;
    addReason(reasons, 'oversold_mild');
  }
  return clamp(Math.round(score), 0, 100);
}

function volumeScore(factors, reasons) {
  const ratio = factors.volumeRatio;
  if (ratio == null) return 50;
  let score = 50;
  if (ratio >= 2) {
    score += 16;
    addReason(reasons, 'volume_spike');
  } else if (ratio >= 1.3) {
    score += 8;
    addReason(reasons, 'volume_active');
  } else if (ratio <= 0.6) {
    score -= 8;
    addReason(reasons, 'volume_dry');
  }
  return clamp(Math.round(score), 0, 100);
}

function riskFromVolatility(volatility) {
  if (volatility == null) return 'unknown';
  if (volatility >= 55) return 'high';
  if (volatility >= 32) return 'medium';
  return 'low';
}

// Maps the composite score + trend posture to an actionable label.
function decideAction(score, factors) {
  const trendingDown = factors.vsSma60Pct != null && factors.vsSma60Pct < -3;
  if (score >= 70 && !trendingDown) return 'buy';
  if (score >= 58) return 'accumulate';
  if (score >= 45) return 'hold';
  if (score >= 33) return 'reduce';
  return 'avoid';
}

function levelForScore(score) {
  if (score >= 70) return 'strong';
  if (score >= 58) return 'watch';
  if (score >= 45) return 'neutral';
  return 'weak';
}

const ACTION_HEADLINE = {
  buy: '추세 투자 관점에서 관심',
  accumulate: '분할 관찰이 필요한 구간',
  hold: '확인 신호를 기다릴 구간',
  reduce: '리스크 관리가 우선인 구간',
  avoid: '보수적으로 지켜볼 구간',
};

function fmtPct(value, digits = 1) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const n = Number(value);
  return `${n >= 0 ? '+' : ''}${n.toFixed(digits)}%`;
}

function buildPerspective({ action, factors, risk }) {
  const positives = [];
  const cautions = [];
  const ret20 = factors.return20d;
  const vs20 = factors.vsSma20Pct;
  const vs60 = factors.vsSma60Pct;
  const rsi = factors.rsi14;
  const volume = factors.volumeRatio;
  const nearHigh = factors.vsHigh52wPct;
  const nearLow = factors.vsLow52wPct;

  if (vs20 != null && vs60 != null && vs20 > 0 && vs60 > 0) {
    positives.push('중기 추세 위에서 움직이고 있습니다.');
  }
  if (ret20 != null && ret20 >= 5) {
    positives.push(`최근 20일 수익률이 ${fmtPct(ret20)}로 가격 힘이 붙었습니다.`);
  }
  if (volume != null && volume >= 1.3) {
    positives.push('거래량이 평소보다 늘어 관심이 붙는 구간입니다.');
  }
  if (nearHigh != null && nearHigh >= -5) {
    positives.push('52주 고점권에 가까워 주도주 관점에서 볼 수 있습니다.');
  }
  if (nearLow != null && nearLow <= 8 && rsi != null && rsi <= 35) {
    positives.push('낙폭 이후 반등 가능성을 보는 역발상 관점에 들어옵니다.');
  }

  if (rsi != null && rsi >= 70) {
    cautions.push('단기 과열 신호가 있어 추격 매수는 신중해야 합니다.');
  }
  if (vs20 != null && vs60 != null && vs20 < 0 && vs60 < 0) {
    cautions.push('단기·중기 추세가 모두 약해 확인 전 진입은 부담이 큽니다.');
  }
  if (risk === 'high') {
    cautions.push('변동성이 높아 비중과 손절 기준을 먼저 정해야 합니다.');
  }
  if (volume != null && volume <= 0.6) {
    cautions.push('거래량이 줄어 신호 신뢰도가 낮을 수 있습니다.');
  }

  if (action === 'buy' || action === 'accumulate') {
    return {
      key: 'trend',
      label: '추세 투자 관점',
      principle: '오닐·미너비니식으로 가격 추세와 거래량 확인을 우선합니다.',
      positives: positives.slice(0, 3),
      cautions: cautions.slice(0, 2),
    };
  }
  if ((rsi != null && rsi <= 35) || (nearLow != null && nearLow <= 8)) {
    return {
      key: 'contrarian',
      label: '역발상 관점',
      principle: '하워드 막스식으로 시장이 과하게 밀어낸 구간인지 확인합니다.',
      positives: positives.slice(0, 3),
      cautions: cautions.slice(0, 2),
    };
  }
  if (action === 'reduce' || action === 'avoid' || risk === 'high') {
    return {
      key: 'risk',
      label: '리스크 관리 관점',
      principle: '손실 회피와 변동성 관리를 우선해 보는 구간입니다.',
      positives: positives.slice(0, 2),
      cautions: cautions.slice(0, 3),
    };
  }
  return {
    key: 'checklist',
    label: '체크리스트 관점',
    principle: '가격·거래량·과열도를 함께 보며 다음 신호를 기다립니다.',
    positives: positives.slice(0, 2),
    cautions: cautions.slice(0, 2),
  };
}

// Builds a plain-Korean explanation of the signal from the underlying
// indicators so the card can answer "왜 이 관점인가?" without jargon.
function buildInterpretation({ action, factors, rank, perspective }) {
  const sentences = [];

  if (Number.isFinite(rank) && rank > 0) {
    sentences.push(`코스피 시총 ${rank}위 종목입니다.`);
  }

  if (perspective?.label) {
    sentences.push(`${perspective.label}으로 점검합니다.`);
  }

  const vs20 = factors.vsSma20Pct;
  const vs60 = factors.vsSma60Pct;
  if (vs20 != null && vs60 != null) {
    if (vs20 > 0 && vs60 > 0) {
      sentences.push(`20일선(${fmtPct(vs20)})과 60일선(${fmtPct(vs60)}) 위에서 거래되며 상승 추세가 유지되고 있습니다.`);
    } else if (vs20 < 0 && vs60 < 0) {
      sentences.push(`20일선(${fmtPct(vs20)})과 60일선(${fmtPct(vs60)}) 아래에서 거래되며 하락 추세가 이어지고 있습니다.`);
    } else {
      sentences.push(`단기·중기 이동평균이 엇갈려(20일 ${fmtPct(vs20)}, 60일 ${fmtPct(vs60)}) 추세 전환 구간입니다.`);
    }
  }

  const ret20 = factors.return20d;
  if (ret20 != null) {
    const strength = Math.abs(ret20) >= 8 ? '강한' : Math.abs(ret20) >= 3 ? '완만한' : '제한적인';
    const dir = ret20 >= 0 ? '상승' : '하락';
    sentences.push(`최근 20일 ${fmtPct(ret20)}로 ${strength} ${dir} 모멘텀을 보입니다.`);
  }

  const rsi = factors.rsi14;
  if (rsi != null) {
    if (rsi >= 70) sentences.push(`RSI ${rsi.toFixed(0)}로 과매수 영역이라 단기 조정 가능성에 유의하세요.`);
    else if (rsi <= 30) sentences.push(`RSI ${rsi.toFixed(0)}로 과매도 영역이라 기술적 반등 가능성이 있습니다.`);
    else sentences.push(`RSI ${rsi.toFixed(0)}로 중립 수준입니다.`);
  }

  const vol = factors.volatility;
  if (vol != null && vol >= 45) {
    sentences.push(`연환산 변동성이 ${vol.toFixed(0)}%로 높아 분할 접근이 안전합니다.`);
  }

  const guidance = {
    buy: '추세와 모멘텀이 우호적이지만, 실제 매수 전 실적·밸류에이션·뉴스 근거를 함께 확인해야 합니다.',
    accumulate: '가격 힘은 살아 있으나 강도가 완벽하지 않아 분할 관찰이 적합합니다.',
    hold: '뚜렷한 우위가 약해 기존 관심 유지와 추가 신호 확인이 바람직합니다.',
    reduce: '추세가 약화되고 있어 비중과 손익 기준을 먼저 점검할 구간입니다.',
    avoid: '하락 추세가 우세해 신규 관심보다 관망이 안전합니다.',
  }[action];
  if (guidance) sentences.push(guidance);

  return {
    headline: ACTION_HEADLINE[action] || ACTION_HEADLINE.hold,
    interpretation: sentences.join(' '),
  };
}

function confidenceFromCoverage(factors) {
  // More history + lower volatility = more trustworthy signal.
  const bars = Number(factors.barCount) || 0;
  let coverage = bars >= 250 ? 1 : bars >= 120 ? 0.8 : bars >= 60 ? 0.6 : bars >= 20 ? 0.4 : 0.2;
  if (factors.volatility != null && factors.volatility >= 55) coverage -= 0.1;
  return clamp(Math.round(coverage * 100), 10, 100);
}

const WEIGHTS = { trend: 0.4, momentum: 0.32, meanReversion: 0.18, volume: 0.1 };

/**
 * Computes an algorithmic trade signal for a single instrument from its daily
 * bar series. Returns null when there is not enough data to score.
 *
 * @param {object} input
 * @param {object} input.instrument - { symbol, displaySymbol, name }
 * @param {Array} input.bars - ascending daily OHLCV bars
 * @param {object|null} [input.liveQuote] - optional latest snapshot for freshness overlay
 */
export function buildQuantSignal({ instrument, bars = [], liveQuote = null, asOf = null }) {
  if (!Array.isArray(bars) || bars.length < 20) return null;
  const factors = computeFactors(bars);
  if (factors.lastClose == null) return null;

  const reasons = [];
  const subScores = {
    trend: trendScore(factors, reasons),
    momentum: momentumScore(factors, reasons),
    meanReversion: meanReversionScore(factors, reasons),
    volume: volumeScore(factors, reasons),
  };

  const composite =
    subScores.trend * WEIGHTS.trend +
    subScores.momentum * WEIGHTS.momentum +
    subScores.meanReversion * WEIGHTS.meanReversion +
    subScores.volume * WEIGHTS.volume;
  const score = clamp(Math.round(composite), 0, 100);
  const action = decideAction(score, factors);
  if (reasons.length === 0) addReason(reasons, 'range_bound');

  const symbol = instrument?.symbol || liveQuote?.krxSymbol || liveQuote?.symbol || null;
  const rank = Number.isFinite(Number(instrument?.rank)) && Number(instrument.rank) > 0 ? Math.round(Number(instrument.rank)) : null;
  const risk = riskFromVolatility(factors.volatility);
  const perspective = buildPerspective({ action, factors, risk });
  const { headline, interpretation } = buildInterpretation({ action, factors, rank, perspective });
  return {
    symbol,
    displaySymbol: instrument?.displaySymbol || instrument?.symbol || symbol,
    name: instrument?.name || null,
    rank,
    score,
    level: levelForScore(score),
    action,
    headline,
    interpretation,
    perspective,
    risk,
    confidence: confidenceFromCoverage(factors),
    factors: {
      trend: subScores.trend,
      momentum: subScores.momentum,
      meanReversion: subScores.meanReversion,
      volume: subScores.volume,
    },
    indicators: {
      lastClose: roundOrNull(factors.lastClose, 2),
      sma20: roundOrNull(factors.sma20, 2),
      sma60: roundOrNull(factors.sma60, 2),
      vsSma20Pct: roundOrNull(factors.vsSma20Pct, 2),
      vsSma60Pct: roundOrNull(factors.vsSma60Pct, 2),
      return20d: roundOrNull(factors.return20d, 2),
      return60d: roundOrNull(factors.return60d, 2),
      rsi14: roundOrNull(factors.rsi14, 1),
      volatility: roundOrNull(factors.volatility, 1),
      vsHigh52wPct: roundOrNull(factors.vsHigh52wPct, 2),
      volumeRatio: roundOrNull(factors.volumeRatio, 2),
    },
    reasonCodes: reasons,
    barCount: factors.barCount,
    lastBarDate: bars[bars.length - 1]?.date || null,
    liveQuote: liveQuote || null,
    updatedAt: asOf || new Date().toISOString(),
  };
}
