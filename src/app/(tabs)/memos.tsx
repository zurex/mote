import { MemosInput } from 'mote/components/memos-input';
import { ThemedSafeAreaView } from 'mote/components/ThemedView';
import { Text } from 'mote/components/ui/text';
import { BlurView } from 'expo-blur';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from 'expo-router';

export default function MemosScreen() {

    const navigation = useNavigation();
    const goBack = () => {
        navigation.goBack();
    };

    return (
            <KeyboardAvoidingView 
                className='flex flex-1'
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <StatusBar style={'light'} />
                <Pressable className='flex flex-1'
                    onPress={goBack}
                >
                    <BlurView 
                        intensity={80} 
                        tint="systemChromeMaterialDark" 
                        className='flex flex-1'
                        
                    />
                </Pressable>
                <MemosInput />
            </KeyboardAvoidingView>
    )
}

const styles = StyleSheet.create({
    background: {
        flex: 1,
        ...StyleSheet.absoluteFillObject,
    },
});