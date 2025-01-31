import AsyncStorage from '@react-native-async-storage/async-storage';
import * as React from 'react';
import { Platform } from 'react-native';

type UseStateHook<T> = [[boolean, T | null], (value: T | null) => void];

function useAsyncState<T>(
    initialValue: [boolean, T | null] = [true, null]
): UseStateHook<T> {
    return React.useReducer(
        (
            state: [boolean, T | null],
            action: T | null = null
        ): [boolean, T | null] => [false, action],
        initialValue
    ) as UseStateHook<T>;
}

export async function setStorageItemAsync(key: string, value: string | null) {
    if (Platform.OS === 'web') {
        try {
            if (value === null) {
                localStorage.removeItem(key);
            } else {
                localStorage.setItem(key, value);
            }
        } catch (e) {
            console.error('Local storage is unavailable:', e);
        }
    } else {
        if (value == null) {
            await AsyncStorage.removeItem(key);
        } else {
            await AsyncStorage.setItem(key, value);
        }
    }
}

export function useStorageState(key: string): UseStateHook<string> {
    // Public
    const [state, setState] = useAsyncState<string>();

    // Get
    React.useEffect(() => {
        if (Platform.OS === 'web') {
            try {
                if (typeof localStorage !== 'undefined') {
                    setState(localStorage.getItem(key));
                }
            } catch (e) {
                console.error('Local storage is unavailable:', e);
            }
        } else {
            AsyncStorage.getItem(key).then((value) => {
                setState(value);
            });
        }
    }, [key]);

    // Set
    const setValue = React.useCallback(
        (value: string | null) => {
            setState(value);
            setStorageItemAsync(key, value);
        },
        [key]
    );

    return [state, setValue];
}
