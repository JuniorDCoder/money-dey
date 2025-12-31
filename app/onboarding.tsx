import * as C from '@/constants/colors';
import * as IMG from '@/constants/images';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import React, { useRef, useState } from 'react';
import { Animated, Dimensions, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import GestureRecognizer from 'react-native-swipe-gestures';

const { width } = Dimensions.get('window');

const slides = [
  {
    key: 'slide1',
    title: 'Track your money in XAF',
    desc: 'See every CFA franc (XAF) at a glance across cash, bank & mobile money in Cameroon.',
    img: IMG.ONBOARDING_1,
  },
  {
    key: 'slide2',
    title: 'Budget smarter in Cameroon',
    desc: 'Set monthly envelopes in XAF and track spending across MTN MoMo, Orange Money, and bank cards.',
    img: IMG.ONBOARDING_2,
  },
  {
    key: 'slide3',
    title: 'Grow wealth',
    desc: 'Get personalized recommendations and tips.',
    img: IMG.ONBOARDING_3,
  },
  {
    key: 'slide4',
    title: 'Stay in control',
    desc: 'Insights and alerts to keep you on track.',
    img: IMG.ONBOARDING_4,
  },
];

export default function Onboarding() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const x = useRef(new Animated.Value(0)).current;

  const goTo = (next: number) => {
    if (next < 0 || next >= slides.length) return;
    Animated.timing(x, {
      toValue: next * width,
      duration: 280,
      useNativeDriver: false,
    }).start(() => setIndex(next));
  };

  const onSwipeLeft = () => goTo(index + 1);
  const onSwipeRight = () => goTo(index - 1);

  const onGetStarted = async () => {
    try {
      await SecureStore.setItemAsync('has_seen_onboarding', 'true');
    } catch {}
    try {
      router.replace('/auth/login');
    } catch {
      // no-op; consumers can navigate using AppNavigator
    }
  };

  return (
    <View style={styles.container}>
      <GestureRecognizer onSwipeLeft={onSwipeLeft} onSwipeRight={onSwipeRight} style={styles.gesture}>
        <Animated.View style={[styles.slider, { width: width * slides.length, transform: [{ translateX: Animated.multiply(x, -1) }] }]}>
          {slides.map((s) => (
            <View key={s.key} style={[styles.slide, { width }]}>              
              <View style={styles.imageWrap}>
                <Image source={{ uri: s.img }} resizeMode="cover" style={styles.image} />
                <View style={styles.overlay} />
              </View>
              <View style={styles.textWrap}>
                <Text style={styles.title}>{s.title}</Text>
                <Text style={styles.desc}>{s.desc}</Text>
              </View>
            </View>
          ))}
        </Animated.View>
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View key={i} style={[styles.dot, i === index ? styles.dotActive : null]} />
          ))}
        </View>
        {index === slides.length - 1 ? (
          <Pressable style={styles.cta} onPress={onGetStarted}>
            <Text style={styles.ctaText}>Get Started</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.skip} onPress={() => goTo(slides.length - 1)}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        )}
      </GestureRecognizer>
      <StatusBar hidden={true} />

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.PRIMARY_PURPLE },
  gesture: { flex: 1 },
  slider: { flexDirection: 'row', flex: 1 },
  slide: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  imageWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  image: { width: '100%', height: '100%', opacity: 0.6 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: C.PRIMARY_PURPLE_DARK, opacity: 0.4 },
  textWrap: { padding: 24, paddingBottom: 120, alignItems: 'center' },
  title: { color: C.TEXT_ON_PURPLE, fontSize: 28, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  desc: { color: '#EFEAFE', fontSize: 16, textAlign: 'center' },
  dots: { position: 'absolute', bottom: 90, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)', marginHorizontal: 4 },
  dotActive: { backgroundColor: '#fff', width: 18 },
  cta: { position: 'absolute', bottom: 24, left: 24, right: 24, backgroundColor: C.CARD_LIGHT, paddingVertical: 14, borderRadius: 12, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  ctaText: { color: C.PRIMARY_PURPLE, fontSize: 16, fontWeight: '700' },
  skip: { position: 'absolute', bottom: 24, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  skipText: { color: '#fff', opacity: 0.9 },
});
