import { DarkTheme, DefaultTheme, Theme, ThemeProvider } from '@react-navigation/native';
import { fonts } from '@react-navigation/native/src/theming/fonts';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useColorScheme } from 'mote/hooks/useColorScheme';

import "../global.css";
import { NAV_THEME } from 'mote/constants/theme';
import { Platform } from 'react-native';
import { SessionProvider } from 'mote/components/session-provider';

const LIGHT_THEME: Theme = {
    dark: false,
    colors: NAV_THEME.light,
    fonts
};
const DARK_THEME: Theme = {
    dark: true,
    colors: NAV_THEME.dark,
    fonts
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
    const { colorScheme, setColorScheme, isDarkColorScheme } = useColorScheme();
    const [isColorSchemeLoaded, setIsColorSchemeLoaded] = useState(false);
    const [loaded] = useFonts({
        SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    });

    useEffect(() => {
        if (loaded) {
            SplashScreen.hideAsync();
        }
    }, [loaded]);

    useEffect(() => {
        (async () => {
            const theme = await AsyncStorage.getItem('theme');
            if (Platform.OS === 'web') {
                // Adds the background color to the html element to prevent white background on overscroll.
                document.documentElement.classList.add('bg-background');
            }
            if (!theme) {
                AsyncStorage.setItem('theme', colorScheme);
                setIsColorSchemeLoaded(true);
                return;
            }
            const colorTheme = theme === 'dark' ? 'dark' : 'light';
            if (colorTheme !== colorScheme) {
                setColorScheme(colorTheme);
        
                setIsColorSchemeLoaded(true);
                return;
            }
            setIsColorSchemeLoaded(true);
        })().finally(() => {
            SplashScreen.hideAsync();
        });
      }, []);

    if (!loaded || !isColorSchemeLoaded) {
        return null;
    }

    return (
        <SessionProvider>
            <ThemeProvider value={isDarkColorScheme ? DARK_THEME : LIGHT_THEME}>
                <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                    <Stack.Screen name="+not-found" />
                </Stack>
                <StatusBar style="auto" />
            </ThemeProvider>
        </SessionProvider>
    );
}
