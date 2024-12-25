import { Image, StyleSheet, Platform } from 'react-native';

import { ThemedText } from 'mote/components/ThemedText';
import { ThemedSafeAreaView, ThemedView } from 'mote/components/ThemedView';
import { Text } from 'mote/components/ui/text';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from 'mote/components/ui/card';
import AutoScrollView from 'mote/components/AutoScrollView';

export type MemosCardProps = {

};

function MemosCard1() {
    return (
        <Card className='w-full max-w-md'>
            <CardHeader>
                <CardDescription>2024-12-24 23:46:42</CardDescription>
            </CardHeader>
            <CardContent>
                <ThemedText>
                Edit <ThemedText type="defaultSemiBold">app/(tabs)/index.tsx</ThemedText> to see changes.
                Press{' '}
                <ThemedText type="defaultSemiBold">
                    {Platform.select({
                    ios: 'cmd + d',
                    android: 'cmd + m',
                    web: 'F12'
                    })}
                </ThemedText>{' '}
            to open developer tools.
        </ThemedText>
            </CardContent>
            <CardFooter>
                <Text>Card Footer</Text>
            </CardFooter>
        </Card>
    )
}

function MemosCard2() {
    return (
        <Card className='w-full max-w-md'>
            <CardHeader>
                <CardDescription>2024-12-24 23:46:42</CardDescription>
            </CardHeader>
            <CardContent>
                <ThemedText>
                When you're ready, run{' '}
                <ThemedText type="defaultSemiBold">npm run reset-project</ThemedText> to get a fresh{' '}
                <ThemedText type="defaultSemiBold">app</ThemedText> directory. This will move the current{' '}
                <ThemedText type="defaultSemiBold">app</ThemedText> to{' '}
                <ThemedText type="defaultSemiBold">app-example</ThemedText>.
                </ThemedText>
            </CardContent>
            <CardFooter>
                <Text>Card Footer</Text>
            </CardFooter>
        </Card>
    )
}

export default function HomeScreen() {
    return (
        <ThemedSafeAreaView style={{ flex: 1 }}>
            <ThemedView className='pt-20' style={{ paddingLeft: 20, paddingRight: 20 }}>
                <ThemedText type="title">主页</ThemedText>
                <AutoScrollView className='pt-10 gap-5 h-full'>
                    <MemosCard1 />
                    <MemosCard2 />
                </AutoScrollView>
            </ThemedView>
        </ThemedSafeAreaView>
    )
}
