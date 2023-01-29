/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { VSBuffer } from 'mote/base/common/buffer';
import { DisposableStore } from 'mote/base/common/lifecycle';
import { platform } from 'mote/base/common/platform';
import { arch } from 'mote/base/common/process';
import { joinPath } from 'mote/base/common/resources';
import { isBoolean } from 'mote/base/common/types';
import { URI } from 'mote/base/common/uri';
import { generateUuid } from 'mote/base/common/uuid';
import { mock } from 'mote/base/test/common/mock';
import { IConfigurationService } from 'mote/platform/configuration/common/configuration';
import { TestConfigurationService } from 'mote/platform/configuration/test/common/testConfigurationService';
import { INativeEnvironmentService } from 'mote/platform/environment/common/environment';
import { ExtensionVerificationStatus } from 'mote/platform/extensionManagement/common/abstractExtensionManagementService';
import { ExtensionManagementError, ExtensionManagementErrorCode, getTargetPlatform, IExtensionGalleryService, IGalleryExtension, IGalleryExtensionAssets, ILocalExtension } from 'mote/platform/extensionManagement/common/extensionManagement';
import { getGalleryExtensionId } from 'mote/platform/extensionManagement/common/extensionManagementUtil';
import { ExtensionsDownloader } from 'mote/platform/extensionManagement/node/extensionDownloader';
import { ExtensionsScanner, InstallGalleryExtensionTask } from 'mote/platform/extensionManagement/node/extensionManagementService';
import { IExtensionSignatureVerificationService } from 'mote/platform/extensionManagement/node/extensionSignatureVerificationService';
import { IFileService } from 'mote/platform/files/common/files';
import { FileService } from 'mote/platform/files/common/fileService';
import { InMemoryFileSystemProvider } from 'mote/platform/files/common/inMemoryFilesystemProvider';
import { TestInstantiationService } from 'mote/platform/instantiation/test/common/instantiationServiceMock';
import { ILogService, NullLogService } from 'mote/platform/log/common/log';
import { IProductService } from 'mote/platform/product/common/productService';

const ROOT = URI.file('tests').with({ scheme: 'vscode-tests' });

class TestExtensionsScanner extends mock<ExtensionsScanner>() {
	override async scanExtensions(): Promise<ILocalExtension[]> { return []; }
}

class TestExtensionSignatureVerificationService extends mock<IExtensionSignatureVerificationService>() {

	constructor(private readonly verificationResult: string | boolean) {
		super();
	}

	override async verify(): Promise<boolean> {
		if (isBoolean(this.verificationResult)) {
			return this.verificationResult;
		}
		const error = Error(this.verificationResult);
		(error as any).code = this.verificationResult;
		throw error;
	}
}

class TestInstallGalleryExtensionTask extends InstallGalleryExtensionTask {

	installed = false;

	constructor(
		extension: IGalleryExtension,
		extensionDownloader: ExtensionsDownloader,
	) {
		super(
			{
				name: extension.name,
				publisher: extension.publisher,
				version: extension.version,
				engines: { vscode: '*' },
			},
			extension,
			{},
			extensionDownloader,
			new TestExtensionsScanner(),
			new NullLogService(),
		);
	}

	protected override async installExtension(): Promise<ILocalExtension> {
		this.installed = true;
		return new class extends mock<ILocalExtension>() { };
	}

	protected override async validateManifest(): Promise<void> { }
}

