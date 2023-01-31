/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * @param {string} name
 * @param {string[]} exclude
 */
function createModuleDescription(name, exclude) {

	let excludes = ['mote/css', 'mote/nls'];
	if (Array.isArray(exclude) && exclude.length > 0) {
		excludes = excludes.concat(exclude);
	}

	return {
		name: name,
		include: [],
		exclude: excludes
	};
}

/**
 * @param {string} name
 */
function createEditorWorkerModuleDescription(name) {
	return createModuleDescription(name, ['mote/base/common/worker/simpleWorker', 'mote/editor/common/services/editorSimpleWorker']);
}

exports.base = [
	{
		name: 'mote/editor/common/services/editorSimpleWorker',
		include: ['mote/base/common/worker/simpleWorker'],
		exclude: ['mote/nls'],
		prepend: [
			{ path: 'mote/loader.js' },
			{ path: 'mote/nls.js', amdModuleId: 'mote/nls' },
			{ path: 'mote/base/worker/workerMain.js' }
		],
		dest: 'mote/base/worker/workerMain.js'
	},
	{
		name: 'mote/base/common/worker/simpleWorker',
		exclude: ['mote/nls'],
	}
];

exports.workerExtensionHost = [createEditorWorkerModuleDescription('mote/workbench/api/worker/extensionHostWorker')];
exports.workerNotebook = [createEditorWorkerModuleDescription('mote/workbench/contrib/notebook/common/services/notebookSimpleWorker')];
exports.workerSharedProcess = [createEditorWorkerModuleDescription('mote/platform/sharedProcess/electron-browser/sharedProcessWorkerMain')];
exports.workerLanguageDetection = [createEditorWorkerModuleDescription('mote/workbench/services/languageDetection/browser/languageDetectionSimpleWorker')];
exports.workerLocalFileSearch = [createEditorWorkerModuleDescription('mote/workbench/services/search/worker/localFileSearch')];

exports.workbenchDesktop = [
	createEditorWorkerModuleDescription('mote/workbench/contrib/output/common/outputLinkComputer'),
	createModuleDescription('mote/workbench/contrib/debug/node/telemetryApp'),
	createModuleDescription('mote/platform/files/node/watcher/watcherMain'),
	createModuleDescription('mote/platform/terminal/node/ptyHostMain'),
	createModuleDescription('mote/workbench/api/node/extensionHostProcess')
];

exports.workbenchWeb = [
	//createEditorWorkerModuleDescription('mote/workbench/contrib/output/common/outputLinkComputer'),
	createModuleDescription('mote/app/browser/workbench/workbench', ['mote/workbench/workbench.web.main'])
];

exports.keyboardMaps = [
	createModuleDescription('mote/workbench/services/keybinding/browser/keyboardLayouts/layout.contribution.linux'),
	createModuleDescription('mote/workbench/services/keybinding/browser/keyboardLayouts/layout.contribution.darwin'),
	createModuleDescription('mote/workbench/services/keybinding/browser/keyboardLayouts/layout.contribution.win')
];

exports.mote = [
	createModuleDescription('mote/app/electron-main/main'),
	createModuleDescription('mote/app/node/cli'),
	createModuleDescription('mote/app/node/cliProcessMain', ['mote/app/node/cli']),
];

exports.entrypoint = createModuleDescription;
