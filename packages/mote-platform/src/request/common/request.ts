//#region ApplyTransationsRequest

import { IUser } from '@mote/base/parts/storage/schema';

export enum OperationType {
    Update = 0,
    Set,
    ListBefore,
    ListAfter,
    ListRemove,
}

export interface IOperation {
    id: string;
    table: string;
    path: string[];
    type: OperationType;
    args: any;
    size?: number;
}

export type TransactionData = {
    id: string;
    userId: string;
    operations: IOperation[];
    timestamp: number;
};

export type ApplyTransationsRequest = {
    traceId: string;
    transactions: TransactionData[];
};

export type ApplyTransationsResponse = {
    traceId: string;
    success: boolean;
}

//#endregion

//#region Auth

export type AuthProvider = {
    id: string;
    name: string;
    authUrl: string;
};

export type AuthConfig = {
    name?: string;
    logo?: string;
    providers: AuthProvider[];
};

export type GenerateOneTimePasswordRequest = {
    email: string;
}

export type LoginWithOneTimePasswordRequest = {
    email?: string;
    password: string;
};

export type LoginWithOneTimePasswordResponse = {
    token: string;
    user: IUser;
    // space: ISpace;
    provider: AuthProvider;
};

//#endregion
