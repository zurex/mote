import { PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native';
import { ThemedView } from './ThemedView';
import Animated from 'react-native-reanimated';

export type AutoScrollViewProps = PropsWithChildren<{className?: string}>;

export default function AutoScrollView({ children, className }: AutoScrollViewProps) {
    return (
        <ThemedView className={className}>
            <Animated.ScrollView scrollEventThrottle={16}>
                <ThemedView style={styles.content}>{children}</ThemedView>
            </Animated.ScrollView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        height: 250,
        overflow: 'hidden',
    },
    content: {
        flex: 1,
        gap: 16,
        overflow: 'hidden',
    },
});