import { memosInput, useMemosInput } from 'mote/hooks/useMemosInput';
import { useEffect, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { Card, CardContent } from './ui/card';
import { BlurView } from 'expo-blur';

export function MemosInput() {
    const inputRef = useRef<TextInput>(null);
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(memosInput.get());

    console.log('MemosInput->isKeyboardVisible', isKeyboardVisible);
    useEffect(() => {
        return memosInput.subscribe(setIsKeyboardVisible);
      }, []);

    useEffect(() => {
        if (isKeyboardVisible) {
            inputRef.current?.focus();
        }
    }, [isKeyboardVisible]);
    return (
        <BlurView 
            className='pt-10 fixed' 
            intensity={100} 
            tint="systemChromeMaterial" 
            style={isKeyboardVisible ? { bottom: 80} : {width: 0, height: 0}}
        >
            <Card>
                <CardContent>
                <TextInput
                    ref={inputRef}
                    multiline
                    onBlur={() => memosInput.set(false)}
                    placeholder="What's on your mind?" 
                    style={{height: 50}}
                />
                </CardContent>
            </Card>
        </BlurView>
    )
}