suite('InstallGalleryExtensionTask Tests', () => {

	const disposables = new DisposableStore();

	teardown(() => disposables.clear());

	test('if verification is enabled by default, the task completes', async () => {
		const testObject = new TestInstallGalleryExtensionTask(aGalleryExtension('a', { isSigned: true }), anExtensionsDownloader(true));

		await testObject.run();

		assert.strictEqual(testObject.verificationStatus, ExtensionVerificationStatus.Verified);
		assert.strictEqual(testObject.installed, true);
	});

	test('if verification is disabled in stable, the task completes', async () => {
		const testObject = new TestInstallGalleryExtensionTask(aGalleryExtension('a', { isSigned: true }), anExtensionsDownloader('error', undefined, 'stable'));

		await testObject.run();

		assert.strictEqual(testObject.verificationStatus, ExtensionVerificationStatus.Unverified);
		assert.strictEqual(testObject.installed, true);
	});

	test('if verification is disabled by setting set to false, the task skips verification', async () => {
		const testObject = new TestInstallGalleryExtensionTask(aGalleryExtension('a', { isSigned: true }), anExtensionsDownloader('error', false));

		await testObject.run();

		assert.strictEqual(testObject.verificationStatus, ExtensionVerificationStatus.Unverified);
		assert.strictEqual(testObject.installed, true);
	});

	test('if verification is disabled because the module is not loaded, the task skips verification', async () => {
		const testObject = new TestInstallGalleryExtensionTask(aGalleryExtension('a', { isSigned: true }), anExtensionsDownloader(false, true));

		await testObject.run();

		assert.strictEqual(testObject.verificationStatus, ExtensionVerificationStatus.Unverified);
		assert.strictEqual(testObject.installed, true);
	});

	test('if verification fails, the task throws', async () => {
		const errorCode = 'IntegrityCheckFailed';

		const testObject = new TestInstallGalleryExtensionTask(aGalleryExtension('a', { isSigned: true }), anExtensionsDownloader(errorCode, true));

		try {
			await testObject.run();
		} catch (e) {
			assert.ok(e instanceof ExtensionManagementError);
			assert.strictEqual(e.code, ExtensionManagementErrorCode.Signature);
			assert.strictEqual(e.message, errorCode);
			assert.strictEqual(testObject.verificationStatus, ExtensionVerificationStatus.Unverified);
			assert.strictEqual(testObject.installed, false);
			return;
		}

		assert.fail('It should have thrown.');

	});

	test('if verification succeeds, the task completes', async () => {
		const testObject = new TestInstallGalleryExtensionTask(aGalleryExtension('a', { isSigned: true }), anExtensionsDownloader(true, true));

		await testObject.run();

		assert.strictEqual(testObject.verificationStatus, ExtensionVerificationStatus.Verified);
		assert.strictEqual(testObject.installed, true);
	});

	test('task completes for unsigned extension', async () => {
		const testObject = new TestInstallGalleryExtensionTask(aGalleryExtension('a', { isSigned: false }), anExtensionsDownloader(true, true));

		await testObject.run();

		assert.strictEqual(testObject.verificationStatus, ExtensionVerificationStatus.Unverified);
		assert.strictEqual(testObject.installed, true);
	});

	test('task completes for an unsigned extension even when signature verification throws error', async () => {
		const testObject = new TestInstallGalleryExtensionTask(aGalleryExtension('a', { isSigned: false }), anExtensionsDownloader('error', true));

		await testObject.run();

		assert.strictEqual(testObject.verificationStatus, ExtensionVerificationStatus.Unverified);
		assert.strictEqual(testObject.installed, true);
	});

	function anExtensionsDownloader(verificationResult: string | boolean, isSignatureVerificationEnabled?: boolean, quality?: string): ExtensionsDownloader {
		const logService = new NullLogService();
		const fileService = disposables.add(new FileService(logService));
		const fileSystemProvider = disposables.add(new InMemoryFileSystemProvider());
		fileService.registerProvider(ROOT.scheme, fileSystemProvider);

		const instantiationService = new TestInstantiationService();
		instantiationService.stub(IProductService, { quality: quality ?? 'insiders' });
		instantiationService.stub(IFileService, fileService);
		instantiationService.stub(ILogService, logService);
		instantiationService.stub(INativeEnvironmentService, <Partial<INativeEnvironmentService>>{ extensionsDownloadLocation: joinPath(ROOT, 'CachedExtensionVSIXs') });
		instantiationService.stub(IExtensionGalleryService, <Partial<IExtensionGalleryService>>{
			async download(extension, location, operation) {
				await fileService.writeFile(location, VSBuffer.fromString('extension vsix'));
			},
			async downloadSignatureArchive(extension, location) {
				await fileService.writeFile(location, VSBuffer.fromString('extension signature'));
			},
		});
		instantiationService.stub(IConfigurationService, new TestConfigurationService(isBoolean(isSignatureVerificationEnabled) ? { extensions: { verifySignature: isSignatureVerificationEnabled } } : undefined));
		instantiationService.stub(IExtensionSignatureVerificationService, new TestExtensionSignatureVerificationService(verificationResult));
		return instantiationService.createInstance(ExtensionsDownloader);
	}

	function aGalleryExtension(name: string, properties: Partial<IGalleryExtension> = {}, galleryExtensionProperties: any = {}, assets: Partial<IGalleryExtensionAssets> = {}): IGalleryExtension {
		const targetPlatform = getTargetPlatform(platform, arch);
		const galleryExtension = <IGalleryExtension>Object.create({ name, publisher: 'pub', version: '1.0.0', allTargetPlatforms: [targetPlatform], properties: {}, assets: {}, ...properties });
		galleryExtension.properties = { ...galleryExtension.properties, dependencies: [], targetPlatform, ...galleryExtensionProperties };
		galleryExtension.assets = { ...galleryExtension.assets, ...assets };
		galleryExtension.identifier = { id: getGalleryExtensionId(galleryExtension.publisher, galleryExtension.name), uuid: generateUuid() };
		return <IGalleryExtension>galleryExtension;
	}
});
