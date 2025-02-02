import { ICollection } from "mote/base/parts/storage/common/schema";
import { IBlockAndRole } from "mote/editor/common/blockCommon";
import { Pointer } from "mote/platform/record/common/record";
import { ICollectionCreateRequest } from "./collection";
import { ApplyTransationsRequest, AuthConfig, LoginWithOneTimePasswordResponse } from "./request";

class RequestService {
    public async get<T>(url: string): Promise<T> {
        const response = await fetch(url);
        const json = await response.json();
        return json.data;
    }

    public async post<T>(url: string, data: any): Promise<T> {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });
        const result = await response.json();
        return result.data;
    }

    public async put<T>(url: string, data: any): Promise<T> {
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });
        return response.json();
    }

    public async delete<T>(url: string): Promise<T> {
        const response = await fetch(url, {
            method: 'DELETE',
        });
        return response.json();
    }

    /**
     * Accquire the auth config.
     * @returns AuthConfig
     */
    public async getAuthConfig(): Promise<AuthConfig> {
        return this.get<AuthConfig>('/api/auth/config');
    }

    public async generateOneTimePassword(email: string): Promise<void> {
        return this.post<void>('/api/auth/one-time-password', { email });
    }

    public async loginWithOneTimePassword(
        email: string,
        code: string
    ): Promise<LoginWithOneTimePasswordResponse> {
        return this.get<LoginWithOneTimePasswordResponse>(
            `/api/auth/one-time-password?email=${email}&code=${code}`
        );
    }

    public async applyTransactions(request: ApplyTransationsRequest): Promise<void> {
        return this.post<void>('/api/applyTransactions', request);
    }

    public async createCollection(request: ICollectionCreateRequest): Promise<ICollection> {
        return this.post<ICollection>('/api/collection', request);
    }

    public async syncRecord(pointer: Pointer): Promise<IBlockAndRole> {
        return this.post<IBlockAndRole>('/api/syncRecords', pointer);
    }
}

export const requestService = new RequestService();