import { useMemo } from 'react';
import { Animated, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const PAST_FILL = '#252E2A';
const FUTURE_FILL = '#1A2420';

function cellPath(col: number, row: number, stride: number, gap: number, block: number): string {
  const x = col * stride + gap;
  const y = row * stride + gap;
  return `M${x},${y}h${block}v${block}h-${block}z`;
}

function buildGridPaths(
  totalWeeks: number,
  cols: number,
  currentWeek: number,
  stride: number,
  gap: number,
  block: number
) {
  let past = '';
  let future = '';
  for (let week = 0; week < totalWeeks; week++) {
    if (week === currentWeek) continue;
    const col = week % cols;
    const row = Math.floor(week / cols);
    const d = cellPath(col, row, stride, gap, block);
    if (week > currentWeek) future += d;
    else past += d;
  }
  return { pastPath: past, futurePath: future };
}

export function OnboardingLifeGridSvg({
  totalWeeks,
  cols,
  currentWeek,
  width,
  height,
  lifeStride,
  lifeGap,
  lifeBlockSize,
  pulse,
  rs,
}: {
  totalWeeks: number;
  cols: number;
  currentWeek: number;
  width: number;
  height: number;
  lifeStride: number;
  lifeGap: number;
  lifeBlockSize: number;
  pulse: Animated.Value;
  rs: (n: number) => number;
}) {
  const { pastPath, futurePath } = useMemo(
    () => buildGridPaths(totalWeeks, cols, currentWeek, lifeStride, lifeGap, lifeBlockSize),
    [cols, currentWeek, lifeBlockSize, lifeGap, lifeStride, totalWeeks]
  );

  const focalCol = currentWeek % cols;
  const focalRow = Math.floor(currentWeek / cols);
  const glowLeft = focalCol * lifeStride + lifeGap;
  const glowTop = focalRow * lifeStride + lifeGap;

  const glowInner = {
    width: lifeBlockSize,
    height: lifeBlockSize,
    borderRadius: rs(0.5),
    backgroundColor: '#C9F8DA',
    borderWidth: 1,
    borderColor: 'rgba(200, 245, 215, 0.55)' as const,
    shadowColor: '#C9F8DA',
    shadowOpacity: 0.85,
    shadowRadius: 6,
  };

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        {pastPath.length > 0 && <Path d={pastPath} fill={PAST_FILL} />}
        {futurePath.length > 0 && <Path d={futurePath} fill={FUTURE_FILL} />}
      </Svg>
      <View
        style={{
          position: 'absolute',
          left: glowLeft,
          top: glowTop,
          width: lifeBlockSize,
          height: lifeBlockSize,
        }}
        pointerEvents="none"
      >
        <Animated.View style={{ ...glowInner, opacity: pulse }} />
      </View>
    </View>
  );
}
