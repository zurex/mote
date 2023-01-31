import { VSBufferReadableStream } from 'mote/base/common/buffer';
import { generateUuid } from 'mote/base/common/uuid';

const offlineName = 'Offline';

/**
 * Checks if the given error is offline error
 */
export function isOfflineError(error: any): boolean {
	if (error instanceof OfflineError) {
		return true;
	}
	return error instanceof Error && error.name === offlineName && error.message === offlineName;
}

export class OfflineError extends Error {
	constructor() {
		super(offlineName);
		this.name = this.message;
	}
}

export interface IHeaders {
	[header: string]: string;
}

export interface IRequestOptions {
	type?: string;
	url?: string;
	user?: string;
	password?: string;
	headers?: IHeaders;
	timeout?: number;
	data?: string;
	followRedirects?: number;
	proxyAuthorization?: string;
}

export interface IRequestContext {
	res: {
		headers: IHeaders;
		statusCode?: number;
	};
	stream: VSBufferReadableStream;
}

export const config = {
	apiDev: 'http://localhost:7071',
	apiProd: 'https://caffeine-function.azurewebsites.net',
	apiDomain: '',
};


export async function doFetch<T>(url: string, payload: any, method: string): Promise<T> {
	if (!navigator.onLine) {
		throw new OfflineError();
	}
	let contentType = '';
	if (payload instanceof File) {
		contentType = payload.type;
	} else if (payload instanceof FormData) {

	}
	else {
		contentType = 'application/json';
		payload = JSON.stringify(payload);
	}
	const uuid = generateUuid();
	const requestId = uuid.replaceAll('-', '');
	const token = sessionStorage.getItem('auth_token');
	url = `${config.apiDomain}${url}`;
	try {
		const headers: HeadersInit = {
			'Accept': 'application/json',
			'X-Request-ID': requestId,
			'Authorization': `Bearer ${token}`
		};
		if (contentType) {
			headers['Content-Type'] = contentType;
		}
		const response = await fetch(url, {
			headers: headers,
			mode: 'cors',
			method: method,
			body: payload
		});
		return response.json();
	} catch (err) {
		return Promise.reject(err);
	}
}
