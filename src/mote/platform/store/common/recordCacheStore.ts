import { Emitter, Event } from 'mote/base/common/event';
import { Disposable, IDisposable } from 'mote/base/common/lifecycle';
import { Pointer, RecordWithRole } from './record';

interface CacheKeyProps {
	pointer: Pointer;
	userId?: string;
}

interface Listener {
	(): void;
}

export default class RecordCacheStore extends Disposable {

	static Default = new RecordCacheStore();

	static generateCacheKey = (props: CacheKeyProps) => {
		const { pointer: { table, id }, userId } = props;
		return `${table}:${id}:${userId || ''}`;
	};

	private listerers: Map<String, Set<Listener>> = new Map();

	private _onDidChange = this._register(new Emitter<string>());
	public readonly onDidChange: Event<string> = this._onDidChange.event;

	private _onDidUpdate = this._register(new Emitter<string>());
	public readonly onDidUpdate: Event<string> = this._onDidUpdate.event;

	state = {
		cache: new Map<string, any>(),
		syncStates: new Map(),
		appliedTransaction: !1
	};

	getRecord(e: CacheKeyProps): RecordWithRole | undefined {
		const key = RecordCacheStore.generateCacheKey(e);
		const record = this.state.cache.get(key);
		if (record) {
			return record.value;
		}
		return undefined;
	}

	getRecordValue(e: CacheKeyProps) {
		const t = this.getRecord(e);
		if (t && t.value) {
			return t.value;
		}
		return null;
	}

	getRole(e: CacheKeyProps) {
		const t = this.getRecord(e);
		if (t && t.role) {
			return t.role;
		}
		return null;
	}

	getVersion(e: CacheKeyProps) {
		const t = this.getRecord(e);
		return t && t.value && t.value.version ? t.value.version : 0;
	}

	setRecord(keyProps: CacheKeyProps, value: RecordWithRole) {
		const key = RecordCacheStore.generateCacheKey(keyProps);
		const cachedValue = this.state.cache.get(key);
		if (value) {
			const record = Object.assign({}, keyProps, {
				value: value
			});
			if (cachedValue && cachedValue.pointer.spaceId && !record.pointer.spaceId) {
				record.pointer.spaceId = cachedValue.pointer.spaceId;
			}
			this.state.cache.set(key, record);
			this.emit(key);
		} else {
			this.deleteRecord(keyProps);
		}
	}

	deleteRecord(e: CacheKeyProps) {
		const key = RecordCacheStore.generateCacheKey(e);
		this.state.cache.delete(key);
	}

	forEachRecord(e: string, callback: any) {
		for (const { pointer, value, userId } of this.state.cache.values()) {
			if (value && 'none' !== value.role && userId === e) {
				callback(pointer, value);
			}
		}
	}

	getSyncState(e: CacheKeyProps) {
		return this.state.syncStates.get(RecordCacheStore.generateCacheKey(e));
	}

	setSyncState(e: CacheKeyProps, t: any) {
		this.state.syncStates.set(RecordCacheStore.generateCacheKey(e), t);
	}

	clearSyncState(e: CacheKeyProps) {
		this.state.syncStates.delete(RecordCacheStore.generateCacheKey(e));
	}

	fire(key: string) {
		this._onDidUpdate.fire(key);
	}

	emit(key: string) {
		const listenerSet = this.listerers.get(key);
		if (listenerSet) {
			listenerSet.forEach((listener) => {
				listener();
			});
		}
	}

	addListener(userId: string, pointer: Pointer, listener: () => void): IDisposable {
		const key = RecordCacheStore.generateCacheKey({ userId, pointer });
		let listenerSet = this.listerers.get(key);
		if (!listenerSet) {
			listenerSet = new Set();
			this.listerers.set(key, listenerSet);
		}
		listenerSet.add(listener);
		return { dispose: () => this.removeListener(userId, pointer, listener) };
	}

	removeListener(userId: string, pointer: Pointer, listener: () => void) {
		const key = RecordCacheStore.generateCacheKey({ userId, pointer });
		const listenerSet = this.listerers.get(key);
		if (listenerSet) {
			listenerSet.delete(listener);
			if (listenerSet.size === 0) {
				this.listerers.delete(key);
			}
		}
	}
}
