import { useStorageState } from 'mote/hooks/useStorageState';
import React from 'react';

const AuthContext = React.createContext<{
    signIn: (token: string) => void;
    signOut: () => void;
    session?: string | null;
    isLoading: boolean;
}>({
    signIn: (token: string) => null,
    signOut: () => null,
    session: null,
    isLoading: false,
});

// This hook can be used to access the user info.
export function useSession() {
    const value = React.useContext(AuthContext);
    if (process.env.NODE_ENV !== 'production') {
        if (!value) {
            throw new Error(
                'useSession must be wrapped in a <SessionProvider />'
            );
        }
    }

    return value;
}

export function SessionProvider(props: React.PropsWithChildren) {
    const [[isLoading, session], setSession] = useStorageState('session');
    // const [session, setSession] = React.useState<string | null>(null);
    // const isLoading = false;

    return (
        <AuthContext.Provider
            value={{
                signIn: (token: string) => {
                    console.log('signing in');
                    // Perform sign-in logic here
                    setSession(token);
                },
                signOut: () => {
                    setSession(null);
                },
                session,
                isLoading,
            }}
        >
            {props.children}
        </AuthContext.Provider>
    );
}