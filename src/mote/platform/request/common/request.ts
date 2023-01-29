import { CancellationToken } from 'mote/base/common/cancellation';
import { IRequestContext, IRequestOptions } from 'mote/base/parts/request/common/request';
import { createDecorator } from 'mote/platform/instantiation/common/instantiation';

export const IRequestService = createDecorator<IRequestService>('requestService');

export interface IRequestService {
	readonly _serviceBrand: undefined;

	request(options: IRequestOptions, token: CancellationToken): Promise<IRequestContext>;

	resolveProxy(url: string): Promise<string | undefined>;
}
