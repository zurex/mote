import { useEffect, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Card, CardContent, CardFooter, CardHeader } from './ui/card';
import { MoonStar } from './icon/MoonStar';
import { BoldIcon } from './icon/BoldIcon';
import { SendIcon } from './icon/SendIcon';
import { HashIcon } from './icon/HashIcon';
import { Button } from './ui/button';
import { Text } from './ui/text';
import { Separator } from './ui/separator';
import { Ellipsis } from './icon/Ellipsis';

type ToolButtonProps = {
    onPress?: () => void;
    icon: React.ReactNode;
};

function ToolButton({
    icon,
    onPress
}: ToolButtonProps) {
    return (
        <View className='mr-2 ml-2 first:ml-0'>
            {icon}
        </View>
    )
}

export function MemosInput() {
    const inputRef = useRef<TextInput>(null);

    const handleSend = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    return (
        <Card>
            <CardContent className='pt-5'>
                <TextInput
                    ref={inputRef}
                    multiline
                    autoFocus
                    placeholder="What's on your mind?"
                    style={{height: 100}}

                    />
            </CardContent>
            <CardFooter className='justify-between'>
                <View className='flex-row h-full items-center'>
                    <ToolButton icon={<HashIcon className='text-black' />}/>
                    <ToolButton icon={<BoldIcon className='text-black font-bold' />}/>
                    <Separator orientation='vertical' className='h-[24px] mr-2' />
                    <ToolButton icon={<Ellipsis className='text-black' />}/>
                </View>
                <Button 
                    onPressIn={handleSend}
                    className='bg-blue-500 rounded-3xl flex-row items-center gap-4'
                >
                    <SendIcon className='text-white'/>
                    <Text className='text-white'>Send</Text>
                </Button>
            </CardFooter>
        </Card>
    )
}