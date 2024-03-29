/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { Emitter, Event } from 'mote/base/common/event';
import { DisposableStore } from 'mote/base/common/lifecycle';
import { URI } from 'mote/base/common/uri';
import { InMemoryStorageDatabase, IStorageItemsChangeEvent, IUpdateRequest, Storage } from 'mote/base/parts/storage/common/storage';
import { AbstractUserDataProfileStorageService, IUserDataProfileStorageService } from 'mote/platform/userDataProfile/common/userDataProfileStorageService';
import { InMemoryStorageService, loadKeyTargets, StorageTarget, TARGET_KEY } from 'mote/platform/storage/common/storage';
import { IUserDataProfile, toUserDataProfile } from 'mote/platform/userDataProfile/common/userDataProfile';
import { runWithFakedTimers } from 'mote/base/test/common/timeTravelScheduler';

class TestStorageDatabase extends InMemoryStorageDatabase {

	private readonly _onDidChangeItemsExternal = new Emitter<IStorageItemsChangeEvent>();
	override readonly onDidChangeItemsExternal = this._onDidChangeItemsExternal.event;

	override async updateItems(request: IUpdateRequest): Promise<void> {
		await super.updateItems(request);
		if (request.insert || request.delete) {
			this._onDidChangeItemsExternal.fire({ changed: request.insert, deleted: request.delete });
		}
	}
}

export class TestUserDataProfileStorageService extends AbstractUserDataProfileStorageService implements IUserDataProfileStorageService {

	readonly onDidChange = Event.None;
	private databases = new Map<string, InMemoryStorageDatabase>();

	async createStorageDatabase(profile: IUserDataProfile): Promise<InMemoryStorageDatabase> {
		let database = this.databases.get(profile.id);
		if (!database) {
			this.databases.set(profile.id, database = new TestStorageDatabase());
		}
		return database;
	}

	protected override async closeAndDispose(): Promise<void> { }
}

suite('ProfileStorageService', () => {

	const disposables = new DisposableStore();
	const profile = toUserDataProfile('test', 'test', URI.file('foo'));
	let testObject: TestUserDataProfileStorageService;
	let storage: Storage;

	setup(async () => {
		testObject = disposables.add(new TestUserDataProfileStorageService(new InMemoryStorageService()));
		storage = new Storage(await testObject.createStorageDatabase(profile));
		await storage.init();
	});

	teardown(() => disposables.clear());

	test('read empty storage', () => runWithFakedTimers<void>({ useFakeTimers: true }, async () => {
		const actual = await testObject.readStorageData(profile);

		assert.strictEqual(actual.size, 0);
	}));

	test('read storage with data', () => runWithFakedTimers<void>({ useFakeTimers: true }, async () => {
		storage.set('foo', 'bar');
		storage.set(TARGET_KEY, JSON.stringify({ foo: StorageTarget.USER }));
		await storage.flush();

		const actual = await testObject.readStorageData(profile);

		assert.strictEqual(actual.size, 1);
		assert.deepStrictEqual(actual.get('foo'), { 'value': 'bar', 'target': StorageTarget.USER });
	}));

	test('write in empty storage', () => runWithFakedTimers<void>({ useFakeTimers: true }, async () => {
		const data = new Map<string, string>();
		data.set('foo', 'bar');
		await testObject.updateStorageData(profile, data, StorageTarget.USER);

		assert.strictEqual(storage.items.size, 2);
		assert.deepStrictEqual(loadKeyTargets(storage), { foo: StorageTarget.USER });
		assert.strictEqual(storage.get('foo'), 'bar');
	}));

	test('write in storage with data', () => runWithFakedTimers<void>({ useFakeTimers: true }, async () => {
		storage.set('foo', 'bar');
		storage.set(TARGET_KEY, JSON.stringify({ foo: StorageTarget.USER }));
		await storage.flush();

		const data = new Map<string, string>();
		data.set('abc', 'xyz');
		await testObject.updateStorageData(profile, data, StorageTarget.MACHINE);

		assert.strictEqual(storage.items.size, 3);
		assert.deepStrictEqual(loadKeyTargets(storage), { foo: StorageTarget.USER, abc: StorageTarget.MACHINE });
		assert.strictEqual(storage.get('foo'), 'bar');
		assert.strictEqual(storage.get('abc'), 'xyz');
	}));

	test('write in storage with data (insert, update, remove)', () => runWithFakedTimers<void>({ useFakeTimers: true }, async () => {
		storage.set('foo', 'bar');
		storage.set('abc', 'xyz');
		storage.set(TARGET_KEY, JSON.stringify({ foo: StorageTarget.USER, abc: StorageTarget.MACHINE }));
		await storage.flush();

		const data = new Map<string, string | undefined>();
		data.set('foo', undefined);
		data.set('abc', 'def');
		data.set('var', 'const');
		await testObject.updateStorageData(profile, data, StorageTarget.USER);

		assert.strictEqual(storage.items.size, 3);
		assert.deepStrictEqual(loadKeyTargets(storage), { abc: StorageTarget.USER, var: StorageTarget.USER });
		assert.strictEqual(storage.get('abc'), 'def');
		assert.strictEqual(storage.get('var'), 'const');
	}));

});
