import { Tabs, useFocusEffect } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, TextInput } from 'react-native';
import { KeyboardAwareScrollView, KeyboardProvider, useKeyboardAnimation } from 'react-native-keyboard-controller';

import { HapticTab } from 'mote/components/HapticTab';
import { IconSymbol } from 'mote/components/ui/IconSymbol';
import TabBarBackground from 'mote/components/ui/TabBarBackground';
import { Colors } from 'mote/constants/Colors';
import { useColorScheme } from 'mote/hooks/useColorScheme';
import { memosInput, useMemosInput } from 'mote/hooks/useMemosInput';

export default function TabLayout() {
    const { colorScheme } = useColorScheme();
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(memosInput.get());
    useEffect(() => {
            return memosInput.subscribe(setIsKeyboardVisible);
    }, []);
    console.log('isKeyboardVisible', isKeyboardVisible);

    return (
        <KeyboardProvider>
            
            <Tabs
                screenOptions={{
                    tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
                    headerShown: false,
                    tabBarButton: HapticTab,
                    tabBarShowLabel: false,
                    tabBarBackground: TabBarBackground,
                    tabBarStyle: Platform.select({
                    ios: {
                        // Use a transparent background on iOS to show the blur effect
                        position: 'absolute',
                    },
                    default: {},
                    }),
                }}>
                <Tabs.Screen
                    name="home"
                    options={{
                        title: '主页',
                        tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
                    }}
                />
                <Tabs.Screen
                    name="memos"
                    options={{
                        tabBarShowLabel: false,
                        tabBarIcon: ({ color }) => <IconSymbol size={28} name="plus.circle.fill" color={color} />,
                    }}
                    listeners={() => ({
                        tabPress: (e) => {
                            // Prevent default action
                            // e.preventDefault();
                            // Do something with the `navigation` object
                            // navigation.navigate('AnotherScreen');
                        },
                    })}
                />
                <Tabs.Screen
                    name="explore"
                    options={{
                        title: 'Explore',
                        tabBarIcon: ({ color }) => <IconSymbol size={28} name="paperplane.fill" color={color} />,
                    }}
                />
            </Tabs>
        </KeyboardProvider>
    );
}
