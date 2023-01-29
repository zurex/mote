/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { FileService } from 'mote/platform/files/common/fileService';
import { NullLogService } from 'mote/platform/log/common/log';
import { Schemas } from 'mote/base/common/network';
import { URI } from 'mote/base/common/uri';
import { joinPath } from 'mote/base/common/resources';
import { DisposableStore } from 'mote/base/common/lifecycle';
import { InMemoryFileSystemProvider } from 'mote/platform/files/common/inMemoryFilesystemProvider';
import { AbstractNativeEnvironmentService } from 'mote/platform/environment/common/environmentService';
import product from 'mote/platform/product/common/product';
import { UserDataProfilesMainService } from 'mote/platform/userDataProfile/electron-main/userDataProfile';
import { StateMainService } from 'mote/platform/state/electron-main/stateMainService';
import { UriIdentityService } from 'mote/platform/uriIdentity/common/uriIdentityService';

const ROOT = URI.file('tests').with({ scheme: 'vscode-tests' });

class TestEnvironmentService extends AbstractNativeEnvironmentService {
	constructor(private readonly _appSettingsHome: URI) {
		super(Object.create(null), Object.create(null), { _serviceBrand: undefined, ...product });
	}
	override get userRoamingDataHome() { return this._appSettingsHome.with({ scheme: Schemas.vscodeUserData }); }
	override get extensionsPath() { return joinPath(this.userRoamingDataHome, 'extensions.json').path; }
	override get stateResource() { return joinPath(this.userRoamingDataHome, 'state.json'); }
}

suite('UserDataProfileMainService', () => {

	const disposables = new DisposableStore();
	let testObject: UserDataProfilesMainService;
	let environmentService: TestEnvironmentService, stateService: StateMainService;

	setup(async () => {
		const logService = new NullLogService();
		const fileService = disposables.add(new FileService(logService));
		const fileSystemProvider = disposables.add(new InMemoryFileSystemProvider());
		disposables.add(fileService.registerProvider(Schemas.vscodeUserData, fileSystemProvider));

		environmentService = new TestEnvironmentService(joinPath(ROOT, 'User'));
		stateService = new StateMainService(environmentService, logService, fileService);

		testObject = new UserDataProfilesMainService(stateService, new UriIdentityService(fileService), environmentService, fileService, logService);
		await stateService.init();
		testObject.setEnablement(true);
	});

	teardown(() => disposables.clear());

	test('default profile', () => {
		assert.strictEqual(testObject.defaultProfile.isDefault, true);
	});

	test('profiles always include default profile', () => {
		assert.deepStrictEqual(testObject.profiles.length, 1);
		assert.deepStrictEqual(testObject.profiles[0].isDefault, true);
	});

	test('default profile when there are profiles', async () => {
		await testObject.createNamedProfile('test');
		assert.strictEqual(testObject.defaultProfile.isDefault, true);
	});

	test('default profile when profiles are removed', async () => {
		const profile = await testObject.createNamedProfile('test');
		await testObject.removeProfile(profile);
		assert.strictEqual(testObject.defaultProfile.isDefault, true);
	});

	test('when no profile is set', async () => {
		await testObject.createNamedProfile('profile1');

		assert.equal(testObject.getProfileForWorkspace({ id: 'id' }), undefined);
		assert.equal(testObject.getProfileForWorkspace({ id: 'id', configPath: environmentService.userRoamingDataHome }), undefined);
		assert.equal(testObject.getProfileForWorkspace({ id: 'id', uri: environmentService.userRoamingDataHome }), undefined);
	});

	test('set profile to a workspace', async () => {
		const workspace = { id: 'id', configPath: environmentService.userRoamingDataHome };
		const profile = await testObject.createNamedProfile('profile1');

		testObject.setProfileForWorkspace(workspace, profile);

		assert.deepStrictEqual(testObject.getProfileForWorkspace(workspace), profile);
	});

	test('set profile to a folder', async () => {
		const workspace = { id: 'id', uri: environmentService.userRoamingDataHome };
		const profile = await testObject.createNamedProfile('profile1');

		testObject.setProfileForWorkspace(workspace, profile);

		assert.deepStrictEqual(testObject.getProfileForWorkspace(workspace), profile);
	});

	test('set profile to a window', async () => {
		const workspace = { id: 'id' };
		const profile = await testObject.createNamedProfile('profile1');

		testObject.setProfileForWorkspace(workspace, profile);

		assert.deepStrictEqual(testObject.getProfileForWorkspace(workspace), profile);
	});

});
