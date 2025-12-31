import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

interface ShimmerProps {
  style?: StyleProp<ViewStyle>;
  height?: number;
  width?: number | string;
  borderRadius?: number;
  baseColor?: string;
  highlightColor?: string;
}

export default function Shimmer({
  style,
  height = 16,
  width = '100%',
  borderRadius = 12,
  baseColor = '#EFEAFE',
  highlightColor = 'rgba(255,255,255,0.6)'
}: ShimmerProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const run = () => {
      translateX.setValue(-containerWidth);
      Animated.timing(translateX, {
        toValue: containerWidth,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(() => run());
    };
    if (containerWidth > 0) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerWidth]);

  const onLayout = (e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width || 0);
  };

  return (
    <View style={[styles.container, { height, width: width as any, borderRadius, backgroundColor: baseColor }, style]} onLayout={onLayout}>
      {containerWidth > 0 && (
        <Animated.View
          style={[
            styles.shimmer,
            {
              transform: [{ translateX }],
              height,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    position: 'relative',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 60,
    backgroundColor: 'rgba(255,255,255,0.6)',
    opacity: 0.8,
  },
});
