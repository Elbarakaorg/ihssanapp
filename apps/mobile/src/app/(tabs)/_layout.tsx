import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Tabs } from 'expo-router';
import { Activity, Compass, HeartHandshake, House, type LucideIcon, Menu } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View, type ColorValue } from 'react-native';
import type { BottomTabBarButtonProps } from 'expo-router/build/react-navigation/bottom-tabs/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RightDrawer } from '@/features/navigation/right-drawer';
import { palette } from '@/ui/palette';

function tabIcon(Icon: LucideIcon) {
  return ({ focused }: { color: ColorValue; focused: boolean; size: number }) => (
    <AnimatedTabIcon Icon={Icon} focused={focused} />
  );
}

function AnimatedTabIcon({ Icon, focused }: { Icon: LucideIcon; focused: boolean }) {
  return (
    <View style={iconStyles.slot}>
      {focused ? <View style={[StyleSheet.absoluteFill, iconStyles.capsule]} /> : null}
      <Icon color={focused ? palette.white : palette.muted} size={20} strokeWidth={2.1} />
    </View>
  );
}

function TabButton({ children, href, onLongPress, onMenuPress, onPress, style, ref: _ref, ...rest }: BottomTabBarButtonProps & { onMenuPress?: () => void }) {
  return (
    <Pressable
      {...rest}
      {...(!onMenuPress && href ? { href } : {})}
      onLongPress={onLongPress}
      onPress={onMenuPress ? () => onMenuPress() : onPress}
      style={({ pressed }) => [style, pressed && iconStyles.pressed]}>
      <View style={iconStyles.buttonInner}>{children}</View>
    </Pressable>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <Tabs
        screenListeners={{
          tabPress: () => {
            if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          },
        }}
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: palette.forest,
          tabBarInactiveTintColor: palette.muted,
          tabBarButton: TabButton,
          tabBarStyle: {
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: insets.bottom + 12,
            height: 66,
            borderRadius: 26,
            borderCurve: 'continuous',
            borderTopWidth: 0,
            overflow: 'hidden',
            backgroundColor: 'transparent',
            boxShadow: '0px 8px 24px rgba(28, 28, 30, 0.14)',
          },
          tabBarBackground: () => (
            <BlurView
              blurMethod="dimezisBlurViewSdk31Plus"
              intensity={Platform.OS === 'ios' ? 72 : 92}
              style={StyleSheet.absoluteFill}
              tint={Platform.OS === 'ios' ? 'systemChromeMaterialLight' : 'light'}
            />
          ),
          tabBarItemStyle: { paddingTop: 8 },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '700',
            marginTop: 2,
          },
          tabBarHideOnKeyboard: true,
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: tabIcon(House),
          }}
        />
        <Tabs.Screen
          name="health"
          options={{
            title: 'Health',
            tabBarIcon: tabIcon(Activity),
          }}
        />
        <Tabs.Screen
          name="discover"
          options={{
            title: 'Discover',
            tabBarIcon: tabIcon(Compass),
          }}
        />
        <Tabs.Screen
          name="give"
          options={{
            title: 'Give',
            tabBarIcon: tabIcon(HeartHandshake),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Menu',
            tabBarButton: (props) => <TabButton {...props} onMenuPress={() => {
              if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setMenuOpen(true);
            }} />,
            tabBarIcon: ({ focused }) => <AnimatedTabIcon Icon={Menu} focused={focused || menuOpen} />,
          }}
        />
      </Tabs>
      <RightDrawer onClose={() => setMenuOpen(false)} visible={menuOpen} />
    </>
  );
}

const iconStyles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
  },
  buttonInner: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  slot: {
    alignItems: 'center',
    borderRadius: 14,
    height: 30,
    justifyContent: 'center',
    width: 44,
  },
  capsule: {
    backgroundColor: palette.forest,
    borderRadius: 14,
  },
});
