import { ICredentialsChangeEvent, ICredentialsProvider, ICredentialsService } from 'mote/platform/credentials/common/credentials';
import { Disposable } from 'mote/base/common/lifecycle';
import { Emitter } from 'mote/base/common/event';

export class BrowserCredentialsService extends Disposable implements ICredentialsService {
	declare readonly _serviceBrand: undefined;

	private _onDidChangePassword = this._register(new Emitter<ICredentialsChangeEvent>());
	readonly onDidChangePassword = this._onDidChangePassword.event;

	private credentialsProvider!: ICredentialsProvider;

	private _secretStoragePrefix!: Promise<string>;
	public async getSecretStoragePrefix() { return this._secretStoragePrefix; }

	constructor() {
		super();
	}

	getPassword(service: string, account: string): Promise<string | null> {
		return this.credentialsProvider.getPassword(service, account);
	}

	async setPassword(service: string, account: string, password: string): Promise<void> {
		await this.credentialsProvider.setPassword(service, account, password);

		this._onDidChangePassword.fire({ service, account });
	}

	async deletePassword(service: string, account: string): Promise<boolean> {
		const didDelete = await this.credentialsProvider.deletePassword(service, account);
		if (didDelete) {
			this._onDidChangePassword.fire({ service, account });
		}

		return didDelete;
	}

	findPassword(service: string): Promise<string | null> {
		return this.credentialsProvider.findPassword(service);
	}

	findCredentials(service: string): Promise<Array<{ account: string; password: string }>> {
		return this.credentialsProvider.findCredentials(service);
	}

	async clear(): Promise<void> {
		if (this.credentialsProvider.clear) {
			return this.credentialsProvider.clear();
		}
	}
}
