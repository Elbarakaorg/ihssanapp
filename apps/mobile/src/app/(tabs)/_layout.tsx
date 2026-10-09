import * as Haptics from 'expo-haptics';
import { Tabs } from 'expo-router';
import { PlatformPressable } from 'expo-router/react-navigation';
import { Activity, Compass, HeartHandshake, House, type LucideIcon, Menu } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, StyleSheet, View, type ColorValue } from 'react-native';
import type { BottomTabBarButtonProps } from 'expo-router/build/react-navigation/bottom-tabs/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RightDrawer } from '@/features/navigation/right-drawer';
import { palette, themedStyles, useScheme } from '@/ui/palette';

function tabIcon(Icon: LucideIcon) {
  return ({ focused }: { color: ColorValue; focused: boolean; size: number }) => (
    <TabIcon Icon={Icon} focused={focused} />
  );
}

function TabIcon({ Icon, focused }: { Icon: LucideIcon; focused: boolean }) {
  useScheme();
  return (
    <View style={iconStyles.slot}>
      <Icon color={focused ? palette.forest : palette.muted} size={20} strokeWidth={focused ? 2.1 : 1.8} />
    </View>
  );
}

function TabButton({ children, href, onLongPress, onMenuPress, onPress, style, ref: _ref, ...rest }: BottomTabBarButtonProps & { onMenuPress?: () => void }) {
  return (
    <PlatformPressable
      {...rest}
      {...(!onMenuPress && href ? { href } : {})}
      onLongPress={onLongPress}
      onPress={onMenuPress ? () => onMenuPress() : onPress}
      pressOpacity={0.7}
      style={style}>
      <View style={iconStyles.buttonInner}>{children}</View>
    </PlatformPressable>
  );
}

export default function TabLayout() {
  useScheme();
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <Tabs
        tabBar={() => null}
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
            backgroundColor: palette.glass,
            ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(16px) saturate(1.15)', WebkitBackdropFilter: 'blur(16px) saturate(1.15)' } as object) : null),
            borderTopColor: palette.glassEdge,
            borderTopWidth: StyleSheet.hairlineWidth,
            height: 58 + insets.bottom,
            paddingBottom: insets.bottom,
          },
          tabBarItemStyle: { paddingTop: 5 },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '600',
            marginTop: 1,
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
            tabBarIcon: ({ focused }) => <TabIcon Icon={Menu} focused={focused || menuOpen} />,
          }}
        />
      </Tabs>
      <RightDrawer onClose={() => setMenuOpen(false)} visible={menuOpen} />
    </>
  );
}

const iconStyles = themedStyles(() => StyleSheet.create({
  buttonInner: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  slot: {
    alignItems: 'center',
    height: 30,
    justifyContent: 'center',
    width: 44,
  },
}));
